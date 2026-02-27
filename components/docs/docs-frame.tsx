import { Header } from '@/components/header/header'
import { Footer } from '@/components/footer/footer'
import { DocumentationSidebar } from '@/components/docs/documentation-sidebar'
import type { DocsContent } from '@/lib/docs/docs-content'
import { getDocsPageDefinitions, type DocsPageSlug } from '@/lib/docs/docs-pages'

export function DocsFrame({
  locale,
  content,
  currentPageSlug,
  children,
}: {
  locale: string
  content: DocsContent
  currentPageSlug: DocsPageSlug | null
  children: React.ReactNode
}) {
  const pages = getDocsPageDefinitions(content)

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <DocumentationSidebar
            content={content}
            locale={locale}
            pages={pages}
            currentPageSlug={currentPageSlug}
          />
          <div className="min-w-0 space-y-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
