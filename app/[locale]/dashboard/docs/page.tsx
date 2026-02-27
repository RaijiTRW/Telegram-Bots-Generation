import { DocsHomePage } from '@/components/docs/docs-home-page'
import { DocumentationSidebar } from '@/components/docs/documentation-sidebar'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageDefinitions } from '@/lib/docs/docs-pages'

export default async function DashboardDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const content = await getDocsContentWithMarkdown(locale)
  const pages = getDocsPageDefinitions(content)
  const basePath = `/${locale}/dashboard/docs`

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <DocumentationSidebar
        content={content}
        locale={locale}
        pages={pages}
        currentPageSlug={null}
        basePath={basePath}
      />
      <div className="min-w-0 space-y-8">
        <DocsHomePage locale={locale} content={content} pages={pages} basePath={basePath} />
      </div>
    </div>
  )
}

