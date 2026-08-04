import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import './accessibility.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { JsonLd } from '@/components/JsonLd'
import { KeyboardShortcutsPanel } from '@/components/KeyboardShortcutsPanel'
import { Providers } from '@/components/Providers'
import { BackendOfflineCard } from '@/components/canvas/BackendOfflineCard'
import { NetworkStatusBar } from '@/components/canvas/NetworkStatusBar'
import { ThemeProvider } from '@/components/canvas/ThemeProvider'
import { UnifiedIOProvider } from '@/components/canvas/UnifiedIOProvider'
import { UniversalComponentProvider } from '@/components/canvas/UniversalComponentProvider'
import { Toaster } from '@/components/ui/toaster'

const geistSans = localFont({
  src: [
    { path: '../../public/fonts/geist-latin.woff2', style: 'normal' },
    { path: '../../public/fonts/geist-latin-ext.woff2', style: 'normal' },
  ],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = localFont({
  src: [
    { path: '../../public/fonts/geist-mono-latin.woff2', style: 'normal' },
    { path: '../../public/fonts/geist-mono-latin-ext.woff2', style: 'normal' },
  ],
  variable: '--font-geist-mono',
  display: 'swap',
})

const siteUrl = process.env.SITE_HOST ?? 'http://localhost:3000'

export const metadata: Metadata = {
  title: {
    default: 'Vivim Universal Canvas',
    template: '%s | Vivim',
  },
  description:
    'Plugin-based, hot-swappable, live-configurable UI system. The interface is data, not code.',
  keywords: ['Vivim', 'Canvas', 'Plugin', 'Hot-Swap', 'AI', 'Conversation'],
  authors: [{ name: 'Vivim' }],
  creator: 'Vivim',
  icons: {
    icon: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg',
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Vivim',
    title: 'Vivim Universal Canvas',
    description:
      'Plugin-based, hot-swappable, live-configurable UI system. The interface is data, not code.',
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1200,
        height: 630,
        alt: 'Vivim Universal Canvas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vivim Universal Canvas',
    description:
      'Plugin-based, hot-swappable, live-configurable UI system. The interface is data, not code.',
    images: [`${siteUrl}/og.png`],
    creator: '@vivim',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <JsonLd />
        <style>{`
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}</style>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ background: 'var(--bg, #fafafa)', color: 'var(--text, #1f2937)' }}
      >
        {/* Skip navigation link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)] focus:rounded-[var(--radius)]"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <UnifiedIOProvider>
            <UniversalComponentProvider>
              <ErrorBoundary name="app" fullPage>
                <Providers>{children}</Providers>
              </ErrorBoundary>
            </UniversalComponentProvider>
          </UnifiedIOProvider>
        </ThemeProvider>
        <Toaster />
        <NetworkStatusBar />
        <BackendOfflineCard />
        <KeyboardShortcutsPanel />
      </body>
    </html>
  )
}
