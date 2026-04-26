"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  hasSupabasePublicEnv,
  isMissingSupabaseConfigurationError,
} from "@/lib/supabase/config";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginStep = "credentials" | "mfa";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const te = useTranslations("auth.login.errors");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();
  const isSupabaseConfigured = hasSupabasePublicEnv();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const formError =
    error ??
    (isHydrated && !isSupabaseConfigured ? te("supabaseNotConfigured") : null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const redirectToDashboard = () => {
    router.push(`/${locale}/dashboard`);
    router.refresh();
  };

  const resolveMfaRequiredFactor = async () => {
    const [factorsResult, aalResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsResult.error || aalResult.error) {
      return null;
    }

    const factor = factorsResult.data?.all?.find(
      (item) => item.factor_type === "totp" && item.status === "verified",
    );

    const requiresStepUp = aalResult.data?.nextLevel === "aal2";

    if (!factor || !requiresStepUp) {
      return null;
    }

    return factor.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep !== "credentials") return;
    if (!isSupabaseConfigured) {
      setError(te("supabaseNotConfigured"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      const authErrorCode =
        authError && typeof authError === "object" && "code" in authError
          ? String((authError as { code?: unknown }).code ?? "")
          : "";

      if (isMissingSupabaseConfigurationError(authError)) {
        setError(te("supabaseNotConfigured"));
        return;
      }

      if (authError && authErrorCode !== "mfa_required") {
        setError(te("invalidCredentials"));
        return;
      }

      const factorId = await resolveMfaRequiredFactor();

      if (factorId) {
        setMfaFactorId(factorId);
        setMfaCode("");
        setLoginStep("mfa");
        return;
      }

      if (authError) {
        setError(te("invalidCredentials"));
        return;
      }

      redirectToDashboard();
    } catch {
      setError(te("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    if (!isSupabaseConfigured) {
      setError(te("supabaseNotConfigured"));
      return;
    }

    const code = mfaCode.trim();
    if (!code) {
      setError(t("mfaCodeRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify(
        {
          factorId: mfaFactorId,
          code,
        },
      );

      if (verifyError) {
        setError(t("mfaInvalidCode"));
        return;
      }

      redirectToDashboard();
    } catch {
      setError(t("mfaInvalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = async () => {
    if (loading) return;

    setError(null);
    setMfaCode("");
    setMfaFactorId(null);
    setLoginStep("credentials");

    // Prevent partial aal1 session from remaining if user leaves MFA step.
    if (!isSupabaseConfigured) {
      return;
    }

    await supabase.auth.signOut();
  };

  return (
    <div className="space-y-2.5 sm:space-y-3.5">
      {loginStep === "mfa" && (
        <div className="rounded-lg border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-2.5 text-xs text-zinc-300 sm:p-3 sm:text-sm">
          <p className="font-medium text-white">{t("mfaStepTitle")}</p>
          <p className="text-zinc-400 mt-1">{t("mfaStepDescription")}</p>
        </div>
      )}

      <form
        onSubmit={loginStep === "credentials" ? handleSubmit : handleVerifyMfa}
        className="space-y-2.5 sm:space-y-3.5"
      >
        {loginStep === "credentials" ? (
          <>
            <div className="space-y-1">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-zinc-300 sm:text-sm"
              >
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
              <Label
                htmlFor="password"
                className="text-xs font-medium text-zinc-300 sm:text-sm"
              >
                {t("password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-10 border-white/10 bg-zinc-950/45 text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <Label
                htmlFor="mfaCode"
                className="text-xs font-medium text-zinc-300 sm:text-sm"
              >
                {t("mfaCodeLabel")}
              </Label>
              <Input
                id="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t("mfaCodePlaceholder")}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                disabled={loading}
                className="h-10 border-white/10 bg-zinc-950/45 tracking-[0.2em] text-white placeholder:text-zinc-500 transition-all duration-300 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20 sm:h-11"
              />
            </div>
          </>
        )}

        {formError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400 animate-in fade-in-50 slide-in-from-top-2 duration-300 sm:p-3 sm:text-sm">
            {formError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            className="h-10 w-full bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] font-medium text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:from-[#1a8bc7] hover:to-[#7c4fdd] sm:h-11"
            disabled={loading || (isHydrated && !isSupabaseConfigured)}
          >
            {loading && <Loader2 className="animate-spin mr-2" />}
            {loginStep === "credentials" ? t("submit") : t("mfaVerifyButton")}
          </Button>

          {loginStep === "mfa" && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                void handleBackToCredentials();
              }}
              className="w-full"
            >
              {t("mfaBackButton")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
