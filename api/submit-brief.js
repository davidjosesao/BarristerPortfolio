'use strict';

const { kv } = require('@vercel/kv');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const REQUIRED_FIELDS = ['yourName', 'yourEmail', 'parties', 'court', 'jurisdiction', 'matterType', 'urgency', 'keyFacts'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBody(body) {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body', field: null };
  for (const key of Object.keys(body)) {
    if (typeof body[key] === 'string') body[key] = body[key].trim();
  }
  for (const field of REQUIRED_FIELDS) {
    if (!body[field]) return { error: `${field} is required`, field };
  }
  if (!EMAIL_RE.test(body.yourEmail)) {
    return { error: 'yourEmail must be a valid email address', field: 'yourEmail' };
  }
  if (typeof body.keyFacts !== 'string' || body.keyFacts.length > 1000) {
    return { error: 'keyFacts must not exceed 1000 characters', field: 'keyFacts' };
  }
  return null;
}

async function checkRateLimit(ip) {
  try {
    const key = `ratelimit:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, 3600);
    return count > 5;
  } catch (err) {
    console.warn('Rate limit check failed (KV unavailable):', err.message);
    return false;
  }
}

async function handler(req, res) {
  res.status(501).end();
}

module.exports = handler;
module.exports.validateBody = validateBody;
module.exports.checkRateLimit = checkRateLimit;
