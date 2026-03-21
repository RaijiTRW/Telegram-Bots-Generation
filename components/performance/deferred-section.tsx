'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface DeferredSectionProps {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
  className?: string;
}

export function DeferredSection({
  children,
  placeholder = null,
  rootMargin = '1280px 0px',
  className,
}: DeferredSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || isVisible) {
      return;
    }

    const root = document.documentElement;
    const isRestoringScroll =
      root.getAttribute('data-scroll-restore-pending') === '1' ||
      Boolean(window.__cbtoollScrollRestore);

    if (isRestoringScroll) {
      const rafId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(rafId);
    }
  }, [isVisible]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || isVisible) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? children : placeholder}
    </div>
  );
}
