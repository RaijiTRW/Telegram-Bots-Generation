import { ImageResponse } from 'next/og'

import { PUBLIC_SITE } from '@/lib/site/public-config'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(135deg, #05070A 0%, #0B1220 45%, #111827 100%)',
          color: 'white',
          padding: '56px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 18% 20%, rgba(36,161,222,0.35), transparent 28%), radial-gradient(circle at 82% 22%, rgba(139,92,246,0.28), transparent 26%), radial-gradient(circle at 68% 82%, rgba(0,230,118,0.16), transparent 24%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '34px',
            padding: '48px',
            background: 'rgba(7, 10, 16, 0.72)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(36,161,222,0.15)',
                border: '1px solid rgba(36,161,222,0.24)',
                color: '#8FD8FF',
                fontSize: '28px',
                fontWeight: 700,
              }}
            >
              C
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{PUBLIC_SITE.brandName}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.12)',
                padding: '10px 18px',
                fontSize: '20px',
                color: 'rgba(255,255,255,0.78)',
                alignSelf: 'flex-start',
              }}
            >
              Telegram bot builder for leads, booking, FAQ, and business automation
            </div>
            <div style={{ fontSize: '64px', lineHeight: 1.03, fontWeight: 800 }}>
              Create Telegram bots for business without a heavy custom build.
            </div>
            <div style={{ fontSize: '28px', lineHeight: 1.4, color: 'rgba(255,255,255,0.76)' }}>
              Launch faster, automate chat flows, and move users toward leads, booking, payments, and support inside Telegram.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', fontSize: '20px', color: '#8FD8FF' }}>
            <span>Leads</span>
            <span>•</span>
            <span>Booking</span>
            <span>•</span>
            <span>FAQ</span>
            <span>•</span>
            <span>Funnels</span>
            <span>•</span>
            <span>No-code launch</span>
          </div>
        </div>
      </div>
    ),
    size
  )
}
