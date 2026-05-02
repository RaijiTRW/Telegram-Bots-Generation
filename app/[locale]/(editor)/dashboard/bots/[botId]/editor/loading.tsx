import { Bot, Loader2 } from 'lucide-react'

export default function BotEditorLoading() {
  return (
    <div className="flex h-screen flex-col bg-[#05070A] text-white">
      <header className="h-16 shrink-0 border-b border-white/10 bg-zinc-950/80 px-6 backdrop-blur-xl">
        <div className="flex h-full items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#24A1DE]/30 bg-[#24A1DE]/10">
            <Bot className="h-4 w-4 text-[#24A1DE]" />
          </div>
          <div>
            <div className="h-4 w-36 rounded bg-white/10" />
            <div className="mt-2 h-3 w-52 rounded bg-white/[0.06]" />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-zinc-950/50 p-4 lg:block">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-12 rounded-xl bg-white/[0.06]"
                style={{ opacity: 1 - index * 0.08 }}
              />
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
            <span>Открываю редактор</span>
          </div>
        </main>
      </div>
    </div>
  )
}
