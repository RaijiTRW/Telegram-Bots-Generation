'use client'

import { useState, type FormEvent } from 'react'
import {
  BadgePercent,
  Bot,
  CalendarDays,
  ClipboardList,
  HelpCircle,
  Loader2,
  ShoppingBag,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type RestaurantBotTemplateId =
  | 'restaurant-menu'
  | 'restaurant-booking'
  | 'restaurant-delivery'
  | 'restaurant-promos-faq'
  | 'restaurant-lead'

export type CreateBotModalData = {
  name: string
  description: string
  restaurantTemplateId?: RestaurantBotTemplateId
}

type RestaurantBotTemplate = {
  id: RestaurantBotTemplateId
  icon: LucideIcon
  labelKey: string
  descriptionKey: string
  promptKey: string
}

const RESTAURANT_BOT_TEMPLATES: RestaurantBotTemplate[] = [
  {
    id: 'restaurant-menu',
    icon: Utensils,
    labelKey: 'templateMenu',
    descriptionKey: 'templateMenuDesc',
    promptKey: 'templateMenuPrompt',
  },
  {
    id: 'restaurant-booking',
    icon: CalendarDays,
    labelKey: 'templateBooking',
    descriptionKey: 'templateBookingDesc',
    promptKey: 'templateBookingPrompt',
  },
  {
    id: 'restaurant-delivery',
    icon: ShoppingBag,
    labelKey: 'templateDelivery',
    descriptionKey: 'templateDeliveryDesc',
    promptKey: 'templateDeliveryPrompt',
  },
  {
    id: 'restaurant-promos-faq',
    icon: BadgePercent,
    labelKey: 'templatePromosFaq',
    descriptionKey: 'templatePromosFaqDesc',
    promptKey: 'templatePromosFaqPrompt',
  },
  {
    id: 'restaurant-lead',
    icon: ClipboardList,
    labelKey: 'templateLead',
    descriptionKey: 'templateLeadDesc',
    promptKey: 'templateLeadPrompt',
  },
]

interface CreateBotModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: CreateBotModalData) => Promise<void>
  isLoading?: boolean
}

export function CreateBotModal({ isOpen, onClose, onCreate, isLoading = false }: CreateBotModalProps) {
  const t = useTranslations('editor.modals')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<RestaurantBotTemplateId>('restaurant-menu')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const selectedTemplate = RESTAURANT_BOT_TEMPLATES.find((item) => item.id === selectedTemplateId)
    const templatePrompt = selectedTemplate ? t(selectedTemplate.promptKey) : ''

    await onCreate({
      name: name.trim(),
      description: description.trim() || templatePrompt,
      restaurantTemplateId: selectedTemplateId,
    })
    setName('')
    setDescription('')
    setSelectedTemplateId('restaurant-menu')
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setSelectedTemplateId('restaurant-menu')
    onClose()
  }

  const handleTemplateSelect = (template: RestaurantBotTemplate) => {
    const previousTemplate = RESTAURANT_BOT_TEMPLATES.find((item) => item.id === selectedTemplateId)
    const currentDescription = description.trim()
    const previousPrompt = previousTemplate ? t(previousTemplate.promptKey) : ''

    setSelectedTemplateId(template.id)
    if (!currentDescription || currentDescription === previousPrompt) {
      setDescription(t(template.promptKey))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
              <Bot className="w-5 h-5 text-[#24A1DE]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{t('restaurantCreateTitle')}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('restaurantCreateSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[calc(90vh-81px)] space-y-5 overflow-y-auto p-6 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#8ED8FF]" />
              <Label className="text-white">{t('restaurantTemplateTitle')}</Label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESTAURANT_BOT_TEMPLATES.map((template) => {
                const Icon = template.icon
                const isActive = selectedTemplateId === template.id

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={cn(
                      'min-h-[92px] rounded-xl border p-3 text-left transition',
                      isActive
                        ? 'border-[#24A1DE]/50 bg-[#24A1DE]/12 text-white shadow-[0_0_0_1px_rgba(36,161,222,0.18)]'
                        : 'border-white/10 bg-white/[0.035] text-zinc-300 hover:border-white/16 hover:bg-white/[0.055]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#8ED8FF]' : 'text-zinc-500')} />
                      <span className="text-sm font-semibold">{t(template.labelKey)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{t(template.descriptionKey)}</p>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">{t('restaurantTemplateDesc')}</p>
          </div>

          <div>
            <Label htmlFor="bot-name" className="text-white mb-2 block">
              {t('botName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('botNamePlaceholder')}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              autoFocus
              maxLength={100}
              required
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('botNameDesc')}
            </p>
          </div>

          <div>
            <Label htmlFor="bot-description" className="text-white mb-2 block">
              {t('description')}
            </Label>
            <Textarea
              id="bot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('descriptionDesc')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="flex-1 gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('createBot')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
