import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GoCart — Food, Grocery & Pharmacy Delivery in Sagamu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0B7A47',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        {/* Logo wordmark */}
        <div
          style={{
            fontFamily: 'system-ui',
            fontWeight: 800,
            fontSize: 72,
            color: 'white',
            letterSpacing: '-2px',
            marginBottom: 24,
          }}
        >
          gocart
        </div>

        <div
          style={{
            fontFamily: 'system-ui',
            fontWeight: 700,
            fontSize: 36,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.3,
            marginBottom: 20,
          }}
        >
          Food, groceries and pharmacy delivery in Sagamu
        </div>

        <div
          style={{
            fontFamily: 'system-ui',
            fontWeight: 400,
            fontSize: 22,
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          Sagamu, Ogun State, Nigeria
        </div>
      </div>
    ),
    { ...size }
  )
}
