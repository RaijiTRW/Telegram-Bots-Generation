import { redirect } from 'next/navigation'
import { AccessStateCard } from '@/components/access/access-state-card'
import { getAppAccessControls } from '@/lib/admin-access/server'
import { buildNoIndexMetadata } from '@/lib/site/seo'
import {
  getDefaultMaintenanceMessage,
  getDefaultMaintenanceTitle,
  getPathLocale,
} from '@/lib/admin-access/config'

export const metadata = buildNoIndexMetadata(
  'CBTooll Maintenance',
  'Temporary maintenance page.'
)

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const accessControls = await getAppAccessControls()

  if (accessControls.maintenanceScope === 'none') {
    redirect(`/${locale}`)
  }

  const normalizedLocale = getPathLocale(`/${locale}`)
  const title =
    accessControls.maintenanceTitle ||
    getDefaultMaintenanceTitle(accessControls.maintenanceScope, normalizedLocale)
  const description =
    accessControls.maintenanceMessage ||
    getDefaultMaintenanceMessage(accessControls.maintenanceScope, normalizedLocale)

  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      <AccessStateCard
        variant="maintenance"
        title={title}
        description={description}
        backHref={`/${locale}`}
        backLabel={normalizedLocale === 'en' ? 'Back to home' : 'На главную'}
      />
    </div>
  )
}
