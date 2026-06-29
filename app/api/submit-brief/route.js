import { NextResponse } from 'next/server'

// Re-use the validated handler logic from the existing file
const {
  validateBody,
  checkRateLimit,
  generateSummary,
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
  const ip = (request.headers.get('x-forwarded-for') || '0.0.0.0').split(',')[0].trim()

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
  const summary = await generateSummary(body)

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
