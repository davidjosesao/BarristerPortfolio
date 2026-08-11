'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import DeadlineRow from './DeadlineRow'
import { parseHearingDate, daysUntil } from '../../../lib/chambers-time'

type Brief = {
  id: string
  parties: string
  court: string
  matter_type: string
  urgency: string
  status: string
  hearing_date: string
  your_name: string
}

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  new:      { color: 'var(--status-warning)', bg: 'rgba(var(--status-warning-rgb),0.08)', border: 'rgba(var(--status-warning-rgb),0.25)' },
  reviewed: { color: 'var(--gold)', bg: 'rgba(var(--gold-rgb),0.08)', border: 'rgba(var(--gold-rgb),0.2)' },
  accepted: { color: 'var(--status-success)', bg: 'rgba(var(--status-success-rgb),0.08)', border: 'rgba(var(--status-success-rgb),0.25)' },
  declined: { color: 'var(--error)', bg: 'rgba(var(--error-rgb),0.08)', border: 'rgba(var(--error-rgb),0.2)' },
}

// Stable colour per matter type, derived from a small fixed palette rather
// than random hashing so the same type always reads the same colour across
// sessions.
const TYPE_PALETTE = ['var(--status-warning)', 'var(--status-success)', '#8FB4D9', '#D9A0C4', '#D9976A', '#9AA8D9', '#B4D97A']

function colorForType(type: string, allTypes: string[]): string {
  const idx = allTypes.indexOf(type)
  return TYPE_PALETTE[idx % TYPE_PALETTE.length]
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.reviewed
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '3px',
      padding: '3px 8px',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

function UrgencyBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color,
      background: `${color}14`,
      border: `1px solid ${color}40`,
      borderRadius: '3px',
      padding: '3px 8px',
      whiteSpace: 'nowrap',
      marginLeft: '8px',
    }}>
      {label}
    </span>
  )
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Builds a 6x7 grid of dates covering the month, starting on the Monday
// on/before the 1st, so partial weeks at the edges still line up under the
// weekday headers.
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = (monthStart.getDay() + 6) % 7 // Mon=0 .. Sun=6
  const gridStart = new Date(monthStart)
  gridStart.setDate(gridStart.getDate() - firstWeekday)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

export default function DeadlinesView({ briefs, today }: { briefs: Brief[]; today: string }) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const todayDate = useMemo(() => parseHearingDate(today), [today])
  const [month, setMonth] = useState(() => startOfMonth(todayDate))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const allTypes = useMemo(
    () => Array.from(new Set(briefs.map(b => b.matter_type))).sort(),
    [briefs]
  )
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => new Set(allTypes))

  // allTypes can grow after first render (e.g. fast refresh with new data);
  // briefs of a type not yet seen by the filter should still show up rather
  // than silently vanishing.
  const visibleTypes = useMemo(
    () => (activeTypes.size === 0 ? new Set(allTypes) : activeTypes),
    [activeTypes, allTypes]
  )

  const filtered = useMemo(
    () => briefs.filter(b => visibleTypes.has(b.matter_type)),
    [briefs, visibleTypes]
  )

  const byDay = useMemo(() => {
    const map = new Map<string, Brief[]>()
    for (const b of filtered) {
      const key = b.hearing_date
      const list = map.get(key)
      if (list) list.push(b)
      else map.set(key, [b])
    }
    return map
  }, [filtered])

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const base = prev.size === 0 ? new Set(allTypes) : new Set(prev)
      if (base.has(type)) base.delete(type)
      else base.add(type)
      return base
    })
  }

  function dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const grid = useMemo(() => buildMonthGrid(month), [month])
  const selectedItems = selectedDay ? (byDay.get(dateKey(selectedDay)) ?? []) : []

  return (
    <div>
      {/* Controls: view toggle + type filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
          {(['calendar', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '8px 18px',
                border: 'none',
                cursor: 'pointer',
                background: view === v ? 'rgba(var(--status-warning-rgb),0.1)' : 'transparent',
                color: view === v ? 'var(--status-warning)' : 'var(--muted)',
              }}
            >
              {v === 'calendar' ? 'Calendar' : 'List'}
            </button>
          ))}
        </div>

        {allTypes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginRight: '4px' }}>
              Filter
            </span>
            {allTypes.map(type => {
              const active = visibleTypes.has(type)
              const color = colorForType(type, allTypes)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    border: `1px solid ${active ? `${color}55` : 'var(--rule)'}`,
                    background: active ? `${color}14` : 'transparent',
                    color: active ? color : 'var(--muted)',
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {type}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {view === 'list' && (
        <>
          {filtered.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No briefs match the current filter.</p>
          )}

          {filtered.length > 0 && (
            <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '190px 1fr 160px 110px 100px 32px',
                gap: '16px',
                padding: '10px 20px',
                borderBottom: '1px solid var(--rule)',
                background: 'rgba(var(--ink-rgb),0.02)',
              }}>
                {['Hearing date', 'Parties', 'Court', 'Matter', 'Status', ''].map(h => (
                  <span key={h} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
                ))}
              </div>

              {filtered.map((b, i) => {
                const hearing = parseHearingDate(b.hearing_date)
                const diffDays = daysUntil(hearing, todayDate)

                let badge: { label: string; color: string } | null = null
                if (diffDays < 0) badge = { label: 'Overdue', color: 'var(--error)' }
                else if (diffDays <= 7) badge = { label: 'This week', color: 'var(--status-warning)' }

                return (
                  <DeadlineRow key={b.id} href={`/staff/briefs/${b.id}`} isLast={i === filtered.length - 1}>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {hearing.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {badge && <UrgencyBadge label={badge.label} color={badge.color} />}
                    </span>
                    <div>
                      <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>{b.parties}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.your_name}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.court}</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.matter_type}</span>
                    <StatusBadge status={b.status} />
                    <span style={{ fontSize: '16px', color: 'var(--dim)' }}>→</span>
                  </DeadlineRow>
                )
              })}
            </div>
          )}
        </>
      )}

      {view === 'calendar' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                aria-label="Previous month"
                style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: '4px', color: 'var(--muted)', cursor: 'pointer', padding: '6px 10px', fontSize: '14px' }}
              >
                ←
              </button>
              <span style={{ fontSize: '15px', color: 'var(--cream)', minWidth: '150px', textAlign: 'center' }}>
                {month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                aria-label="Next month"
                style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: '4px', color: 'var(--muted)', cursor: 'pointer', padding: '6px 10px', fontSize: '14px' }}
              >
                →
              </button>
            </div>
            <button
              onClick={() => { setMonth(startOfMonth(todayDate)); setSelectedDay(todayDate) }}
              style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: '4px', color: 'var(--muted)', cursor: 'pointer', padding: '6px 12px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              Today
            </button>
          </div>

          <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(var(--ink-rgb),0.02)' }}>
              {WEEKDAY_LABELS.map(w => (
                <div key={w} style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--rule)' }}>
                  {w}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === month.getMonth()
                const items = byDay.get(dateKey(d)) ?? []
                const isToday = sameDay(d, todayDate)
                const isSelected = selectedDay ? sameDay(d, selectedDay) : false
                const isOverdue = d < todayDate && items.length > 0

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(items.length > 0 ? d : null)}
                    style={{
                      textAlign: 'left',
                      minHeight: '84px',
                      minWidth: 0,
                      padding: '8px',
                      border: 'none',
                      borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--rule)',
                      borderBottom: i < 35 ? '1px solid var(--rule)' : 'none',
                      background: isSelected ? 'rgba(var(--status-warning-rgb),0.08)' : 'transparent',
                      cursor: items.length > 0 ? 'pointer' : 'default',
                      opacity: inMonth ? 1 : 0.35,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      fontSize: '12px',
                      fontVariantNumeric: 'tabular-nums',
                      color: isToday ? 'var(--status-warning)' : 'var(--muted)',
                      fontWeight: isToday ? 600 : 400,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isToday ? '1px solid rgba(var(--status-warning-rgb),0.4)' : 'none',
                    }}>
                      {d.getDate()}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      {items.slice(0, 3).map(b => (
                        <span
                          key={b.id}
                          style={{
                            display: 'block',
                            fontSize: '10px',
                            color: colorForType(b.matter_type, allTypes),
                            background: `${colorForType(b.matter_type, allTypes)}14`,
                            border: `1px solid ${colorForType(b.matter_type, allTypes)}30`,
                            borderRadius: '2px',
                            padding: '2px 5px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {b.parties}
                        </span>
                      ))}
                      {items.length > 3 && (
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>+{items.length - 3} more</span>
                      )}
                      {isOverdue && (
                        <span style={{ fontSize: '10px', color: 'var(--error)' }}>Overdue</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDay && (
            <div style={{ marginTop: '24px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                {selectedDay.toLocaleDateString('en-AU', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </h2>

              {selectedItems.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Nothing due this day.</p>
              ) : (
                <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
                  {selectedItems.map((b, i) => (
                    <Link
                      key={b.id}
                      href={`/staff/briefs/${b.id}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 160px 130px 100px 32px',
                        gap: '16px',
                        alignItems: 'center',
                        padding: '14px 20px',
                        borderBottom: i === selectedItems.length - 1 ? 'none' : '1px solid var(--rule)',
                        textDecoration: 'none',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>{b.parties}</span>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.your_name}</span>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.court}</span>
                      <span style={{ fontSize: '13px', color: colorForType(b.matter_type, allTypes) }}>{b.matter_type}</span>
                      <StatusBadge status={b.status} />
                      <span style={{ fontSize: '16px', color: 'var(--dim)' }}>→</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
