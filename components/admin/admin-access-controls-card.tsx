'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, EyeOff, Lock, Loader2, Shield, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type AppAccessControls,
  type AppMaintenanceScope,
  type DashboardSectionVisibilityMode,
  type ManagedDashboardSection,
  type RegistrationMode,
  MANAGED_DASHBOARD_SECTIONS,
  resolveDashboardSectionAccess,
} from '@/lib/admin-access/config'

interface AdminAccessControlsCardProps {
  value: AppAccessControls
  isSaving: boolean
  onChange: (nextValue: AppAccessControls) => void
  onSave: () => void
}

const MAINTENANCE_SCOPE_OPTIONS: AppMaintenanceScope[] = [
  'none',
  'site',
  'editor',
  'dashboard_editor',
]

const SECTION_MODE_OPTIONS: DashboardSectionVisibilityMode[] = [
  'default',
  'locked',
  'hidden',
]

const REGISTRATION_MODE_OPTIONS: RegistrationMode[] = ['open', 'beta_request', 'closed']

export function AdminAccessControlsCard({
  value,
  isSaving,
  onChange,
  onSave,
}: AdminAccessControlsCardProps) {
  const t = useTranslations('dashboard.admin')
  const locale = useLocale()
  const previewLocale = locale === 'en' ? 'en' : 'ru'

  const sectionMeta = useMemo<Record<ManagedDashboardSection, { title: string }>>(
    () => ({
      bots: { title: t('sectionBots') },
      statistics: { title: t('sectionStatistics') },
      subscription: { title: t('sectionSubscription') },
      crm: { title: t('sectionCrm') },
      docs: { title: t('sectionDocs') },
      profile: { title: t('sectionProfile') },
      settings: { title: t('sectionSettings') },
    }),
    [t]
  )

  const updateSection = (
    section: ManagedDashboardSection,
    patch: Partial<AppAccessControls['dashboardSections'][ManagedDashboardSection]>
  ) => {
    onChange({
      ...value,
      dashboardSections: {
        ...value.dashboardSections,
        [section]: {
          ...value.dashboardSections[section],
          ...patch,
        },
      },
    })
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-white">
          <Shield className="h-5 w-5 text-[#24A1DE]" />
          {t('accessTitle')}
        </CardTitle>
        <p className="text-sm text-zinc-400">{t('accessDesc')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="registration" className="space-y-5">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/60 p-1.5">
            <TabsTrigger value="registration" className="rounded-xl px-4 py-2.5">
              {t('accessTabRegistration')}
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="rounded-xl px-4 py-2.5">
              {t('accessTabMaintenance')}
            </TabsTrigger>
            <TabsTrigger value="sections" className="rounded-xl px-4 py-2.5">
              {t('accessTabSections')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registration" className="mt-0">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">{t('registrationTitle')}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-400">{t('registrationDesc')}</div>
              </div>
              <div className="w-full max-w-xs">
                <Select
                  value={value.registrationMode}
                  onValueChange={(nextValue) =>
                    onChange({
                      ...value,
                      registrationMode: nextValue as RegistrationMode,
                      registrationOpen: nextValue === 'open',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('registrationModeLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_MODE_OPTIONS.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {t(`registrationMode.${mode}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              {value.registrationMode === 'open'
                ? t('registrationOpenState')
                : value.registrationMode === 'beta_request'
                  ? t('registrationBetaState')
                  : t('registrationClosedState')}
            </div>
          </div>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-0">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                <Wrench className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{t('maintenanceTitle')}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-400">{t('maintenanceDesc')}</div>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t('maintenanceScopeLabel')}
                </div>
                <Select
                  value={value.maintenanceScope}
                  onValueChange={(nextValue) =>
                    onChange({
                      ...value,
                      maintenanceScope: nextValue as AppMaintenanceScope,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('maintenanceScopeLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_SCOPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(`maintenanceScope.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {value.maintenanceScope !== 'none' ? (
                <>
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {t('maintenanceCustomTitle')}
                    </div>
                    <Input
                      value={value.maintenanceTitle}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          maintenanceTitle: event.target.value,
                        })
                      }
                      placeholder={t('maintenanceCustomTitlePlaceholder')}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {t('maintenanceCustomMessage')}
                    </div>
                    <Textarea
                      value={value.maintenanceMessage}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          maintenanceMessage: event.target.value,
                        })
                      }
                      placeholder={t('maintenanceCustomMessagePlaceholder')}
                      rows={4}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          </TabsContent>

          <TabsContent value="sections" className="mt-0">
            <div className="space-y-4">
              <div>
                <div className="text-base font-semibold text-white">{t('sectionsTitle')}</div>
                <div className="mt-1 text-sm text-zinc-400">{t('sectionsDesc')}</div>
              </div>

              <div className="space-y-4">
                {MANAGED_DASHBOARD_SECTIONS.map((section) => {
                  const adminView = resolveDashboardSectionAccess(section, value, true, previewLocale)
                  const userView = resolveDashboardSectionAccess(section, value, false, previewLocale)
                  const current = value.dashboardSections[section]

                  return (
                    <div
                      key={section}
                      className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5"
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_260px]">
                        <div>
                          <div className="text-sm font-semibold text-white">{sectionMeta[section].title}</div>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                {t('sectionsModeLabel')}
                              </div>
                              <Select
                                value={current.mode}
                                onValueChange={(nextValue) =>
                                  updateSection(section, {
                                    mode: nextValue as DashboardSectionVisibilityMode,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={t('sectionsModeLabel')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {SECTION_MODE_OPTIONS.map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                      {t(`sectionMode.${mode}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                {t('sectionsLabelInput')}
                              </div>
                              <Input
                                value={current.label || ''}
                                onChange={(event) =>
                                  updateSection(section, {
                                    label: event.target.value || null,
                                  })
                                }
                                placeholder={t('sectionsLabelPlaceholder')}
                                disabled={current.mode === 'default'}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="rounded-xl border border-[#24A1DE]/20 bg-[#24A1DE]/8 px-4 py-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                              <Shield className="h-4 w-4 text-[#24A1DE]" />
                              {t('adminViewTitle')}
                            </div>
                            <div className="mt-2 text-sm text-zinc-300">{t('adminViewText')}</div>
                            {adminView.badge ? (
                              <span className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-wide text-zinc-200">
                                {adminView.badge}
                              </span>
                            ) : null}
                          </div>

                          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                              {userView.visible ? (
                                <Eye className="h-4 w-4 text-zinc-300" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-zinc-300" />
                              )}
                              {t('userViewTitle')}
                            </div>
                            <div className="mt-2 text-sm text-zinc-300">
                              {userView.mode === 'default'
                                ? t('userViewDefault')
                                : userView.mode === 'locked'
                                  ? t('userViewLocked')
                                  : t('userViewHidden')}
                            </div>
                            {userView.badge && userView.visible ? (
                              <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-wide text-zinc-200">
                                <Lock className="h-3 w-3" />
                                {userView.badge}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? t('accessSaving') : t('accessSave')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
