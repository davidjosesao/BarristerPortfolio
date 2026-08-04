import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Michael Klooster — Barrister, 8th Floor Garfield Barwick Chambers'

// Rendered at build/request time by Next, so the link preview matches the site
// rather than needing a hand-exported PNG kept in sync by hand.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#181A1C',
          color: '#E8E5DF',
          padding: '0 90px',
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: 'rgba(232,229,223,0.52)',
          }}
        >
          New South Wales Bar · Sydney
        </div>
        <div style={{ fontSize: 104, fontStyle: 'italic', marginTop: 20 }}>
          Michael Klooster
        </div>
        <div style={{ fontSize: 30, marginTop: 22, color: 'rgba(232,229,223,0.72)' }}>
          Barrister · 8th Floor Garfield Barwick Chambers
        </div>
      </div>
    ),
    size,
  )
}
