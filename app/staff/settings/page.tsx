import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { StaffHeader } from '../StaffHeader'
import CalendarSettings from './CalendarSettings'

export default async function StaffSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  // Own row only — the "staff can read own row" RLS policy would refuse
  // anything else, but the explicit filter documents the intent.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('calendar_token')
    .eq('email', user.email ?? '')
    .maybeSingle()

  return (
    <div style={{ minHeight: '100vh' }}>

      <StaffHeader email={user.email ?? ''} />

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '56px 48px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <span className="section-label">Settings</span>
          <h1 style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontSize: '36px', fontWeight: 400, fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1 }}>
            Calendar Feed
          </h1>
        </div>

        <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', padding: '28px' }}>
          <CalendarSettings initialToken={staffRow?.calendar_token ?? null} />
        </div>

      </main>
    </div>
  )
}
