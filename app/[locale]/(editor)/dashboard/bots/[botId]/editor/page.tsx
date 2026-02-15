import { redirect } from 'next/navigation'

export default async function BotEditorPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>
}) {
  const { botId, locale } = await params
  redirect(`/${locale}/dashboard/bots/${botId}/editor/canvas`)
}
