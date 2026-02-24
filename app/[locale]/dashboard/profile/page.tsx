'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Shield, Camera, Loader2, X } from 'lucide-react'

type ProfileForm = {
  fullName: string
  username: string
  bio: string
  avatarUrl: string | null
}

type StatusMessage = {
  type: 'success' | 'error' | 'info'
  text: string
} | null

const EMPTY_FORM: ProfileForm = {
  fullName: '',
  username: '',
  bio: '',
  avatarUrl: null,
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function getInitials(fullName: string, email: string) {
  const source = fullName.trim() || email.split('@')[0] || ''
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return initials
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
        return
      }
      reject(new Error('Unable to read image'))
    }
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Unable to load image'))
    img.src = url
  })
}

async function createAvatarDataUrl(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return readFileAsDataUrl(file)
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) {
      return readFileAsDataUrl(file)
    }

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
    const sourceX = Math.floor((image.naturalWidth - sourceSize) / 2)
    const sourceY = Math.floor((image.naturalHeight - sourceSize) / 2)

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    )

    try {
      return canvas.toDataURL('image/webp', 0.9)
    } catch {
      return canvas.toDataURL('image/jpeg', 0.9)
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function ProfilePage() {
  const t = useTranslations('dashboard.profile')
  const locale = useLocale()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<StatusMessage>(null)
  const [email, setEmail] = useState('')
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM)
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)

  const hasChanges =
    form.fullName !== initialForm.fullName ||
    form.username !== initialForm.username ||
    form.bio !== initialForm.bio ||
    form.avatarUrl !== initialForm.avatarUrl

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setStatus(null)

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        const user = userData.user
        if (!user) {
          throw new Error('User not found')
        }

        const metadata =
          user.user_metadata && typeof user.user_metadata === 'object'
            ? (user.user_metadata as Record<string, unknown>)
            : {}

        const { data: profileRow } = await ((supabase
          .from('profiles')
          .select('full_name, avatar_url, updated_at')
          .eq('id', user.id)
          .maybeSingle()) as unknown as Promise<{
          data: {
            full_name: string | null
            avatar_url: string | null
            updated_at: string | null
          } | null
        }>)

        const nextForm: ProfileForm = {
          fullName:
            profileRow?.full_name ??
            (typeof metadata.full_name === 'string' ? metadata.full_name : '') ??
            '',
          username: typeof metadata.username === 'string' ? metadata.username : '',
          bio: typeof metadata.bio === 'string' ? metadata.bio : '',
          avatarUrl:
            profileRow?.avatar_url ??
            (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null),
        }

        if (!isMounted) return

        setEmail(user.email || '')
        setIsEmailVerified(Boolean(user.email_confirmed_at))
        setLastUpdatedAt(profileRow?.updated_at || null)
        setForm(nextForm)
        setInitialForm(nextForm)
      } catch {
        if (!isMounted) return
        setStatus({ type: 'error', text: t('loadError') })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [supabase, t])

  const displayName = form.fullName.trim() || email.split('@')[0] || t('yourName')
  const initials = getInitials(form.fullName, email)
  const formattedLastUpdated = lastUpdatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(lastUpdatedAt)
      )
    : t('never')

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarRemove = () => {
    setStatus(null)
    setForm((prev) => ({ ...prev, avatarUrl: null }))
  }

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setStatus({ type: 'error', text: t('avatarInvalidType') })
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setStatus({ type: 'error', text: t('avatarTooLarge') })
      return
    }

    setStatus(null)

    try {
      const avatarUrl = await createAvatarDataUrl(file)
      setForm((prev) => ({ ...prev, avatarUrl }))
    } catch {
      setStatus({ type: 'error', text: t('avatarProcessError') })
    }
  }

  const handleCancel = () => {
    setStatus(null)
    setForm(initialForm)
  }

  const handleSave = async () => {
    if (isLoading || isSaving) return

    setIsSaving(true)
    setStatus(null)

    const normalizedFullName = form.fullName.trim()
    const normalizedUsername = form.username.trim()
    const normalizedBio = form.bio.trim()

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      const user = userData.user
      if (!user) {
        throw new Error('User not found')
      }

      const { data: updatedProfile, error: profileError } = await ((supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email || email,
            full_name: normalizedFullName || null,
            avatar_url: form.avatarUrl,
          } as never,
          { onConflict: 'id' }
        )
        .select('updated_at')
        .single()) as unknown as Promise<{
        data: { updated_at: string | null } | null
        error: unknown
      }>)

      if (profileError) {
        throw profileError
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          full_name: normalizedFullName || null,
          username: normalizedUsername || null,
          bio: normalizedBio || null,
        },
      })

      if (authUpdateError) {
        throw authUpdateError
      }

      const nextForm: ProfileForm = {
        fullName: normalizedFullName,
        username: normalizedUsername,
        bio: normalizedBio,
        avatarUrl: form.avatarUrl,
      }

      setForm(nextForm)
      setInitialForm(nextForm)
      setLastUpdatedAt(updatedProfile?.updated_at || new Date().toISOString())
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cbtooll:profile-updated', {
            detail: {
              fullName: normalizedFullName || email.split('@')[0] || '',
              email: user.email || email,
              avatarUrl: form.avatarUrl,
            },
          })
        )
      }
      setStatus({ type: 'success', text: t('saveSuccess') })
    } catch {
      setStatus({ type: 'error', text: t('saveError') })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="text-zinc-400">{t('manage')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="relative bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B5CF6]/10 rounded-full blur-2xl translate-x-1/4 -translate-y-1/4" />
          <CardContent className="relative p-8 text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="w-24 h-24 rounded-full border border-white/10 bg-zinc-950 mx-auto">
                <AvatarImage src={form.avatarUrl || undefined} alt={displayName} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-[#24A1DE]/30 to-[#8B5CF6]/30 text-zinc-200">
                  {initials || <User className="w-12 h-12 text-zinc-400" />}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleAvatarClick}
                className="absolute bottom-0 right-0 p-2 bg-[#24A1DE] rounded-full hover:bg-[#24A1DE]/90 transition-colors"
                aria-label={t('avatarChange')}
                disabled={isLoading || isSaving}
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <h3 className="text-lg font-semibold text-white mb-1">{displayName}</h3>
            <p className="text-sm text-zinc-400 mb-2 break-all">{email || '—'}</p>
            <p className="text-xs text-zinc-500 mb-4">{t('avatarHint')}</p>
            {form.avatarUrl && (
              <div className="mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarRemove}
                  disabled={isLoading || isSaving}
                  className="border-zinc-700 text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('avatarRemove')}
                </Button>
              </div>
            )}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isEmailVerified
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              <Shield className="w-3 h-3" />
              {isEmailVerified ? t('verifiedAccount') : t('unverifiedAccount')}
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
            {status && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  status.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : status.type === 'info'
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                {status.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-zinc-300 flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  {t('fullName')}
                </Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, fullName: event.target.value }))
                  }}
                  placeholder={t('fullName')}
                  disabled={isLoading || isSaving}
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
                  value={form.username}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, username: event.target.value }))
                  }}
                  placeholder="username"
                  disabled={isLoading || isSaving}
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
                value={email}
                placeholder={isLoading ? t('loading') : ''}
                className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-zinc-500">
                {t('emailChangeInSettings')}{' '}
                <Link
                  href={`/${locale}/dashboard/settings`}
                  className="text-[#24A1DE] hover:text-[#24A1DE]/90 underline underline-offset-4"
                >
                  {t('openSettings')}
                </Link>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-zinc-300">{t('bio')}</Label>
              <Textarea
                id="bio"
                rows={3}
                value={form.bio}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, bio: event.target.value }))
                }}
                disabled={isLoading || isSaving}
                placeholder={t('bioPlaceholder')}
                className="min-h-[120px] bg-zinc-950/50 border-zinc-700 focus-visible:ring-[#24A1DE]/20 focus-visible:ring-1 focus-visible:border-[#24A1DE] resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-500">
                {t('lastUpdatedLabel')}: {formattedLastUpdated}
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || isSaving || !hasChanges}
                  onClick={handleCancel}
                  className="border-zinc-700 text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isLoading || isSaving || !hasChanges}
                  className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/90 hover:to-[#8B5CF6]/90 text-white border-0"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
