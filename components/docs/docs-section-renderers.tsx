import {
  ChevronDown,
  CheckCircle2,
  FileVideo,
} from 'lucide-react'

import { DocsInlineText } from '@/components/docs/docs-inline-text'
import type {
  DocsContent,
  DocsNodeGroup,
  DocsQuickStartStep,
  DocsSupportStep,
} from '@/lib/docs/docs-content'
import type { DocsPageSectionId } from '@/lib/docs/docs-pages'
import type { ReactElement } from 'react'

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">{title}</h2>
      <p className="mt-3 text-[15px] md:text-base text-zinc-300 leading-7 max-w-[72ch]">
        <DocsInlineText text={description} />
      </p>
    </div>
  )
}

export function VideoPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-colors">
      <div className="flex items-start gap-4">
        <div className="mt-1 rounded-xl bg-white/5 p-2.5 border border-white/10 shrink-0">
          <FileVideo className="w-5 h-5 text-zinc-300" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-medium text-white">{title}</div>
          <div className="mt-2 text-sm text-zinc-400 leading-relaxed">
            <DocsInlineText
              text={description || 'Видеоинструкция скоро появится. Пока используйте текстовые шаги в этом разделе.'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function InfoList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm md:text-[15px] text-zinc-300 leading-7">
          <CheckCircle2 className="w-5 h-5 text-[#24A1DE] mt-0.5 shrink-0 opacity-80" />
          <span><DocsInlineText text={item} /></span>
        </li>
      ))}
    </ul>
  )
}

function CollapsibleList({
  items,
  isRu,
  visibleCount = 2,
}: {
  items: string[]
  isRu: boolean
  visibleCount?: number
}) {
  const visibleItems = items.slice(0, visibleCount)
  const hiddenItems = items.slice(visibleCount)

  return (
    <>
      <InfoList items={visibleItems} />
      {hiddenItems.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/10 bg-zinc-950/40 p-3 group transition-all duration-300">
          <summary className="list-none cursor-pointer flex items-center justify-between gap-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors [&::-webkit-details-marker]:hidden">
            <span>
              {isRu ? 'Показать подробнее' : 'Show more'} ({hiddenItems.length})
            </span>
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 pt-3 border-t border-white/10">
            <InfoList items={hiddenItems} />
          </div>
        </details>
      )}
    </>
  )
}

function CompactDetails({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string
  subtitle?: string
  children: ReactElement | ReactElement[]
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5 group transition-all duration-300 shadow-sm"
    >
      <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-white group-hover:text-zinc-200 transition-colors">{title}</div>
            {subtitle && <div className="mt-1.5 text-base text-zinc-400 leading-relaxed">{subtitle}</div>}
          </div>
          <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors">
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </div>
        </div>
      </summary>
      <div className="mt-5 pt-5 border-t border-white/10">{children}</div>
    </details>
  )
}

function NodeGroupCard({ group, isRu }: { group: DocsNodeGroup; isRu: boolean }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white tracking-wide">{group.title}</h3>
        <p className="mt-3 text-base text-zinc-400 leading-relaxed max-w-3xl">{group.description}</p>
      </div>

      <div className="space-y-4">
        {group.items.map((item) => (
          <details
            id={`node-${item.id}`}
            key={item.id}
            className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-950/50 p-5 lg:p-6 group transition-all duration-300"
          >
            <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-lg font-semibold text-white">{item.name}</h4>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${item.kind === 'preset'
                        ? 'border-[#24A1DE]/30 bg-[#24A1DE]/10 text-[#8fd8ff]'
                        : 'border-violet-400/20 bg-violet-400/10 text-violet-200'
                        }`}
                    >
                      {item.kind}
                    </span>
                  </div>
                  <p className="mt-3 text-base text-zinc-300 leading-relaxed line-clamp-2">{item.purpose}</p>
                  <p className="mt-2 text-sm text-zinc-500 flex items-center gap-1.5">
                    <span className="font-medium text-zinc-400">{isRu ? 'Когда использовать:' : 'When to use:'}</span> {item.whenToUse}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors">
                  <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
                </div>
              </div>
            </summary>

            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-2.5">
                  {isRu ? 'Когда использовать' : 'When to use'}
                </div>
                <p className="text-base text-zinc-300 leading-relaxed">{item.whenToUse}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-4">
                  {isRu ? 'Как настроить' : 'How to configure'}
                </div>
                <CollapsibleList items={item.setup} isRu={isRu} visibleCount={2} />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5 shadow-sm">
              <div className="text-sm font-semibold tracking-wide text-emerald-400 mb-2">
                {isRu ? 'Результат / Выход' : 'Result / Output'}
              </div>
              <p className="text-base text-zinc-200 leading-relaxed">{item.output}</p>
            </div>

            {item.notes && item.notes.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/5 p-5 shadow-sm">
                <div className="text-sm font-semibold tracking-wide text-amber-400 mb-3">
                  {isRu ? 'Важно' : 'Important'}
                </div>
                <ul className="space-y-2">
                  {item.notes.map((note) => (
                    <li key={note} className="text-base text-zinc-300 leading-relaxed flex items-start gap-2">
                      <span className="text-amber-400/50 mt-1">•</span> {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  )
}

function QuickStartStepCard({
  step,
  index,
  isRu,
}: {
  step: DocsQuickStartStep
  index: number
  isRu: boolean
}) {
  return (
    <div
      id={`quickstart-${step.id}`}
      className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-950/50 p-6 md:p-8 shadow-sm"
    >
      <div className="flex items-start gap-5">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30 flex items-center justify-center text-lg font-bold text-white shadow-inner">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-2xl font-semibold text-white tracking-wide">{step.title}</h3>
          <p className="mt-2 text-base text-zinc-400 leading-relaxed">{step.goal}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-4">
            {isRu ? 'Быстрое действие' : 'Quick action'}
          </div>
          <CollapsibleList items={step.actions} isRu={isRu} visibleCount={2} />
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="text-sm font-semibold tracking-wide text-emerald-400 mb-4">
            {isRu ? 'Что проверить' : 'Check'}
          </div>
          <CollapsibleList items={step.check} isRu={isRu} visibleCount={2} />
        </div>
      </div>

      <details className="mt-5 rounded-xl border border-white/10 bg-zinc-900/40 p-5 group transition-all duration-300">
        <summary className="list-none cursor-pointer flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="text-base font-medium text-zinc-300 group-hover:text-white transition-colors">
            {isRu ? 'Подробнее по шагу (что делает система + видео)' : 'Step details (system behavior + video)'}
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-4">
              {isRu ? 'Что делает система' : 'System behavior'}
            </div>
            <CollapsibleList items={step.systemBehavior} isRu={isRu} visibleCount={2} />
          </div>
          <VideoPlaceholder title={step.videoSlotTitle} />
        </div>
      </details>
    </div>
  )
}

function TestDeployStepCard({ step, index, isRu }: { step: DocsSupportStep; index: number; isRu: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5 md:p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl border border-white/20 bg-white/10 flex items-center justify-center text-base font-bold text-white shadow-inner">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-xl font-semibold text-white tracking-wide">{step.title}</h3>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5">
            <CollapsibleList items={step.actions} isRu={isRu} visibleCount={2} />
          </div>
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5 text-base text-zinc-200 leading-relaxed shadow-sm">
            <span className="font-semibold text-emerald-400 mr-2">{isRu ? 'Результат:' : 'Outcome:'}</span> {step.outcome}
          </div>
        </div>
      </div>
      <div className="mt-5 pl-14">
        <VideoPlaceholder title={step.videoSlotTitle} />
      </div>
    </div>
  )
}

export function LearningFlowSection({ content }: { content: DocsContent }) {
  return (
    <section id="learning-flow" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.learningFlow.title} description={content.learningFlow.description} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="rounded-2xl border border-white/10 bg-zinc-950/50 p-6">
          <InfoList items={content.learningFlow.steps} />
        </div>
        <VideoPlaceholder title={content.learningFlow.videoNoteTitle} description={content.learningFlow.videoNoteDescription} />
      </div>
    </section>
  )
}

export function QuickStartSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="quick-start" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.quickStart.title} description={content.quickStart.description} />
      <div className="space-y-6">
        {content.quickStart.steps.map((step, index) => (
          <QuickStartStepCard key={step.id} step={step} index={index} isRu={isRu} />
        ))}
      </div>
    </section>
  )
}

export function ServiceFlowSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="service-flow" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.serviceFlow.title} description={content.serviceFlow.description} />
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 snap-x snap-mandatory pr-1">
          {content.serviceFlow.stages.map((stage) => (
            <article
              key={stage.title}
              className="w-[300px] sm:w-[330px] shrink-0 snap-start rounded-2xl border border-white/10 bg-zinc-950/55 p-5 flex flex-col hover:bg-zinc-950/75 transition-colors duration-300"
            >
              <h3 className="text-lg font-semibold text-white leading-7">{stage.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-7 flex-1">{stage.description}</p>
              <div className="mt-4 rounded-xl border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-3.5">
                <div className="text-[11px] uppercase tracking-wider font-medium text-zinc-400 mb-1.5">
                  {isRu ? 'Результат этапа' : 'Stage output'}
                </div>
                <div className="text-sm font-medium text-zinc-200 leading-7">{stage.output}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function EditorAreasSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="editor-areas" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.editorAreas.title} description={content.editorAreas.description} />
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        {content.editorAreas.cards.map((card) => (
          <div key={card.id} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5 md:p-6">
            <h3 className="text-xl font-bold text-white tracking-wide">{card.title}</h3>
            <div className="mt-1.5 text-sm md:text-base text-zinc-400">{card.subtitle}</div>
            <div className="mt-4 text-sm md:text-base text-zinc-300 leading-7">
              <span className="text-zinc-500">{isRu ? 'Когда использовать:' : 'When to use:'}</span> {card.whenToUse}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-3">
                  {isRu ? 'Основные действия' : 'Main actions'}
                </div>
                <InfoList items={card.actions} />
              </div>
              {card.useCases && card.useCases.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-3">
                    {isRu ? 'Типовые задачи' : 'Typical tasks'}
                  </div>
                  <InfoList items={card.useCases} />
                </div>
              ) : null}
              {card.storageNotes && card.storageNotes.length > 0 ? (
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-4 xl:col-span-2">
                  <div className="text-xs uppercase tracking-wider font-semibold text-cyan-300 mb-3">
                    {isRu ? 'Где это хранится' : 'Where this is stored'}
                  </div>
                  <InfoList items={card.storageNotes} />
                </div>
              ) : null}
              {card.commonMistakes && card.commonMistakes.length > 0 ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 xl:col-span-2">
                  <div className="text-xs uppercase tracking-wider font-semibold text-amber-300 mb-3">
                    {isRu ? 'Частые ошибки' : 'Common mistakes'}
                  </div>
                  <InfoList items={card.commonMistakes} />
                </div>
              ) : null}
            </div>
            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-base text-zinc-200 shadow-sm">
              <span className="font-semibold text-emerald-400 mr-2">{isRu ? 'Результат:' : 'Result:'}</span> {card.result}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function UiComponentsSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="ui-components" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.uiComponents.title} description={content.uiComponents.description} />
      <div className="space-y-5">
        {content.uiComponents.cards.map((card) => (
          <div id={`ui-${card.id}`} key={card.id} className="scroll-mt-28">
            <CompactDetails title={card.title} subtitle={`${card.location} • ${card.purpose}`}>
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-3">
                      {isRu ? 'Как работать' : 'How to use'}
                    </div>
                    <CollapsibleList items={card.howToUse} isRu={isRu} visibleCount={2} />
                  </div>
                  <div className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wider font-semibold text-amber-400 mb-3">
                      {isRu ? 'Частые ошибки' : 'Common mistakes'}
                    </div>
                    {card.commonMistakes && card.commonMistakes.length > 0 ? (
                      <CollapsibleList items={card.commonMistakes} isRu={isRu} visibleCount={2} />
                    ) : (
                      <p className="text-base text-zinc-300">
                        {isRu ? 'Нет специальных замечаний.' : 'No special caveats.'}
                      </p>
                    )}
                  </div>
                </div>
              </>
            </CompactDetails>
          </div>
        ))}
      </div>
    </section>
  )
}

export function NodesReferenceSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="nodes-reference" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.nodes.title} description={content.nodes.description} />
      <div className="space-y-6">
        {content.nodes.groups.map((group) => (
          <NodeGroupCard key={group.id} group={group} isRu={isRu} />
        ))}
      </div>
    </section>
  )
}

export function KeyboardsAndTriggersSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="keyboards-triggers" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.keyboardsAndTriggers.title} description={content.keyboardsAndTriggers.description} />
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-5 text-base text-zinc-200 leading-relaxed mb-6 shadow-sm">
        <DocsInlineText text={content.keyboardsAndTriggers.note} />
      </div>
      <details className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 group transition-all duration-300">
        <summary className="list-none cursor-pointer flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="text-base font-semibold text-zinc-200 group-hover:text-white transition-colors">
            {isRu ? 'Сравнительная таблица (полная)' : 'Comparison table (full)'}
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-base">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Параметр' : 'Topic'}</th>
                <th className="text-left px-5 py-4 font-semibold text-white">Reply Keyboard</th>
                <th className="text-left px-5 py-4 font-semibold text-white">Inline Keyboard</th>
              </tr>
            </thead>
            <tbody>
              {content.keyboardsAndTriggers.rows.map((row) => (
                <tr key={row.topic} className="border-b border-white/5 last:border-b-0">
                  <td className="px-5 py-4 text-zinc-200 font-medium align-top">{row.topic}</td>
                  <td className="px-5 py-4 text-zinc-300 align-top leading-relaxed">{row.replyKeyboard}</td>
                  <td className="px-5 py-4 text-zinc-300 align-top leading-relaxed">{row.inlineKeyboard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export function DataAndSecuritySection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="data-security" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.dataAndSecurity.title} description={content.dataAndSecurity.description} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {content.dataAndSecurity.rows.slice(0, 4).map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
            <div className="text-base font-semibold text-white">{row.item}</div>
            <div className="mt-2 text-sm text-zinc-400">
              {isRu ? 'Где:' : 'Where:'} <span className="text-zinc-300">{row.where}</span>
            </div>
            <div className="mt-2 text-sm text-zinc-500 line-clamp-2 leading-relaxed">{row.notes}</div>
          </div>
        ))}
      </div>
      <details className="rounded-2xl border border-white/10 bg-zinc-950/50 p-4 group transition-all duration-300">
        <summary className="list-none cursor-pointer flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="text-base font-semibold text-zinc-200 group-hover:text-white transition-colors">
            {isRu ? 'Полная карта хранения данных' : 'Full data storage map'}
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[900px] text-base">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Что' : 'Item'}</th>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Где хранится' : 'Where'}</th>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Постоянность' : 'Persistence'}</th>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Видимость' : 'Visibility'}</th>
                <th className="text-left px-5 py-4 font-semibold text-white">{isRu ? 'Комментарий' : 'Notes'}</th>
              </tr>
            </thead>
            <tbody>
              {content.dataAndSecurity.rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 last:border-b-0 align-top">
                  <td className="px-5 py-4 text-zinc-200 font-medium">{row.item}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.where}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.persistence}</td>
                  <td className="px-5 py-4 text-zinc-300">{row.visibility}</td>
                  <td className="px-5 py-4 text-zinc-300 leading-relaxed">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export function TestDeploySection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="test-deploy" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.testAndDeploy.title} description={content.testAndDeploy.description} />
      <div className="space-y-6">
        {content.testAndDeploy.steps.map((step, index) => (
          <TestDeployStepCard key={step.id} step={step} index={index} isRu={isRu} />
        ))}
      </div>
    </section>
  )
}

export function TroubleshootingSection({ content }: { content: DocsContent }) {
  const isRu = content.locale === 'ru'
  return (
    <section id="troubleshooting" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.troubleshooting.title} description={content.troubleshooting.description} />
      <div className="space-y-5">
        {content.troubleshooting.items.map((item) => (
          <details
            id={`troubleshoot-${item.id}`}
            key={item.id}
            className="scroll-mt-28 rounded-2xl border border-white/10 bg-zinc-950/50 p-5 group transition-all duration-300 shadow-sm"
          >
            <summary className="list-none cursor-pointer flex items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white group-hover:text-zinc-200 transition-colors">{item.question}</h3>
                <p className="mt-2 text-base text-zinc-400 line-clamp-2 leading-relaxed">{item.answer[0]}</p>
              </div>
              <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors mt-0.5">
                <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="mt-5 pt-5 border-t border-white/10">
              <CollapsibleList items={item.answer} isRu={isRu} visibleCount={2} />
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

export function VideoPlanSection({ content }: { content: DocsContent }) {
  return (
    <section id="video-plan" className="scroll-mt-28 rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
      <SectionHeader title={content.videoPlan.title} description={content.videoPlan.description} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {content.videoPlan.slots.map((slot) => (
          <VideoPlaceholder key={slot.id} title={slot.title} description={slot.description} />
        ))}
      </div>
    </section>
  )
}

const SECTION_RENDERERS: Record<DocsPageSectionId, (content: DocsContent) => ReactElement> = {
  'learning-flow': (content) => <LearningFlowSection content={content} />,
  'quick-start': (content) => <QuickStartSection content={content} />,
  'service-flow': (content) => <ServiceFlowSection content={content} />,
  'editor-areas': (content) => <EditorAreasSection content={content} />,
  'ui-components': (content) => <UiComponentsSection content={content} />,
  'nodes-reference': (content) => <NodesReferenceSection content={content} />,
  'keyboards-triggers': (content) => <KeyboardsAndTriggersSection content={content} />,
  'data-security': (content) => <DataAndSecuritySection content={content} />,
  'test-deploy': (content) => <TestDeploySection content={content} />,
  troubleshooting: (content) => <TroubleshootingSection content={content} />,
  'video-plan': (content) => <VideoPlanSection content={content} />,
}

export function RenderDocsSections({ content, sections }: { content: DocsContent; sections: DocsPageSectionId[] }) {
  return (
    <>
      {sections.map((sectionId) => (
        <div key={sectionId}>{SECTION_RENDERERS[sectionId](content)}</div>
      ))}
    </>
  )
}
