import { BookOpen, Loader2 } from 'lucide-react'

export default function DashboardDocsLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 text-white">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        <aside className="hidden lg:block rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <BookOpen className="h-4 w-4 text-[#24A1DE]" />
            <span>Документация</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-9 rounded-lg bg-white/[0.06]"
                style={{ width: `${86 - index * 5}%` }}
              />
            ))}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950/45 p-6">
          <div className="mb-6 flex items-center gap-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
            <span>Открываю документацию</span>
          </div>
          <div className="h-10 w-2/3 max-w-xl rounded-lg bg-white/[0.08]" />
          <div className="mt-5 space-y-3">
            <div className="h-4 w-full max-w-3xl rounded bg-white/[0.06]" />
            <div className="h-4 w-11/12 max-w-3xl rounded bg-white/[0.06]" />
            <div className="h-4 w-4/5 max-w-3xl rounded bg-white/[0.06]" />
          </div>
        </section>
      </div>
    </div>
  )
}
