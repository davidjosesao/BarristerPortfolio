import { NextResponse } from 'next/server'

const {
  validateBody,
  checkRateLimit,
  generateSummary,
  saveBrief,
  sendBarristerEmail,
  sendConfirmationEmail,
} = require('../../../api/submit-brief')

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request) {
  // request.ip is populated by Vercel from a trusted internal header
  const ip = request.ip ?? (request.headers.get('x-forwarded-for') || '0.0.0.0').split(',')[0].trim()

  const limited = await checkRateLimit(ip)
  if (limited) {
    return NextResponse.json(
      { error: 'Too many submissions. Please email mklooster@chambers.net.au directly.' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const validationError = validateBody(body)
  if (validationError) {
    return NextResponse.json(validationError, { status: 400 })
  }

  const timestamp = new Date().toISOString()
  const submissionId = crypto.randomUUID()
  const summary = await generateSummary(body)

  const saved = await saveBrief(body, summary, timestamp, submissionId)
  if (!saved) {
    return NextResponse.json(
      { error: 'Submission failed. Please email mklooster@chambers.net.au directly.' },
      { status: 500 }
    )
  }

  try {
    await sendBarristerEmail(body, summary, timestamp)
    await sendConfirmationEmail(body, timestamp)
  } catch (err) {
    console.error('Email delivery failed:', err.message)
    return NextResponse.json(
      { error: 'Submission failed. Please email mklooster@chambers.net.au directly.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
