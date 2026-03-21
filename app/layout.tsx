import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { PerformanceMode } from "@/components/performance/performance-mode";
import { ScrollRestoration } from "@/components/scroll/scroll-restoration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "TFlow — Telegram Bot Builder with AI",
  description: "Create Telegram bots in 60 seconds with AI. No code, no servers, just describe what you need.",
};

const performanceModeBootstrapScript = `
(() => {
  try {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2;
    const lowMemory =
      'deviceMemory' in navigator &&
      typeof navigator.deviceMemory === 'number' &&
      navigator.deviceMemory <= 2;
    const connection = navigator.connection || {};
    const saveData = Boolean(connection.saveData);
    const lite = reducedMotion || lowCores || lowMemory || saveData;
    root.setAttribute('data-performance', lite ? 'lite' : 'full');
  } catch (_) {
    document.documentElement.setAttribute('data-performance', 'full');
  }
})();
`;

const scrollRestorationBootstrapScript = `
(() => {
  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const key = 'cbtooll:scroll:' + window.location.pathname + window.location.search;
    const raw = window.sessionStorage.getItem(key);
    const y = raw ? Number(raw) : 0;

    if (Number.isFinite(y) && y > 0) {
      document.documentElement.setAttribute('data-scroll-restore-pending', '1');
      window.__cbtoollScrollRestore = { key, y };
    }
  } catch (_) {
    document.documentElement.removeAttribute('data-scroll-restore-pending');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-performance="full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: performanceModeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: scrollRestorationBootstrapScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <PerformanceMode />
        <Suspense fallback={null}>
          <ScrollRestoration />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
