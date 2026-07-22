import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#18181b',
                    padding: 80,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 88,
                        height: 88,
                        borderRadius: 20,
                        background: '#ffffff',
                        marginBottom: 40,
                    }}
                >
                    <div style={{ width: 44, height: 32, border: '5px solid #18181b', borderRadius: 6 }} />
                </div>
                <div style={{ fontSize: 72, fontWeight: 700, color: '#ffffff', letterSpacing: -2, display: 'flex' }}>
                    {SITE_NAME}
                </div>
                <div style={{ fontSize: 32, color: '#a1a1aa', marginTop: 20, display: 'flex', textAlign: 'center' }}>
                    {SITE_TAGLINE}
                </div>
            </div>
        ),
        { ...size }
    )
}
