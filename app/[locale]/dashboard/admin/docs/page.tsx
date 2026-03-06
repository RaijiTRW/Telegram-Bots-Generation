import { redirect } from 'next/navigation'

export default async function DashboardAdminDocsRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  redirect(`/${locale}/dashboard/cms`)
}
