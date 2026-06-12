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

// --- sendBarristerEmail ---

const { sendBarristerEmail } = require('./submit-brief');

const EMAIL_DATA = {
  yourName: 'Jane Smith',
  firmName: 'Smith & Co',
  yourEmail: 'jane@example.com',
  yourPhone: '0400 000 000',
  parties: 'Smith v Jones',
  court: 'NSW Supreme Court',
  jurisdiction: 'NSW',
  matterType: 'Commercial',
  hearingDate: '2026-09-15',
  urgency: 'Standard',
  keyFacts: 'A disputed contract.',
};

describe('sendBarristerEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.FROM_EMAIL = 'from@example.com';
    process.env.RECIPIENT_EMAIL = 'barrister@example.com';
    delete process.env.CLERK_EMAIL;
  });

  test('sends to RECIPIENT_EMAIL with correct subject', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendBarristerEmail(EMAIL_DATA, '— summary', '2026-06-09T00:00:00.000Z');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'barrister@example.com',
        subject: 'New brief — Commercial · Smith v Jones · Standard',
      })
    );
  });

  test('includes BCC when CLERK_EMAIL env var is set', async () => {
    process.env.CLERK_EMAIL = 'clerk@example.com';
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendBarristerEmail(EMAIL_DATA, '— summary', '2026-06-09T00:00:00.000Z');
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ bcc: 'clerk@example.com' }));
  });

  test('omits bcc property when CLERK_EMAIL is not set', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendBarristerEmail(EMAIL_DATA, '— summary', '2026-06-09T00:00:00.000Z');
    expect(mockSend.mock.calls[0][0].bcc).toBeUndefined();
  });

  test('includes AI summary in HTML body', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendBarristerEmail(EMAIL_DATA, '— Parties: Smith v Jones', '2026-06-09T00:00:00.000Z');
    expect(mockSend.mock.calls[0][0].html).toContain('— Parties: Smith v Jones');
  });

  test('includes all form fields in the details table', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendBarristerEmail(EMAIL_DATA, '— summary', '2026-06-09T00:00:00.000Z');
    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain('Smith v Jones');
    expect(html).toContain('NSW Supreme Court');
    expect(html).toContain('jane@example.com');
    expect(html).toContain('0400 000 000');
  });

  test('shows "Not set" for missing hearingDate', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    const data = { ...EMAIL_DATA };
    delete data.hearingDate;
    await sendBarristerEmail(data, '— summary', '2026-06-09T00:00:00.000Z');
    expect(mockSend.mock.calls[0][0].html).toContain('Not set');
  });

  test('throws when Resend returns an error', async () => {
    mockSend.mockRejectedValue(new Error('Resend delivery failure'));
    await expect(
      sendBarristerEmail(EMAIL_DATA, '— summary', '2026-06-09T00:00:00.000Z')
    ).rejects.toThrow('Resend delivery failure');
  });
});

// --- sendConfirmationEmail ---

const { sendConfirmationEmail } = require('./submit-brief');

describe('sendConfirmationEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.FROM_EMAIL = 'from@example.com';
  });

  test('sends plain-text email to the submitter with correct subject', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendConfirmationEmail(
      { yourName: 'Jane Smith', yourEmail: 'jane@example.com', parties: 'Smith v Jones' },
      '2026-06-09T00:00:00.000Z'
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'Brief received — Michael Klooster',
      })
    );
  });

  test('email body contains parties, timestamp, and direct contact details', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendConfirmationEmail(
      { yourName: 'Jane Smith', yourEmail: 'jane@example.com', parties: 'Smith v Jones' },
      '2026-06-09T00:00:00.000Z'
    );
    const { text } = mockSend.mock.calls[0][0];
    expect(text).toContain('Smith v Jones');
    expect(text).toContain('2026-06-09T00:00:00.000Z');
    expect(text).toContain('mklooster@chambers.net.au');
    expect(text).toContain('reception@8gbc.com.au');
    expect(text).toContain('53 Martin Place');
  });

  test('sends as plain text (no html property)', async () => {
    mockSend.mockResolvedValue({ id: 'abc' });
    await sendConfirmationEmail(
      { yourName: 'Jane', yourEmail: 'jane@example.com', parties: 'A v B' },
      '2026-06-09T00:00:00.000Z'
    );
    expect(mockSend.mock.calls[0][0].html).toBeUndefined();
  });

  test('throws when Resend returns an error', async () => {
    mockSend.mockRejectedValue(new Error('Resend delivery failure'));
    await expect(
      sendConfirmationEmail(
        { yourName: 'Jane', yourEmail: 'jane@example.com', parties: 'A v B' },
        '2026-06-09T00:00:00.000Z'
      )
    ).rejects.toThrow('Resend delivery failure');
  });
});
