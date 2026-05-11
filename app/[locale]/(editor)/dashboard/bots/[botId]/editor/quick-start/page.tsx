import { redirect } from 'next/navigation'

export default async function LegacyQuickStartPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>
}) {
  const { locale, botId } = await params

  redirect(`/${locale}/workspace/bots/${botId}/editor/ai-chat`)
}
