import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, Activity, Users, MessageSquare, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const t = useTranslations('dashboard.home')
  const tStats = useTranslations('dashboard.stats')
  const locale = useLocale()

  const stats = [
    {
      title: tStats('bots'),
      value: '0',
      icon: Bot,
      bgColor: 'from-blue-500/20 to-cyan-500/20',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
    },
    {
      title: tStats('active'),
      value: '0',
      icon: Activity,
      bgColor: 'from-emerald-500/20 to-green-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: tStats('users'),
      value: '0',
      icon: Users,
      bgColor: 'from-purple-500/20 to-violet-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
    {
      title: tStats('messages'),
      value: '0',
      icon: MessageSquare,
      bgColor: 'from-orange-500/20 to-amber-500/20',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
      borderColor: 'border-orange-500/20',
    },
  ]

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="text-zinc-400">{t('overview')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className={`group relative overflow-hidden bg-gradient-to-br ${stat.bgColor} bg-white/5 backdrop-blur-sm border ${stat.borderColor} hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-1`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardContent className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.iconBg} ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className={`h-2 w-2 rounded-full ${stat.iconColor} bg-current animate-pulse`} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-400">{stat.title}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#24A1DE]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8B5CF6]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">{t('quickActions')}</h2>
              <p className="text-zinc-400 mt-1">{t('quickActionsDesc')}</p>
            </div>
            <div className="hidden sm:block">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-[#24A1DE]" />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/90 hover:to-[#8B5CF6]/90 text-white font-medium rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#24A1DE]/20 hover:-translate-y-0.5"
            >
              <Link href={`/${locale}/dashboard/bots`}>
                {t('createBot')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
              <Link href={`/${locale}/dashboard/docs`}>{t('viewDocs')}</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
