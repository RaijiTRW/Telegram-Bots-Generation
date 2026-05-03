"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { hasSupabasePublicEnv } from "@/lib/supabase/config";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitBetaAccessRequest } from "@/app/actions/beta-access";

export function SignupForm({ mode = "open" }: { mode?: "open" | "beta_request" }) {
  const t = useTranslations("auth.signup");
  const te = useTranslations("auth.login.errors");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();
  const isSupabaseConfigured = hasSupabasePublicEnv();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const formError =
    error ??
    (isHydrated && !isSupabaseConfigured ? te("supabaseNotConfigured") : null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const validateForm = (): boolean => {
    if (password.length < 6) {
      setError(te("weakPassword"));
      return false;
    }

    if (password !== confirmPassword) {
      setError(te("passwordsMismatch"));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      setError(te("supabaseNotConfigured"));
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === "beta_request") {
        const result = await submitBetaAccessRequest({
          fullName,
          email,
          password,
          locale,
        });

        if (!result.success) {
          setError(resolveBetaError(result.code || result.error, locale));
          return;
        }

        if (result.data.status === "approved") {
          setSuccessMessage(
            locale === "en"
              ? "Access is already approved. You can sign in with this email and password."
              : "Доступ уже одобрен. Войдите с этим email и паролем."
          );
          return;
        }

        setSuccessMessage(
          locale === "en"
            ? "Request sent. After approval you will receive an email and can sign in."
            : "Заявка отправлена. После одобрения на почту придет письмо, и вы сможете войти."
        );
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already")) {
          setError(te("emailTaken"));
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch {
      setError(te("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3.5">
      <div className="space-y-1">
        <Label htmlFor="fullName" className="text-xs font-medium text-zinc-300 sm:text-sm">
          {t("fullName")}
        </Label>
        <Input
          id="fullName"
          type="text"
          placeholder="Ivan Ivanov"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={loading}
          className="h-10 border-white/10 bg-zinc-950/45 text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="email" className="text-xs font-medium text-zinc-300 sm:text-sm">
          {t("email")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="hello@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="h-10 border-white/10 bg-zinc-950/45 text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password" className="text-xs font-medium text-zinc-300 sm:text-sm">
          {t("password")}
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
          className="h-10 border-white/10 bg-zinc-950/45 text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
        />
      </div>

      <div className="space-y-1">
        <Label
          htmlFor="confirmPassword"
          className="text-xs font-medium text-zinc-300 sm:text-sm"
        >
          {t("confirmPassword")}
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
          minLength={6}
          className="h-10 border-white/10 bg-zinc-950/45 text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
        />
      </div>

      {formError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400 animate-in fade-in-50 slide-in-from-top-2 duration-300 sm:p-3 sm:text-sm">
          {formError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 animate-in fade-in-50 slide-in-from-top-2 duration-300 sm:p-3 sm:text-sm">
          {successMessage}
        </div>
      )}

      <Button
        type="submit"
        className="h-10 w-full bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] font-medium text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:from-[#1a8bc7] hover:to-[#7c4fdd] sm:h-11"
        disabled={loading || (isHydrated && !isSupabaseConfigured)}
      >
        {loading && <Loader2 className="animate-spin mr-2" />}
        {mode === "beta_request"
          ? (locale === "en" ? "Request beta access" : "Отправить заявку на бета")
          : t("submit")}
      </Button>
    </form>
  );
}

function resolveBetaError(code: string, locale: string) {
  const isEnglish = locale === "en";
  if (code === "BETA_REQUEST_CLOSED") {
    return isEnglish ? "Beta requests are currently closed." : "Заявки на бета-доступ сейчас закрыты.";
  }
  if (code === "INVALID_INPUT") {
    return isEnglish ? "Check your name, email, and password." : "Проверьте имя, email и пароль.";
  }
  if (code === "CREATE_USER_FAILED") {
    return isEnglish
      ? "Could not create the account. If this email already exists, try signing in."
      : "Не удалось создать аккаунт. Если email уже есть, попробуйте войти.";
  }
  return isEnglish ? "Could not send the request." : "Не удалось отправить заявку.";
}
