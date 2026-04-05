'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Play } from 'lucide-react';
import { useInView, useReducedMotion } from 'framer-motion';

const PREVIEW_VIDEO_SRC = '/videos/1.mp4';

export function EditorCanvasPreview() {
  const locale = useLocale();
  const isRu = locale === 'ru';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(shellRef, { amount: 0.45 });
  const prefersReducedMotion = useReducedMotion();
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || hasVideoError) {
      return;
    }

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    if (isInView) {
      void video.play().catch(() => {
        // Browsers can still reject autoplay in rare cases.
      });
      return;
    }

    video.pause();
  }, [hasVideoError, isInView, prefersReducedMotion]);

  return (
    <div
      ref={shellRef}
      className="relative h-[520px] w-full overflow-hidden rounded-[26px] border border-white/10 bg-[#05070A]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(124,77,255,0.12),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.08)_0%,rgba(5,7,10,0.12)_38%,rgba(5,7,10,0.42)_100%)]" />

      <div className="relative flex h-full flex-col p-4 md:p-5">
        <div className="relative flex-1 overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,16,22,0.96)_0%,rgba(8,10,16,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {!hasVideoError ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setHasVideoError(true)}
            >
              <source src={PREVIEW_VIDEO_SRC} type="video/mp4" />
            </video>
          ) : (
            <PreviewCanvasPoster isRu={isRu} />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05070A]/34 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05070A] via-[#05070A]/72 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function PreviewCanvasPoster({ isRu }: { isRu: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(124,77,255,0.08),transparent_24%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,16,0.04)_0%,rgba(6,10,16,0.14)_48%,rgba(6,10,16,0.45)_100%)]" />

      <svg
        viewBox="0 0 1200 760"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="previewEdge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(36,161,222,0.86)" />
            <stop offset="100%" stopColor="rgba(108,92,231,0.82)" />
          </linearGradient>
        </defs>
        <path
          d="M700 140 L700 210 L620 210 L620 310"
          fill="none"
          stroke="url(#previewEdge)"
          strokeWidth="4"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
        <path
          d="M620 370 L620 460"
          fill="none"
          stroke="url(#previewEdge)"
          strokeWidth="4"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
        <path
          d="M620 520 L360 520 L360 618"
          fill="none"
          stroke="url(#previewEdge)"
          strokeWidth="4"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
        <path
          d="M680 520 L920 520 L920 618"
          fill="none"
          stroke="url(#previewEdge)"
          strokeWidth="4"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
      </svg>

      <PosterNode
        className="left-[44%] top-[10%] w-[260px]"
        tone="trigger"
        label={isRu ? 'Command Trigger' : 'Command Trigger'}
      />
      <PosterNode
        className="left-[40%] top-[31%] w-[230px]"
        tone="message"
        label={isRu ? 'Приветствие' : 'Welcome'}
      />
      <PosterNode
        className="left-[39.5%] top-[56%] w-[250px]"
        tone="condition"
        label="Condition"
        tags={isRu ? ['Да', 'Нет'] : ['Yes', 'No']}
      />
      <PosterNode
        className="left-[14%] top-[83%] w-[220px]"
        tone="message"
        label={isRu ? 'Каталог' : 'Catalog'}
      />
      <PosterNode
        className="left-[66%] top-[83%] w-[220px]"
        tone="message"
        label={isRu ? 'Поддержка' : 'Support'}
      />

      <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-[32px] border border-[#24A1DE]/25 bg-[#11283B]/75 shadow-[0_0_64px_rgba(36,161,222,0.18)] backdrop-blur-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#7DD5FF]/18 bg-[#0E2130]/95">
            <Play className="ml-1 h-8 w-8 text-[#7DD5FF]" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-5 bottom-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-black/30 backdrop-blur-md">
          <div className="h-full w-[38%] rounded-full bg-[linear-gradient(90deg,#24A1DE,#7C4DFF)] shadow-[0_0_24px_rgba(36,161,222,0.24)]" />
        </div>
      </div>
    </div>
  );
}

function PosterNode({
  className,
  tone,
  label,
  tags,
}: {
  className: string;
  tone: 'trigger' | 'message' | 'condition';
  label: string;
  tags?: string[];
}) {
  const toneStyles = {
    trigger:
      'border-[#6C5CE7]/30 bg-[linear-gradient(180deg,rgba(48,40,104,0.88),rgba(28,24,59,0.92))] shadow-[0_0_36px_rgba(108,92,231,0.12)]',
    message:
      'border-[#1E88E5]/28 bg-[linear-gradient(180deg,rgba(15,41,73,0.86),rgba(10,26,48,0.94))] shadow-[0_0_36px_rgba(30,136,229,0.1)]',
    condition:
      'border-[#D29A22]/28 bg-[linear-gradient(180deg,rgba(69,50,16,0.88),rgba(46,35,13,0.94))] shadow-[0_0_36px_rgba(210,154,34,0.1)]',
  } as const;

  const chipStyles = {
    trigger: 'bg-[#6C5CE7]/16 text-[#B8A8FF]',
    message: 'bg-[#24A1DE]/16 text-[#8BD8FF]',
    condition: 'bg-[#D29A22]/14 text-[#FFD07E]',
  } as const;

  return (
    <div className={`pointer-events-none absolute ${className}`}>
      <div
        className={`rounded-[18px] border px-4 py-4 backdrop-blur-md ${toneStyles[tone]}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${chipStyles[tone]}`}
          >
            <div className="h-3.5 w-3.5 rounded-[4px] border border-current" />
          </div>
          <div className="min-w-0 text-[17px] font-medium tracking-[0.01em] text-white/88">
            {label}
          </div>
        </div>
      </div>

      {tags && (
        <div className="mt-2 flex gap-2 pl-16">
          {tags.map((tag, index) => (
            <span
              key={tag}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                index === 0
                  ? 'border-[#14B8A6]/30 bg-[#14B8A6]/12 text-[#7CF4E3]'
                  : 'border-[#F43F5E]/24 bg-[#F43F5E]/10 text-[#FF9BB0]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
