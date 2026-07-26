import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/Providers";
import { ThemeProvider } from "@/components/canvas/ThemeProvider";
import { UnifiedIOProvider } from "@/components/canvas/UnifiedIOProvider";
import { UniversalComponentProvider } from "@/components/canvas/UniversalComponentProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivim Universal Canvas",
  description: "Plugin-based, hot-swappable, live-configurable UI system. The interface is data, not code.",
  keywords: ["Vivim", "Canvas", "Plugin", "Hot-Swap", "Next.js", "TypeScript"],
  authors: [{ name: "Vivim" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
              <ErrorBoundary name="app">
                <Providers>{children}</Providers>
              </ErrorBoundary>
            </UniversalComponentProvider>
          </UnifiedIOProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
