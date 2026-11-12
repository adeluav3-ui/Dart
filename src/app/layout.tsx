import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const heading = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-heading',
  display: 'swap',
  preload: false,
})

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: {
    template: '%s · GoCart',
    default: 'GoCart',
  },
  description: 'Food, groceries and pharmacy, delivered in Sagamu.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/brand/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GoCart',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B7A47',
}

import { NavigationProgress } from '@/components/NavigationProgress'
import { SplashScreen } from '@/components/SplashScreen'
import { AuthListener } from '@/components/AuthListener'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-NG" className={`${heading.variable} ${body.variable}`} style={{ backgroundColor: '#F6F7F5' }}>
      <body>
        <AuthListener />
        <SplashScreen />
        <NavigationProgress />
        {children}
      </body>
    </html>
  )
}
