"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { hasSupabasePublicEnv } from "@/lib/supabase/config"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignupForm() {
  const t = useTranslations("auth.signup")
  const te = useTranslations("auth.login.errors")
  const locale = useLocale()
  const router = useRouter()
  const supabase = createClient()
  const isSupabaseConfigured = hasSupabasePublicEnv()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const formError = error ?? (isHydrated && !isSupabaseConfigured ? te("supabaseNotConfigured") : null)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const validateForm = (): boolean => {
    if (password.length < 6) {
      setError(te("weakPassword"))
      return false
    }

    if (password !== confirmPassword) {
      setError(te("passwordsMismatch"))
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isSupabaseConfigured) {
      setError(te("supabaseNotConfigured"))
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) {
        if (authError.message.includes("already")) {
          setError(te("emailTaken"))
        } else {
          setError(authError.message)
        }
        return
      }

      if (data.user) {
        router.push(`/${locale}/dashboard`)
        router.refresh()
      }
    } catch {
      setError(te("invalidCredentials"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-zinc-300 font-medium">{t("fullName")}</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Ivan Ivanov"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-10 transition-all duration-300"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-300 font-medium">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="hello@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-10 transition-all duration-300"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-300 font-medium">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-10 transition-all duration-300"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-zinc-300 font-medium">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-10 transition-all duration-300"
        />
      </div>

      {formError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 animate-in fade-in-50 slide-in-from-top-2 duration-300">
          {formError}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full h-10 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#1a8bc7] hover:to-[#7c4fdd] text-white font-medium shadow-lg shadow-purple-500/25 transition-all duration-300" 
        disabled={loading || (isHydrated && !isSupabaseConfigured)}
      >
        {loading && <Loader2 className="animate-spin mr-2" />}
        {t("submit")}
      </Button>
    </form>
  )
}
