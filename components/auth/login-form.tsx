"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const t = useTranslations("auth.login")
  const te = useTranslations("auth.login.errors")
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(te("invalidCredentials"))
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(te("invalidCredentials"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-11 transition-all duration-300"
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
          className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 h-11 transition-all duration-300"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 animate-in fade-in-50 slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full h-11 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#1a8bc7] hover:to-[#7c4fdd] text-white font-medium shadow-lg shadow-purple-500/25 transition-all duration-300" 
        disabled={loading}
      >
        {loading && <Loader2 className="animate-spin mr-2" />}
        {t("submit")}
      </Button>
    </form>
  )
}
