import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { StaffHeader } from '../StaffHeader'
import DeadlinesView from './DeadlinesView'
import { todayInChambers } from '../../../lib/chambers-time'

export default async function DeadlinesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, parties, court, matter_type, urgency, status, hearing_date, your_name')
    .not('hearing_date', 'is', null)
    .order('hearing_date', { ascending: true })

  // Resolved once per request, in the chambers' timezone rather than the
  // server's — see lib/chambers-time.ts. Passed down as a plain date string
  // since the client component re-derives "today" in the browser's own zone
  // for calendar-grid math, but needs the chambers date for the "is this
  // overdue" comparisons that mirror the server logic.
  const today = todayInChambers()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div style={{ minHeight: '100vh' }}>

      <StaffHeader email={user.email ?? ''} />

      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '56px 48px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <span className="section-label">Deadlines</span>
          <h1 style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontSize: '36px', fontWeight: 400, fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1 }}>
            Key Dates
          </h1>
        </div>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: '14px' }}>Failed to load briefs: {error.message}</p>
        )}

        {briefs && briefs.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No briefs with a hearing date.</p>
        )}

        {briefs && briefs.length > 0 && (
          <DeadlinesView
            briefs={briefs as Array<{
              id: string
              parties: string
              court: string
              matter_type: string
              urgency: string
              status: string
              hearing_date: string
              your_name: string
            }>}
            today={todayIso}
          />
        )}

      </main>
    </div>
  )
}
