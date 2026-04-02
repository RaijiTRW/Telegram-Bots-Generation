import type { SeoFaqItem } from '@/lib/site/seo'

export function SeoFaqSection({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: SeoFaqItem[]
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 md:p-8">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400 md:text-base">{subtitle}</p>
      </div>

      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <article key={item.question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-lg font-medium text-white">{item.question}</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-300 md:text-base">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
