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

function buildBarristerHtml(data, summary, timestamp) {
  return `<h2 style="font-family: Georgia, serif; font-size: 20px; color: #1C1C1A; margin-bottom: 4px;">New brief submission</h2>
<p style="font-size: 13px; color: #6B6B67; margin-top: 0;">Received ${timestamp} · Submitted by ${data.yourName}</p>
<hr style="border: none; border-top: 1px solid #D4C9A8; margin: 20px 0;">
<h3 style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #6B6B67;">AI Summary</h3>
<div style="font-size: 15px; line-height: 1.7; color: #1C1C1A; white-space: pre-wrap;">${summary}</div>
<hr style="border: none; border-top: 1px solid #D4C9A8; margin: 20px 0;">
<h3 style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #6B6B67;">Full details</h3>
<table style="width: 100%; font-size: 14px; border-collapse: collapse;">
  <tr><td style="padding: 6px 0; color: #6B6B67; width: 160px;">Submitter</td><td>${data.yourName}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Firm</td><td>${data.firmName || '—'}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Email</td><td><a href="mailto:${data.yourEmail}">${data.yourEmail}</a></td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Phone</td><td>${data.yourPhone || '—'}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Parties</td><td>${data.parties}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Court</td><td>${data.court}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Jurisdiction</td><td>${data.jurisdiction}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Matter type</td><td>${data.matterType}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Hearing date</td><td>${data.hearingDate || 'Not set'}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Urgency</td><td>${data.urgency}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67; vertical-align: top;">Key facts</td><td style="white-space: pre-wrap;">${data.keyFacts}</td></tr>
</table>
<hr style="border: none; border-top: 1px solid #D4C9A8; margin: 20px 0;">
<p style="font-size: 12px; color: #6B6B67;">Sent via klooster.com.au</p>`;
}

async function sendBarristerEmail(data, summary, timestamp) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const payload = {
    from: process.env.FROM_EMAIL,
    to: process.env.RECIPIENT_EMAIL,
    subject: `New brief — ${data.matterType} · ${data.parties} · ${data.urgency}`,
    html: buildBarristerHtml(data, summary, timestamp),
  };
  if (process.env.CLERK_EMAIL) payload.bcc = process.env.CLERK_EMAIL;
  await resend.emails.send(payload);
}

async function handler(req, res) {
  res.status(501).end();
}

module.exports = handler;
module.exports.validateBody = validateBody;
module.exports.checkRateLimit = checkRateLimit;
module.exports.generateSummary = generateSummary;
module.exports.sendBarristerEmail = sendBarristerEmail;
