"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "@/components/motion-wrapper";
import { ChevronDown, HelpCircle } from "lucide-react";
import { getLandingFaqItems } from "@/lib/site/faq-content";

export function LandingFaq() {
  const locale = useLocale();
  const isRu = locale === "ru";
  const items = getLandingFaqItems(isRu ? "ru" : "en");
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: "280px 0px",
  } as const;

  return (
    <section className="relative overflow-hidden px-4 py-16 md:py-28 cyber-grid">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm font-medium text-white/82 md:px-4 md:py-2">
            <HelpCircle className="h-4 w-4 text-[#38BDF8]" />
            <span>{isRu ? "Частые вопросы" : "Common questions"}</span>
          </div>
          <h2 className="mt-4 text-[2.05rem] font-bold leading-[1.08] tracking-[-0.02em] md:mt-5 md:text-5xl md:leading-tight">
            {isRu
              ? "Короткие ответы перед запуском Telegram-бота"
              : "Short answers before your Telegram bot launch"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/70 md:mt-5 md:max-w-3xl md:text-lg md:leading-8">
            {isRu
              ? "Небольшой FAQ для бизнеса, который ищет понятный способ создать Telegram-бота для заявок, записи, FAQ и первых продаж."
              : "A compact FAQ for teams looking for a practical way to launch a Telegram bot for leads, booking, FAQ, and early sales."}
          </p>
        </motion.div>

        <div className="mt-8 space-y-3 md:mt-12 md:space-y-4">
          {items.map((item, index) => (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={enterViewport}
              transition={{ duration: 0.34, delay: index * 0.05 }}
            >
              <div
                className={`overflow-hidden rounded-[22px] border shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition-all duration-300 md:rounded-[24px] ${
                  openIndex === index
                    ? "border-[#38BDF8]/20 bg-[linear-gradient(180deg,rgba(14,20,36,0.98),rgba(9,12,22,1))]"
                    : "border-white/10 bg-[linear-gradient(180deg,rgba(13,18,31,0.94),rgba(8,11,20,0.98))]"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenIndex((current) =>
                      current === index ? null : index,
                    )
                  }
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left md:px-5 md:py-5"
                  aria-expanded={openIndex === index}
                >
                  <span className="text-base font-semibold leading-6 text-white md:text-lg md:leading-7">
                    {item.question}
                  </span>
                  <motion.span
                    animate={{
                      rotate: openIndex === index ? 180 : 0,
                      color:
                        openIndex === index
                          ? "#38BDF8"
                          : "rgba(255,255,255,0.55)",
                      borderColor:
                        openIndex === index
                          ? "rgba(56,189,248,0.16)"
                          : "rgba(255,255,255,0.1)",
                      backgroundColor:
                        openIndex === index
                          ? "rgba(56,189,248,0.08)"
                          : "rgba(255,255,255,0.03)",
                    }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border md:h-10 md:w-10"
                  >
                    <ChevronDown className="h-4.5 w-4.5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index ? (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.18, ease: "easeOut" },
                      }}
                      className="overflow-hidden"
                    >
                      <motion.p
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -6, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="max-w-4xl px-4 pb-4 text-sm leading-6 text-white/76 md:px-5 md:pb-5 md:text-base md:leading-7"
                      >
                        {item.answer}
                      </motion.p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
