'use strict';

const { kv } = require('@vercel/kv');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const REQUIRED_FIELDS = ['yourName', 'yourEmail', 'parties', 'court', 'jurisdiction', 'matterType', 'urgency', 'keyFacts'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBody(body) {
  for (const key of Object.keys(body)) {
    if (typeof body[key] === 'string') body[key] = body[key].trim();
  }
  for (const field of REQUIRED_FIELDS) {
    if (!body[field]) return { error: `${field} is required`, field };
  }
  if (!EMAIL_RE.test(body.yourEmail)) {
    return { error: 'yourEmail must be a valid email address', field: 'yourEmail' };
  }
  if (body.keyFacts.length > 1000) {
    return { error: 'keyFacts must not exceed 1000 characters', field: 'keyFacts' };
  }
  return null;
}

async function handler(req, res) {
  res.status(501).end();
}

module.exports = handler;
module.exports.validateBody = validateBody;
