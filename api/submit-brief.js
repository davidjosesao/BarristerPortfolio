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

const SYSTEM_PROMPT = `You are a legal assistant helping a barrister quickly understand an incoming brief.
Summarise the following brief submission in exactly 5 bullet points using plain, precise language.
The 5 points must be:
1. Parties — who is involved
2. Matter type and court — what kind of case and where
3. Key facts — the essential facts in one or two sentences
4. What is needed — what the submitter is asking counsel to do
5. Urgency — urgency level and any hearing date

Be concise. Do not add headings. Do not add any text outside the 5 bullet points.
Use "—" as the bullet character.`;

async function generateSummary(data) {
  try {
    const client = new Anthropic();
    const userMessage = `Submitter: ${data.yourName}${data.firmName ? `, ${data.firmName}` : ''}
Parties: ${data.parties}
Court/tribunal: ${data.court}
Jurisdiction: ${data.jurisdiction}
Matter type: ${data.matterType}
Hearing date: ${data.hearingDate || 'Not set'}
Urgency: ${data.urgency}
Key facts: ${data.keyFacts}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    return message.content[0].text;
  } catch (err) {
    console.error('Claude API error:', err.message);
    return 'AI summary unavailable — see full details below.';
  }
}

async function handler(req, res) {
  res.status(501).end();
}

module.exports = handler;
module.exports.validateBody = validateBody;
module.exports.checkRateLimit = checkRateLimit;
module.exports.generateSummary = generateSummary;
