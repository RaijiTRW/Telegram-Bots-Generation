import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Inter, Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PerformanceMode } from "@/components/performance/performance-mode";
import { ScrollRestoration } from "@/components/scroll/scroll-restoration";
import { AbortErrorSuppressor } from "@/components/supabase/abort-error-suppressor";
import { PUBLIC_SITE } from "@/lib/site/public-config";
import { absoluteUrl } from "@/lib/site/seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE.siteUrl),
  title: PUBLIC_SITE.brandName,
  applicationName: PUBLIC_SITE.brandName,
  description: "Create Telegram bots for leads, booking, FAQ, payments, and funnels without a heavy custom build.",
  keywords: [
    "telegram bot builder",
    "создание telegram ботов",
    "create telegram bot",
    "конструктор telegram ботов",
    "telegram bot for business",
    "cbtooll",
  ],
  openGraph: {
    title: PUBLIC_SITE.brandName,
    description: "Create Telegram bots for business without code: leads, booking, FAQ, funnels, and analytics.",
    url: absoluteUrl(),
    siteName: PUBLIC_SITE.siteName,
    type: "website",
    images: [absoluteUrl("/opengraph-image")],
  },
  twitter: {
    card: "summary_large_image",
    title: PUBLIC_SITE.brandName,
    description: "Create Telegram bots for business without code: leads, booking, FAQ, funnels, and analytics.",
    images: [absoluteUrl("/twitter-image")],
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: [{ url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
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

const abortErrorSuppressorBootstrapScript = `
(() => {
  const isAbortLike = (value) => {
    if (!value) return false;
    const text = typeof value === 'string'
      ? value
      : [value.name, value.code, value.message].filter(Boolean).join(' ');
    return (
      text.includes('AbortError') ||
      text.includes('ABORT_ERR') ||
      text.includes('signal is aborted without reason') ||
      text.includes('The operation was aborted') ||
      text.includes('This operation was aborted')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (!isAbortLike(event.reason)) return;
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    if (!isAbortLike(event.error) && !isAbortLike(event.message)) return;
    event.preventDefault();
  });
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'ru';

  return (
    <html lang={locale} data-performance="full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: abortErrorSuppressorBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: performanceModeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: scrollRestorationBootstrapScript }} />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={`${inter.variable} ${geist.variable} ${jetBrainsMono.variable} antialiased`}>
        <PerformanceMode />
        <AbortErrorSuppressor />
        <Suspense fallback={null}>
          <ScrollRestoration />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
