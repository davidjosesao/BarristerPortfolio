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
