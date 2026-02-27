import { DocsFrame } from '@/components/docs/docs-frame'
import { DocsHomePage } from '@/components/docs/docs-home-page'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageDefinitions } from '@/lib/docs/docs-pages'

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const content = await getDocsContentWithMarkdown(locale)
  const pages = getDocsPageDefinitions(content)

  return (
    <DocsFrame locale={locale} content={content} currentPageSlug={null}>
      <DocsHomePage locale={locale} content={content} pages={pages} />
    </DocsFrame>
  )
}
