import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileVideo,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DocumentationSidebar } from '@/components/docs/documentation-sidebar'
import type { DocsContent, DocsNodeGroup } from '@/lib/docs/docs-content'
import { getDocsPageDefinitions } from '@/lib/docs/docs-pages'

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{title}</h2>
      <p className="mt-2 text-sm md:text-base text-zinc-400 leading-relaxed">{description}</p>
    </div>
  )
}

function VideoPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/5 p-2 border border-white/10">
          <FileVideo className="w-4 h-4 text-zinc-300" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">{description || 'Видеоинструкция скоро появится. Пока используйте текстовые шаги в этом разделе.'}</div>
        </div>
      </div>
    </div>
  )
}

function InfoList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-zinc-300 leading-relaxed">
          <CheckCircle2 className="w-4 h-4 text-[#24A1DE] mt-0.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function NodeGroupCard({ group }: { group: DocsNodeGroup }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-4 md:p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{group.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{group.description}</p>
      </div>

      <div className="space-y-4">
        {group.items.map((item) => (
          <div id={`node-${item.id}`} key={item.id} className="scroll-mt-28 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-semibold text-white">{item.name}</h4>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                    item.kind === 'preset'
                      ? 'border-[#24A1DE]/30 bg-[#24A1DE]/10 text-[#8fd8ff]'
                      : 'border-violet-400/20 bg-violet-400/10 text-violet-200'
                  }`}>
                    {item.kind}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-300">{item.purpose}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Когда использовать</div>
                <p className="text-sm text-zinc-200 leading-relaxed">{item.whenToUse}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3 xl:col-span-2">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Как настроить</div>
                <ul className="space-y-1.5">
                  {item.setup.map((step) => (
                    <li key={step} className="flex items-start gap-2 text-sm text-zinc-200 leading-relaxed">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-[#24A1DE] shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3">
              <div className="text-xs uppercase tracking-wide text-emerald-300/80 mb-1">Результат / Выход</div>
              <p className="text-sm text-zinc-100 leading-relaxed">{item.output}</p>
            </div>

            {item.notes && item.notes.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/5 p-3">
                <div className="text-xs uppercase tracking-wide text-amber-200/80 mb-2">Важно</div>
                <ul className="space-y-1.5">
                  {item.notes.map((note) => (
                    <li key={note} className="text-sm text-zinc-200 leading-relaxed">• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DocumentationPage({ locale, content }: { locale: string; content: DocsContent }) {
  const isRu = content.locale === 'ru'
  const pages = getDocsPageDefinitions(content)

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl p-6 md:p-8 mb-8">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#24A1DE]/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#8B5CF6]/10 blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-[#24A1DE]" />
              {content.hero.badge}
            </div>

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              {content.hero.title}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-zinc-200 max-w-4xl leading-relaxed">
              {content.hero.subtitle}
            </p>
            <p className="mt-4 text-sm md:text-base text-zinc-400 max-w-4xl leading-relaxed">
              {content.hero.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <a href="#quick-start">
                  {content.hero.actions.quickStart}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
                <Link href={`/${locale}/dashboard`}>{content.hero.actions.openDashboard}</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
                <Link href={`/${locale}/dashboard/bots`}>{content.hero.actions.createBot}</Link>
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              {content.hero.notes.map((note) => (
                <div key={note} className="rounded-xl border border-white/10 bg-zinc-950/50 p-3 text-sm text-zinc-300 leading-relaxed">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <DocumentationSidebar
            content={content}
            locale={locale}
            pages={pages}
            currentPageSlug={null}
          />

          <div className="space-y-8 min-w-0">
            <section id="learning-flow" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.learningFlow.title} description={content.learningFlow.description} />
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
                <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                  <InfoList items={content.learningFlow.steps} />
                </div>
                <VideoPlaceholder title={content.learningFlow.videoNoteTitle} description={content.learningFlow.videoNoteDescription} />
              </div>
            </section>

            <section id="quick-start" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.quickStart.title} description={content.quickStart.description} />
              <div className="space-y-4">
                {content.quickStart.steps.map((step, index) => (
                  <div id={`quickstart-${step.id}`} key={step.id} className="scroll-mt-28 rounded-xl border border-white/10 bg-zinc-950/50 p-4 md:p-5">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/20 flex items-center justify-center text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400">{step.goal}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
                      <div className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{isRu ? 'Что делаете' : 'Actions'}</div>
                          <InfoList items={step.actions} />
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{isRu ? 'Что делает система' : 'System behavior'}</div>
                          <InfoList items={step.systemBehavior} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3">
                          <div className="text-xs uppercase tracking-wide text-emerald-300/80 mb-2">{isRu ? 'Что проверить' : 'Validation checklist'}</div>
                          <InfoList items={step.check} />
                        </div>
                        <VideoPlaceholder title={step.videoSlotTitle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="service-flow" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.serviceFlow.title} description={content.serviceFlow.description} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                {content.serviceFlow.stages.map((stage) => (
                  <div key={stage.title} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                    <h3 className="text-sm font-semibold text-white leading-snug">{stage.title}</h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{stage.description}</p>
                    <div className="mt-3 rounded-lg border border-[#24A1DE]/15 bg-[#24A1DE]/5 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">{isRu ? 'Результат этапа' : 'Stage output'}</div>
                      <div className="text-xs text-zinc-200 leading-relaxed">{stage.output}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="editor-areas" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.editorAreas.title} description={content.editorAreas.description} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {content.editorAreas.cards.map((card) => (
                  <div key={card.id} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                    <h3 className="text-base font-semibold text-white">{card.title}</h3>
                    <div className="mt-1 text-sm text-zinc-400">{card.subtitle}</div>
                    <div className="mt-3 text-sm text-zinc-300 leading-relaxed">
                      <span className="text-zinc-500">{isRu ? 'Когда использовать:' : 'When to use:'}</span> {card.whenToUse}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{isRu ? 'Основные действия' : 'Main actions'}</div>
                      <InfoList items={card.actions} />
                    </div>
                    <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3 text-sm text-zinc-100">
                      <span className="text-emerald-300/80">{isRu ? 'Результат:' : 'Result:'}</span> {card.result}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="ui-components" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.uiComponents.title} description={content.uiComponents.description} />
              <div className="space-y-4">
                {content.uiComponents.cards.map((card) => (
                  <div id={`ui-${card.id}`} key={card.id} className="scroll-mt-28 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">{card.title}</h3>
                        <p className="mt-1 text-sm text-zinc-400">{card.location}</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                        {card.purpose}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{isRu ? 'Как работать' : 'How to use'}</div>
                        <InfoList items={card.howToUse} />
                      </div>
                      <div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-3">
                        <div className="text-xs uppercase tracking-wide text-amber-200/80 mb-2">{isRu ? 'Частые ошибки' : 'Common mistakes'}</div>
                        {card.commonMistakes && card.commonMistakes.length > 0 ? (
                          <ul className="space-y-2">
                            {card.commonMistakes.map((mistake) => (
                              <li key={mistake} className="text-sm text-zinc-200 leading-relaxed">• {mistake}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-zinc-300">{isRu ? 'Нет специальных замечаний.' : 'No special caveats.'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="nodes-reference" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.nodes.title} description={content.nodes.description} />
              <div className="space-y-4">
                {content.nodes.groups.map((group) => (
                  <NodeGroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>

            <section id="keyboards-triggers" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.keyboardsAndTriggers.title} description={content.keyboardsAndTriggers.description} />
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-sm text-zinc-200 leading-relaxed mb-4">
                {content.keyboardsAndTriggers.note}
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Параметр' : 'Topic'}</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">Reply Keyboard</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">Inline Keyboard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.keyboardsAndTriggers.rows.map((row) => (
                      <tr key={row.topic} className="border-b border-white/5 last:border-b-0">
                        <td className="px-4 py-3 text-zinc-200 font-medium align-top">{row.topic}</td>
                        <td className="px-4 py-3 text-zinc-300 align-top leading-relaxed">{row.replyKeyboard}</td>
                        <td className="px-4 py-3 text-zinc-300 align-top leading-relaxed">{row.inlineKeyboard}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="data-security" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.dataAndSecurity.title} description={content.dataAndSecurity.description} />
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Что' : 'Item'}</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Где хранится' : 'Where'}</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Постоянность' : 'Persistence'}</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Видимость' : 'Visibility'}</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-300">{isRu ? 'Комментарий' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.dataAndSecurity.rows.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 last:border-b-0 align-top">
                        <td className="px-4 py-3 text-zinc-200 font-medium">{row.item}</td>
                        <td className="px-4 py-3 text-zinc-300">{row.where}</td>
                        <td className="px-4 py-3 text-zinc-300">{row.persistence}</td>
                        <td className="px-4 py-3 text-zinc-300">{row.visibility}</td>
                        <td className="px-4 py-3 text-zinc-300 leading-relaxed">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="test-deploy" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.testAndDeploy.title} description={content.testAndDeploy.description} />
              <div className="space-y-4">
                {content.testAndDeploy.steps.map((step, index) => (
                  <div key={step.id} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 shrink-0 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-white">{step.title}</h3>
                        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          <InfoList items={step.actions} />
                        </div>
                        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-3 text-sm text-zinc-100 leading-relaxed">
                          <span className="text-emerald-300/80">{isRu ? 'Результат:' : 'Outcome:'}</span> {step.outcome}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <VideoPlaceholder title={step.videoSlotTitle} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.troubleshooting.title} description={content.troubleshooting.description} />
              <div className="space-y-4">
                {content.troubleshooting.items.map((item) => (
                  <div id={`troubleshoot-${item.id}`} key={item.id} className="scroll-mt-28 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
                    <h3 className="text-base font-semibold text-white">{item.question}</h3>
                    <div className="mt-3">
                      <InfoList items={item.answer} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="video-plan" className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-5 md:p-6">
              <SectionHeader title={content.videoPlan.title} description={content.videoPlan.description} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.videoPlan.slots.map((slot) => (
                  <VideoPlaceholder key={slot.id} title={slot.title} description={slot.description} />
                ))}
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  )
}
