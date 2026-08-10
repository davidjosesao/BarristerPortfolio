import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../lib/staff-auth'
import {
  generateChronology, answerQuestion, MAX_QUESTION_LENGTH,
  type ChronologyBrief,
} from '../../../../../../lib/chronology'

export const runtime = 'nodejs'

const BRIEF_COLUMNS =
  'parties, court, jurisdiction, matter_type, urgency, hearing_date, key_facts'

/**
 * POST with no body  → generate and cache a chronology for the brief.
 * POST with {question} → answer a one-off question; nothing is stored.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const askingQuestion = body.question !== undefined && body.question !== null

  let question = ''
  if (askingQuestion) {
    if (typeof body.question !== 'string' || !body.question.trim()) {
      return NextResponse.json({ error: 'question must be a non-empty string' }, { status: 400 })
    }
    question = body.question.trim()
    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `question must not exceed ${MAX_QUESTION_LENGTH} characters` },
        { status: 400 }
      )
    }
  }

  const { data: brief } = await auth.supabase
    .from('briefs')
    .select(BRIEF_COLUMNS)
    .eq('id', id)
    .maybeSingle<ChronologyBrief>()

  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  if (askingQuestion) {
    try {
      const answer = await answerQuestion(brief, question)
      return NextResponse.json({ answer })
    } catch (e) {
      // Unlike the intake summary, this is not swallowed: staff asked for it
      // and need to know the model failed rather than see an empty panel.
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'The AI request failed' },
        { status: 502 }
      )
    }
  }

  let chronology: string
  try {
    chronology = await generateChronology(brief)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'The AI request failed' },
      { status: 502 }
    )
  }

  // Cached so reopening the brief does not re-bill the provider. A failed
  // save is not fatal — the barrister still gets the chronology they asked
  // for; it will simply be regenerated next time.
  const { error: saveError } = await auth.supabase
    .from('briefs')
    .update({ chronology, chronology_created_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({
    chronology,
    saved: !saveError,
  })
}
