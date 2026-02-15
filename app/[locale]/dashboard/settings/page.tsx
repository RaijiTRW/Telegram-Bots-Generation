import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTranslations } from 'next-intl'
import {
  Settings as SettingsIcon,
  Bell,
  Lock,
  Globe,
  Palette,
  Shield,
  ChevronRight
} from 'lucide-react'

export default function SettingsPage() {
  const t = useTranslations('dashboard.settings')
  const tNav = useTranslations('dashboard.nav')

  const settingsSections = [
    {
      title: t('notifications'),
      description: t('notificationsDesc'),
      icon: Bell,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      items: [
        { label: t('emailNotif'), description: t('emailNotifDesc') },
        { label: t('pushNotif'), description: t('pushNotifDesc') },
        { label: t('weeklyDigest'), description: t('weeklyDigestDesc') },
      ],
    },
    {
      title: t('security'),
      description: t('securityDesc'),
      icon: Shield,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      items: [
        { label: t('twoFactor'), description: t('twoFactorDesc') },
        { label: t('loginAlerts'), description: t('loginAlertsDesc') },
      ],
    },
    {
      title: t('appearance'),
      description: t('appearanceDesc'),
      icon: Palette,
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      items: [
        { label: t('darkTheme'), description: t('darkThemeDesc') },
        { label: t('compactMode'), description: t('compactModeDesc') },
      ],
    },
    {
      title: t('languageRegion'),
      description: t('languageRegionDesc'),
      icon: Globe,
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
      items: [
        { label: t('language'), description: tNav('home') },
        { label: t('timezone'), description: 'UTC-5 (Eastern Time)' },
      ],
    },
  ]

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="text-zinc-400">{t('manage')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/10 backdrop-blur-sm border-[#24A1DE]/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#24A1DE]/20 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
            <CardContent className="relative p-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center mb-4">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{t('quickSettings')}</h3>
              <p className="text-sm text-zinc-400 mb-4">{t('quickSettingsDesc')}</p>
              <Button variant="outline" className="w-full border-white/10 text-zinc-300 hover:bg-white/5 justify-between">
                {t('changeProfile')}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800">
            <CardContent className="p-4 space-y-2">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group">
                <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
                  <Lock className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{t('changePassword')}</p>
                  <p className="text-xs text-zinc-500">{t('changePasswordDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group">
                <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{t('privacy')}</p>
                  <p className="text-xs text-zinc-500">{t('privacyDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Main Settings */}
        <div className="space-y-6 lg:col-span-2">
          {settingsSections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.title} className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
                <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${section.iconBg}`}>
                      <Icon className={`w-5 h-5 ${section.iconColor}`} />
                    </div>
                    <div>
                      {section.title}
                      <p className="text-sm font-normal text-zinc-500 mt-0.5">{section.description}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-1">
                  {section.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-4 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <div>
                        <Label className="text-zinc-200 cursor-pointer">{item.label}</Label>
                        <p className="text-sm text-zinc-500 mt-0.5">{item.description}</p>
                      </div>
                      <Switch checked={item.label === 'Темная тема'} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-sm border-red-500/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{t('dangerZone')}</h3>
                  <p className="text-sm text-zinc-400 mb-4">{t('dangerZoneDesc')}</p>
                </div>
                <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                  {t('deleteAccount')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
