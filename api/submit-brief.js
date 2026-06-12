'use strict';

const { kv } = require('@vercel/kv');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const REQUIRED_FIELDS = ['yourName', 'yourEmail', 'parties', 'court', 'jurisdiction', 'matterType', 'urgency', 'keyFacts'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LIMITS = {
  yourName: 120, yourEmail: 254, parties: 200, court: 100,
  jurisdiction: 50, matterType: 50, urgency: 50,
  firmName: 120, yourPhone: 30,
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    if (body[field] && typeof body[field] === 'string' && body[field].length > max) {
      return { error: `${field} must not exceed ${max} characters`, field };
    }
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
  const name       = escHtml(data.yourName);
  const firm       = data.firmName ? escHtml(data.firmName) : '—';
  const email      = escHtml(data.yourEmail);
  const phone      = data.yourPhone ? escHtml(data.yourPhone) : '—';
  const parties    = escHtml(data.parties);
  const court      = escHtml(data.court);
  const juris      = escHtml(data.jurisdiction);
  const matter     = escHtml(data.matterType);
  const hearing    = data.hearingDate ? escHtml(data.hearingDate) : 'Not set';
  const urgency    = escHtml(data.urgency);
  const facts      = escHtml(data.keyFacts);
  const ts         = escHtml(timestamp);
  // summary comes from Claude — escape defensively in case of unexpected output
  const safeSum    = escHtml(summary);

  return `<h2 style="font-family: Georgia, serif; font-size: 20px; color: #1C1C1A; margin-bottom: 4px;">New brief submission</h2>
<p style="font-size: 13px; color: #6B6B67; margin-top: 0;">Received ${ts} · Submitted by ${name}</p>
<hr style="border: none; border-top: 1px solid #D4C9A8; margin: 20px 0;">
<h3 style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #6B6B67;">AI Summary</h3>
<div style="font-size: 15px; line-height: 1.7; color: #1C1C1A; white-space: pre-wrap;">${safeSum}</div>
<hr style="border: none; border-top: 1px solid #D4C9A8; margin: 20px 0;">
<h3 style="font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #6B6B67;">Full details</h3>
<table style="width: 100%; font-size: 14px; border-collapse: collapse;">
  <tr><td style="padding: 6px 0; color: #6B6B67; width: 160px;">Submitter</td><td>${name}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Firm</td><td>${firm}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Phone</td><td>${phone}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Parties</td><td>${parties}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Court</td><td>${court}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Jurisdiction</td><td>${juris}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Matter type</td><td>${matter}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Hearing date</td><td>${hearing}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67;">Urgency</td><td>${urgency}</td></tr>
  <tr><td style="padding: 6px 0; color: #6B6B67; vertical-align: top;">Key facts</td><td style="white-space: pre-wrap;">${facts}</td></tr>
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

async function sendConfirmationEmail(data, timestamp) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: data.yourEmail,
    subject: 'Brief received — Michael Klooster',
    text: `Hi ${data.yourName},

Your brief submission has been received.

Matter: ${data.parties}
Submitted: ${timestamp}

Michael or a member of chambers will be in touch shortly.

If you need to follow up directly:
Michael Klooster — (02) 8239 3256 · mklooster@chambers.net.au
Chambers clerk — (02) 8239 3200 · reception@8gbc.com.au

—
8th Floor Garfield Barwick Chambers
Level 8 · 53 Martin Place · Sydney NSW 2000
https://www.8garfieldbarwick.com.au`,
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

  const limited = await checkRateLimit(ip);
  if (limited) {
    return res.status(429).json({
      error: 'Too many submissions. Please email mklooster@chambers.net.au directly.',
    });
  }

  const body = req.body || {};
  const validationError = validateBody(body);
  if (validationError) return res.status(400).json(validationError);

  const timestamp = new Date().toISOString();
  const summary = await generateSummary(body);

  try {
    await sendBarristerEmail(body, summary, timestamp);
    await sendConfirmationEmail(body, timestamp);
  } catch (err) {
    console.error('Email delivery failed:', err.message);
    return res.status(500).json({
      error: 'Submission failed. Please email mklooster@chambers.net.au directly.',
    });
  }

  return res.status(200).json({ success: true });
}

module.exports = handler;
module.exports.validateBody = validateBody;
module.exports.checkRateLimit = checkRateLimit;
module.exports.generateSummary = generateSummary;
module.exports.sendBarristerEmail = sendBarristerEmail;
module.exports.sendConfirmationEmail = sendConfirmationEmail;
module.exports.escHtml = escHtml;
