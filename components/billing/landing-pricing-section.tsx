"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { motion } from "@/components/motion-wrapper";
import { ArrowRight, CheckCircle2, WalletCards } from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { getAllPlanDefinitions } from "@/lib/billing/plans";
import type { BillingCurrency, PlanCode } from "@/lib/billing/types";

const planAccents: Record<
  PlanCode,
  { border: string; glow: string; icon: string }
> = {
  base: {
    border: "rgba(255,255,255,0.12)",
    glow: "rgba(255,255,255,0.08)",
    icon: "#94A3B8",
  },
  business: {
    border: "rgba(30,136,229,0.34)",
    glow: "rgba(30,136,229,0.18)",
    icon: "#38BDF8",
  },
  enterprise: {
    border: "rgba(124,77,255,0.34)",
    glow: "rgba(124,77,255,0.18)",
    icon: "#A78BFA",
  },
};

function formatPrice(value: number, currency: BillingCurrency, isRu: boolean) {
  if (value === 0) {
    return isRu ? "Бесплатно" : "Free";
  }

  return new Intl.NumberFormat(isRu ? "ru-RU" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function LandingPricingSection() {
  const locale = useLocale();
  const isRu = locale !== "en";
  const currency: BillingCurrency = isRu ? "RUB" : "USD";
  const plans = getAllPlanDefinitions(locale);
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: "280px 0px",
  } as const;

  return (
    <section className="px-4 py-14 md:py-24 relative overflow-hidden cyber-grid cyber-noise">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="mb-8 text-center md:mb-12"
        >
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-mono text-white/65 md:px-4 md:py-2 md:text-sm">
            <WalletCards className="h-4 w-4 text-[#38BDF8]" />
            <span>{isRu ? "Тарифы" : "Pricing"}</span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
              {isRu ? "-75% при оплате за год" : "-75% on yearly billing"}
            </span>
          </div>

          <h2 className="mt-4 text-[2.05rem] font-bold leading-[1.08] tracking-[-0.02em] md:mt-5 md:text-5xl md:leading-tight">
            {isRu ? (
              <>
                Тарифы для{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  запуска, роста и масштаба
                </span>
              </>
            ) : (
              <>
                Pricing for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  launch, growth, and scale
                </span>
              </>
            )}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-white/60 md:mt-5 md:max-w-3xl md:text-lg md:leading-relaxed">
            {isRu
              ? "Base подходит, чтобы быстро собрать и протестировать бота. Business закрывает рабочий контур с CRM, AI и размещением на нашем хостинге. Enterprise нужен тем, кто уже растёт и хочет управлять оплатами, retention и командной аналитикой."
              : "Base is for building and testing fast. Business unlocks the real working stack with CRM, AI, and hosting. Enterprise is for teams that are already growing and need retention, payment control, and deeper analytics."}
          </p>
        </motion.div>

        <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const accent = planAccents[plan.code];
            const monthlyPrice = formatPrice(
              plan.monthlyPrice[currency],
              currency,
              isRu,
            );
            const badge = plan.recommendedBadge || plan.badge;

            return (
              <motion.article
                key={plan.code}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={enterViewport}
                transition={{ duration: 0.38, delay: index * 0.06 }}
                className="relative overflow-hidden rounded-[24px] border bg-zinc-950/74 p-4 backdrop-blur-xl md:rounded-3xl md:p-5"
                style={{
                  borderColor: accent.border,
                  boxShadow: `0 18px 48px ${accent.glow}`,
                }}
              >
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <BorderBeam
                    duration={16 + index * 3}
                    size={280}
                    roundedClassName="rounded-3xl"
                  />
                </div>

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {plan.name}
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        {plan.tagline}
                      </div>
                    </div>
                    {badge ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-200">
                        {badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-end gap-2 md:mt-5">
                    <div className="text-[2rem] font-bold leading-none text-white md:text-4xl">
                      {monthlyPrice}
                    </div>
                    <div className="pb-1 text-sm text-white/45">
                      {isRu ? "/ мес" : "/ mo"}
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/60 md:min-h-[3rem]">
                    {plan.description}
                  </p>

                  <div className="mt-4 grid gap-2 md:mt-5">
                    {plan.spotlightFeatures.slice(0, 3).map((feature) => (
                      <div
                        key={feature}
                        className="flex items-start gap-2 text-sm text-white/78"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0"
                          style={{ color: accent.icon }}
                        />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.36, delay: 0.18 }}
          className="mt-8 flex justify-center"
        >
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
          >
            <span>
              {isRu
                ? "Открыть полное сравнение тарифов"
                : "Open full pricing comparison"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
