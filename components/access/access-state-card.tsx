import Link from 'next/link'
import { Wrench, Lock, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AccessStateCardProps {
  title: string
  description: string
  backHref?: string
  backLabel?: string
  variant?: 'maintenance' | 'restricted'
}

export function AccessStateCard({
  title,
  description,
  backHref,
  backLabel,
  variant = 'restricted',
}: AccessStateCardProps) {
  const Icon = variant === 'maintenance' ? Wrench : Lock

  return (
    <div className="flex min-h-[420px] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl overflow-hidden border-white/10 bg-zinc-950/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#24A1DE]/15 text-[#24A1DE]">
              <Icon className="h-5 w-5" />
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-zinc-300">
          <p className="max-w-xl text-base leading-7 text-zinc-400">{description}</p>
          {backHref && backLabel ? (
            <Button asChild className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white">
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
