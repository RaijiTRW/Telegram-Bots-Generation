import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Shield, Camera } from 'lucide-react'

export default function ProfilePage() {
  const t = useTranslations('dashboard.profile')

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="text-zinc-400">{t('manage')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/10 rounded-full blur-2xl translate-x-1/4 -translate-y-1/4" />
          <CardContent className="relative p-8 text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#24A1DE]/30 to-[#8B5CF6]/30 flex items-center justify-center mx-auto">
                <User className="w-12 h-12 text-zinc-400" />
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-[#24A1DE] rounded-full hover:bg-[#24A1DE]/90 transition-colors">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{t('yourName')}</h3>
            <p className="text-sm text-zinc-400 mb-4">your.email@example.com</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-medium border border-emerald-500/20">
              <Shield className="w-3 h-3" />
              {t('verifiedAccount')}
            </div>
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 lg:col-span-2">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="text-white flex items-center gap-2">
              <div className="p-2 rounded-lg bg-[#24A1DE]/20">
                <User className="w-4 h-4 text-[#24A1DE]" />
              </div>
              {t('profileInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-zinc-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  {t('fullName')}
                </Label>
                <Input
                  id="fullName"
                  placeholder={t('fullName')}
                  className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-zinc-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  {t('username')}
                </Label>
                <Input
                  id="username"
                  placeholder="username"
                  className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-zinc-500" />
                {t('email')}
              </Label>
              <Input
                id="email"
                type="email"
                disabled
                className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-zinc-500">{t('emailNotChangeable')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-zinc-300">{t('bio')}</Label>
              <textarea
                id="bio"
                rows={3}
                placeholder={t('bioPlaceholder')}
                className="w-full px-3 py-2 bg-zinc-950/50 border border-zinc-700 rounded-md text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#24A1DE] focus:ring-1 focus:ring-[#24A1DE]/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-500">{t('lastUpdate')}</p>
              <div className="flex gap-3">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-white/5 hover:text-white">
                  {t('cancel')}
                </Button>
                <Button className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/90 hover:to-[#8B5CF6]/90 text-white border-0">
                  {t('save')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
