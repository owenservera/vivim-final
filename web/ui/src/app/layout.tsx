import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        style={{ background: 'var(--bg, #fafafa)', color: 'var(--text, #1f2937)' }}
      >
        <ThemeProvider>
          <UnifiedIOProvider>
            <UniversalComponentProvider>
              <Providers>{children}</Providers>
            </UniversalComponentProvider>
          </UnifiedIOProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
