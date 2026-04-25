'use client'

import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiSectionIconProps {
  className?: string
}

export function AiSectionIcon({ className }: AiSectionIconProps) {
  return <Zap className={cn('text-[#24A1DE]', className)} />
}
