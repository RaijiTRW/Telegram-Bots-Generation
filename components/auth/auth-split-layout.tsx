"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "@/components/motion-wrapper";
import { CompactLogo } from "@/components/logo";

type AuthTestimonial = {
  quote: string;
  name: string;
  role: string;
};

interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  homeHref: string;
  footerLink?: {
    label: string;
    href: string;
    linkLabel: string;
    onClick?: () => void;
  };
  side: {
    tagline: string;
    valuesTitle: string;
    values: string[];
    resultsTitle: string;
    results: string[];
    reviewsTitle: string;
    testimonials: AuthTestimonial[];
  };
  children: ReactNode;
}

const TESTIMONIAL_ROTATE_MS = 5000;
const AVATAR_ACCENTS = [
  "from-[#24A1DE] to-[#3DB7FF]",
  "from-[#8B5CF6] to-[#A97CFF]",
  "from-[#0EA5A4] to-[#2DD4BF]",
];

const AUTH_WAVES = [
  {
    className: "left-[-18%] top-[14%] w-[132%]",
    duration: 16,
    delay: 0,
    path: "M0 102C118 82 196 34 304 34C412 34 468 92 583 92C693 92 749 42 858 42C976 42 1060 102 1180 102C1290 102 1384 44 1520 44",
  },
  {
    className: "left-[-12%] top-[34%] w-[126%]",
    duration: 18,
    delay: 1.2,
    path: "M0 120C96 120 166 48 276 48C384 48 444 114 548 114C670 114 722 26 838 26C958 26 1030 108 1148 108C1252 108 1352 58 1480 58",
  },
  {
    className: "left-[-10%] bottom-[16%] w-[128%]",
    duration: 20,
    delay: 0.6,
    path: "M0 84C124 84 192 26 314 26C426 26 494 92 598 92C718 92 786 20 900 20C1020 20 1088 76 1206 76C1320 76 1408 38 1520 38",
  },
];

function getInitials(name: string): string {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export function AuthSplitLayout({
  title,
  subtitle,
  homeHref,
  footerLink,
  side,
  children,
}: AuthSplitLayoutProps) {
  const testimonials = useMemo(
    () => side.testimonials.filter((item) => item.quote.trim().length > 0),
    [side.testimonials],
  );
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    if (testimonials.length <= 1) {
      return;
    }

    const timerId = window.setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, TESTIMONIAL_ROTATE_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [testimonials.length]);

  const currentTestimonial = testimonials[activeTestimonial] || {
    quote: "",
    name: "",
    role: "",
  };

  const mobileHighlights = [...side.values.slice(0, 2), side.results[0]].filter(
    Boolean,
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#05070A] text-white">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-48 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#24A1DE]/16 blur-3xl md:h-96 md:w-96"
          animate={{ scale: [1, 1.22, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-64 right-0 h-80 w-80 rounded-full bg-[#8B5CF6]/16 blur-3xl md:h-[30rem] md:w-[30rem]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 grid h-dvh min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="relative flex h-dvh min-h-0 items-center overflow-hidden px-4 py-3 sm:px-6 md:px-10 lg:px-12 lg:py-6 xl:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-[#24A1DE]/10 blur-3xl" />
            <div className="absolute -bottom-20 right-4 h-56 w-56 rounded-full bg-[#8B5CF6]/10 blur-3xl" />
          </div>
          <div className="relative z-10 mx-auto w-full max-w-md space-y-2.5 lg:mx-0 lg:max-w-xl lg:space-y-4">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-2 py-1.5 transition-colors hover:bg-zinc-900 md:gap-3 md:px-3 md:py-2.5"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-white/72 md:h-8 md:w-8">
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center md:h-8 md:w-8">
                <CompactLogo className="h-5 w-5 md:h-6 md:w-6" idPrefix="auth-split-logo" />
              </span>
              <span className="text-sm font-semibold leading-none text-white md:text-lg">
                CBTooll
              </span>
            </Link>

            <div className="max-w-lg lg:pt-0">
              <h1 className="text-2xl font-semibold leading-[1.06] tracking-[-0.02em] text-white md:text-4xl">
                {title}
              </h1>
              <p className="mt-1 text-xs leading-5 text-zinc-400 sm:text-sm md:mt-2 md:text-base md:leading-6">
                {subtitle}
              </p>
            </div>

            <div className="max-w-lg rounded-[20px] border border-white/10 bg-zinc-900/58 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm md:rounded-2xl md:p-5">
              {children}
            </div>

            {footerLink ? (
              <p className="text-center text-xs text-zinc-400 sm:text-sm lg:text-left">
                {footerLink.label}{" "}
                <Link
                  href={footerLink.href}
                  onClick={
                    footerLink.onClick
                      ? (event) => {
                          event.preventDefault();
                          footerLink.onClick?.();
                        }
                      : undefined
                  }
                  className="font-medium text-[#5EC8FF] hover:text-[#80d7ff] transition-colors"
                >
                  {footerLink.linkLabel}
                </Link>
              </p>
            ) : null}

            {mobileHighlights.length > 0 ? (
              <div className="hidden rounded-[20px] border border-[#24A1DE]/14 bg-[#07111F]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:block lg:hidden">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7DD3FC]/70">
                  {side.valuesTitle}
                </div>
                <div className="mt-3 space-y-2.5">
                  {mobileHighlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2.5 text-sm leading-5 text-white/78"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#57C5FF]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative hidden border-t border-white/10 bg-gradient-to-b from-[#090F1D] via-[#0A1224] to-[#090D19] p-5 md:p-6 lg:block lg:border-l lg:border-t-0">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(61,183,255,0.22),transparent_28%),radial-gradient(circle_at_84%_82%,rgba(139,92,246,0.22),transparent_30%),linear-gradient(180deg,rgba(12,20,38,0.92),rgba(7,11,20,0.96))]" />
            <motion.div
              className="absolute left-[6%] top-[10%] h-44 w-44 rounded-full bg-[#2EA6FF]/18 blur-[90px]"
              animate={{
                x: [0, 18, -10, 0],
                y: [0, -12, 8, 0],
                opacity: [0.32, 0.46, 0.3, 0.32],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute right-[4%] top-[28%] h-56 w-56 rounded-full bg-[#7C5CFF]/16 blur-[110px]"
              animate={{
                x: [0, -22, 8, 0],
                y: [0, 14, -10, 0],
                opacity: [0.24, 0.36, 0.22, 0.24],
              }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-[6%] left-[28%] h-52 w-72 rounded-full bg-[#26D7C8]/10 blur-[120px]"
              animate={{
                x: [0, 12, -14, 0],
                y: [0, -10, 6, 0],
                opacity: [0.18, 0.28, 0.15, 0.18],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            {AUTH_WAVES.map((wave, index) => (
              <motion.svg
                key={wave.path}
                viewBox="0 0 1520 160"
                fill="none"
                className={`absolute ${wave.className} h-[160px] opacity-70`}
                animate={{
                  x: [0, index % 2 === 0 ? 28 : -24, 0],
                  opacity: [0.2, 0.42, 0.2],
                }}
                transition={{
                  duration: wave.duration,
                  delay: wave.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <defs>
                  <linearGradient
                    id={`auth-wave-${index}`}
                    x1="0"
                    y1="0"
                    x2="1520"
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="rgba(36,161,222,0)" />
                    <stop offset="0.22" stopColor="rgba(36,161,222,0.48)" />
                    <stop offset="0.54" stopColor="rgba(126,92,255,0.52)" />
                    <stop offset="0.82" stopColor="rgba(45,212,191,0.34)" />
                    <stop offset="1" stopColor="rgba(45,212,191,0)" />
                  </linearGradient>
                </defs>
                <path
                  d={wave.path}
                  stroke={`url(#auth-wave-${index})`}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </motion.svg>
            ))}
          </div>

          <div className="relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col justify-center">
            <div className="max-w-[40rem]">
              <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/40">
                CBTOOLL
              </div>
              <h2 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.06] text-white md:text-[2.85rem]">
                {side.tagline}
              </h2>
              <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
                <div className="space-y-7">
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/36">
                      {side.valuesTitle}
                    </h3>
                    <ul className="mt-3 space-y-3">
                      {side.values.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-base leading-relaxed text-white/86"
                        >
                          <CheckCircle2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[#57C5FF]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {testimonials.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/36">
                        {side.reviewsTitle}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${activeTestimonial}-${currentTestimonial.name}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.35 }}
                          className="mt-4"
                        >
                          <p className="max-w-lg text-lg leading-[1.7] text-white/88 md:text-[1.3rem]">
                            {currentTestimonial.quote}
                          </p>
                          <div className="mt-4 flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r text-xs font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.25)] ${
                                AVATAR_ACCENTS[
                                  activeTestimonial % AVATAR_ACCENTS.length
                                ]
                              }`}
                            >
                              {getInitials(currentTestimonial.name)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">
                                {currentTestimonial.name}
                              </div>
                              <div className="text-xs uppercase tracking-[0.2em] text-white/38">
                                {currentTestimonial.role}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {testimonials.length > 1 && (
                        <div className="mt-5 flex items-center gap-2">
                          {testimonials.map((item, index) => (
                            <button
                              key={`${item.name}-${index}`}
                              type="button"
                              onClick={() => setActiveTestimonial(index)}
                              className={`h-1.5 rounded-full transition-all ${
                                index === activeTestimonial
                                  ? "w-10 bg-gradient-to-r from-[#57C5FF] to-[#8B5CF6]"
                                  : "w-2 bg-white/20 hover:bg-white/32"
                              }`}
                              aria-label={`Testimonial ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/36">
                    {side.resultsTitle}
                  </h3>
                  <ul className="mt-3 space-y-4">
                    {side.results.map((item, index) => (
                      <li
                        key={item}
                        className="border-b border-white/8 pb-4 last:border-b-0 last:pb-0"
                      >
                        <div className="text-[11px] uppercase tracking-[0.28em] text-white/28">
                          0{index + 1}
                        </div>
                        <div className="mt-1 text-lg leading-snug text-white/90">
                          {item}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
