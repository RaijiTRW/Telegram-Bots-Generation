'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    __cbtoollScrollRestore?: {
      key: string;
      y: number;
    };
  }
}

const STORAGE_PREFIX = 'cbtooll:scroll:';

function buildScrollKey(pathname: string, searchParams: ReadonlyURLSearchParams | null) {
  const search = searchParams?.toString();
  return `${STORAGE_PREFIX}${pathname}${search ? `?${search}` : ''}`;
}

export function ScrollRestoration() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const hasRestoredInitiallyRef = useRef(false);

  const storageKey = useMemo(
    () => buildScrollKey(pathname, searchParams),
    [pathname, searchParams]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const persistScroll = () => {
      try {
        window.sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
      } catch {
        // ignore storage issues
      }
    };

    let rafId = 0;

    const handleScroll = () => {
      if (rafId) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        persistScroll();
      });
    };

    persistScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', persistScroll);
    window.addEventListener('beforeunload', persistScroll);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      persistScroll();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', persistScroll);
      window.removeEventListener('beforeunload', persistScroll);
    };
  }, [storageKey]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const clearPendingState = () => {
      root.removeAttribute('data-scroll-restore-pending');
      root.setAttribute('data-scroll-ready', '1');
      if (window.__cbtoollScrollRestore?.key === storageKey) {
        delete window.__cbtoollScrollRestore;
      }
    };

    if (hasRestoredInitiallyRef.current) {
      clearPendingState();
      return;
    }

    hasRestoredInitiallyRef.current = true;

    const bootstrapState = window.__cbtoollScrollRestore;
    const bootstrapValue =
      bootstrapState?.key === storageKey ? bootstrapState.y : null;
    const storedValue =
      bootstrapValue ??
      Number(window.sessionStorage.getItem(storageKey) ?? '0');
    const targetY = Number.isFinite(storedValue) ? Math.max(0, storedValue) : 0;

    if (targetY <= 0) {
      window.requestAnimationFrame(clearPendingState);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let stableFrames = 0;

    const restore = () => {
      if (cancelled) {
        return;
      }

      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const nextY = Math.min(targetY, maxScroll);

      window.scrollTo({ top: nextY, behavior: 'auto' });

      attempts += 1;

      const heightReady = maxScroll >= targetY - 2;
      const closeEnough = Math.abs(window.scrollY - nextY) <= 2;

      if (heightReady && closeEnough) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }

      if (stableFrames >= 3 || attempts >= 120) {
        clearPendingState();
        return;
      }

      window.requestAnimationFrame(restore);
    };

    const beginRestore = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(restore);
      });
    };

    const handleLoad = () => {
      beginRestore();
    };

    beginRestore();
    window.addEventListener('load', handleLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', handleLoad);
      clearPendingState();
    };
  }, [storageKey]);

  return null;
}
