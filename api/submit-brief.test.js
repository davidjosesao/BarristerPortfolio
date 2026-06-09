'use strict';

// --- Mock setup (all three external modules) ---

jest.mock('@vercel/kv', () => ({
  kv: { incr: jest.fn(), expire: jest.fn() },
}));

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  MockAnthropic._mockCreate = mockCreate;
  return MockAnthropic;
});

jest.mock('resend', () => {
  const mockSend = jest.fn();
  const MockResend = jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  }));
  MockResend._mockSend = mockSend;
  return { Resend: MockResend };
});

// --- Shared references to mock internals ---
const { kv } = require('@vercel/kv');
const MockAnthropic = require('@anthropic-ai/sdk');
const mockCreate = MockAnthropic._mockCreate;
const { Resend: MockResend } = require('resend');
const mockSend = MockResend._mockSend;

// --- validateBody ---

const { validateBody } = require('./submit-brief');

const VALID_BODY = {
  yourName: 'Jane Smith',
  yourEmail: 'jane@example.com',
  parties: 'Smith v Jones',
  court: 'NSW Supreme Court',
  jurisdiction: 'NSW',
  matterType: 'Commercial',
  urgency: 'Standard',
  keyFacts: 'A disputed contract.',
};

describe('validateBody', () => {
  test('returns null for a fully valid body', () => {
    expect(validateBody({ ...VALID_BODY })).toBeNull();
  });

  test('returns error when yourName is missing', () => {
    const body = { ...VALID_BODY };
    delete body.yourName;
    expect(validateBody(body)).toEqual({ error: 'yourName is required', field: 'yourName' });
  });

  test('returns error when yourEmail is missing', () => {
    const body = { ...VALID_BODY };
    delete body.yourEmail;
    expect(validateBody(body)).toEqual({ error: 'yourEmail is required', field: 'yourEmail' });
  });

  test('returns error for invalid email format', () => {
    expect(validateBody({ ...VALID_BODY, yourEmail: 'not-an-email' })).toEqual({
      error: 'yourEmail must be a valid email address',
      field: 'yourEmail',
    });
  });

  test('returns error when keyFacts exceeds 1000 characters', () => {
    expect(validateBody({ ...VALID_BODY, keyFacts: 'x'.repeat(1001) })).toEqual({
      error: 'keyFacts must not exceed 1000 characters',
      field: 'keyFacts',
    });
  });

  test('accepts keyFacts of exactly 1000 characters', () => {
    expect(validateBody({ ...VALID_BODY, keyFacts: 'x'.repeat(1000) })).toBeNull();
  });

  test('trims whitespace from string fields in place', () => {
    const body = { ...VALID_BODY, yourName: '  Jane  ', yourEmail: '  jane@example.com  ' };
    expect(validateBody(body)).toBeNull();
    expect(body.yourName).toBe('Jane');
    expect(body.yourEmail).toBe('jane@example.com');
  });

  test('returns error for null body', () => {
    expect(validateBody(null)).toEqual({ error: 'Invalid request body', field: null });
  });

  test('returns error when keyFacts is not a string', () => {
    expect(validateBody({ ...VALID_BODY, keyFacts: 12345 })).toEqual({
      error: 'keyFacts must not exceed 1000 characters',
      field: 'keyFacts',
    });
  });
});

// --- checkRateLimit ---

const { checkRateLimit } = require('./submit-brief');

describe('checkRateLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns false and sets TTL on the first request from an IP', async () => {
    kv.incr.mockResolvedValue(1);
    kv.expire.mockResolvedValue(null);
    const result = await checkRateLimit('1.2.3.4');
    expect(result).toBe(false);
    expect(kv.incr).toHaveBeenCalledWith('ratelimit:1.2.3.4');
    expect(kv.expire).toHaveBeenCalledWith('ratelimit:1.2.3.4', 3600);
  });

  test('returns false and skips expire when count is 2–5', async () => {
    kv.incr.mockResolvedValue(3);
    const result = await checkRateLimit('1.2.3.4');
    expect(result).toBe(false);
    expect(kv.expire).not.toHaveBeenCalled();
  });

  test('returns true when count exceeds 5', async () => {
    kv.incr.mockResolvedValue(6);
    expect(await checkRateLimit('1.2.3.4')).toBe(true);
  });

  test('returns false and logs a warning when KV is unavailable', async () => {
    kv.incr.mockRejectedValue(new Error('KV connection failed'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await checkRateLimit('1.2.3.4')).toBe(false);
    warn.mockRestore();
  });
});

// --- generateSummary ---

const { generateSummary } = require('./submit-brief');

const BRIEF_DATA = {
  yourName: 'Jane Smith',
  firmName: 'Smith & Co',
  parties: 'Smith v Jones',
  court: 'NSW Supreme Court',
  jurisdiction: 'NSW',
  matterType: 'Commercial',
  hearingDate: '2026-09-15',
  urgency: 'Standard',
  keyFacts: 'A disputed contract.',
};

describe('generateSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns Claude response text on success', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: '— Parties: Smith v Jones' }] });
    const result = await generateSummary(BRIEF_DATA);
    expect(result).toBe('— Parties: Smith v Jones');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        temperature: 0,
      })
    );
  });

  test('returns fallback string when Claude API throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await generateSummary(BRIEF_DATA);
    expect(result).toBe('AI summary unavailable — see full details below.');
    errorSpy.mockRestore();
  });

  test('uses "Not set" for missing hearingDate', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: '— summary' }] });
    const data = { ...BRIEF_DATA };
    delete data.hearingDate;
    await generateSummary(data);
    const userMsg = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userMsg).toContain('Hearing date: Not set');
  });

  test('omits firm name from user message when not provided', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: '— summary' }] });
    const data = { ...BRIEF_DATA };
    delete data.firmName;
    await generateSummary(data);
    const userMsg = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userMsg).toContain('Submitter: Jane Smith\n');
  });
});
