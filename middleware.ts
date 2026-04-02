import createMiddleware from 'next-intl/middleware';
import { locales } from './app/i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './lib/supabase/types';
import { getSupabasePublicEnv, hasSupabasePublicEnv } from '@/lib/supabase/config';
import {
  createDefaultAppAccessControls,
  getManagedDashboardSectionFromPath,
  getPathLocale,
  maintenanceScopeApplies,
  parseAppAccessControls,
  resolveDashboardSectionAccess,
  shouldBypassMaintenancePath,
} from '@/lib/admin-access/config';

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SUPABASE_AUTH_COOKIE_MARKER = '-auth-token';
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'ru',
  localeDetection: true,
});

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith('sb-') && name.includes(SUPABASE_AUTH_COOKIE_MARKER));
}

function getLocaleAgnosticPathname(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '/';
  }

  if (locales.includes(segments[0] as (typeof locales)[number])) {
    const pathWithoutLocale = segments.slice(1).join('/');
    return pathWithoutLocale ? `/${pathWithoutLocale}` : '/';
  }

  return pathname;
}

function isProtectedPath(pathname: string) {
  const normalizedPathname = getLocaleAgnosticPathname(pathname);
  return normalizedPathname === '/dashboard' || normalizedPathname.startsWith('/dashboard/');
}

function isSanityStudioPath(pathname: string) {
  return pathname === '/dashboard/cms' || pathname.startsWith('/dashboard/cms/')
}

function isPrefetchRequest(request: NextRequest) {
  return request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
}

function copySupabaseResponseState(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }

  const middlewareUserId = source.headers.get('x-user-id')
  const middlewareUserEmail = source.headers.get('x-user-email')
  if (middlewareUserId) {
    target.headers.set('x-user-id', middlewareUserId)
  }
  if (middlewareUserEmail) {
    target.headers.set('x-user-email', middlewareUserEmail)
  }
}

async function getUserProfileContext(
  request: NextRequest,
  userId?: string | null
): Promise<{ language: string | null; role: 'user' | 'admin' | null }> {
  if (!userId) {
    return { language: null, role: null };
  }

  const { url, anonKey, isConfigured } = getSupabasePublicEnv();
  if (!isConfigured || !url || !anonKey) {
    return { language: null, role: null };
  }

  try {
    const supabase = createServerClient<Database>(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // Session refresh is handled in updateSession() above.
          },
        },
      }
    );

    const { data } = await supabase
      .from('profiles')
      .select('language, role')
      .eq('id', userId)
      .single() as { data: { language: string | null; role: 'user' | 'admin' | null } | null };

    return {
      language:
        data?.language && locales.includes(data.language as (typeof locales)[number])
          ? data.language
          : null,
      role: data?.role || null,
    };
  } catch {
    // Silently fail if we can't get user locale
  }

  return { language: null, role: null };
}

async function getAppAccessControlsFromRequest(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv();
  if (!isConfigured || !url || !anonKey) {
    return createDefaultAppAccessControls();
  }

  try {
    const supabase = createServerClient<Database>(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // Middleware only reads global access controls.
          },
        },
      }
    );

    const { data } = await supabase
      .from('app_access_controls')
      .select('registration_open, maintenance_scope, maintenance_title, maintenance_message, dashboard_overrides')
      .eq('id', 1)
      .maybeSingle();

    return parseAppAccessControls(data);
  } catch {
    return createDefaultAppAccessControls();
  }
}

export async function middleware(request: NextRequest) {
  const supabaseConfigured = hasSupabasePublicEnv()
  const pathname = request.nextUrl.pathname;
  const studioRoute = isSanityStudioPath(pathname)
  const isMutationRequest = request.method !== 'GET' && request.method !== 'HEAD'
  const isServerActionRequest = Boolean(request.headers.get('next-action'))
  const isPrefetch = isPrefetchRequest(request)
  const hasSessionCookie = hasSupabaseSessionCookie(request)
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const cookiePreferredLocale =
    cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
      ? cookieLocale
      : null;
  const shouldRefreshProtectedSession =
    !isServerActionRequest && !isPrefetch && hasSessionCookie && isProtectedPath(pathname)
  const shouldLookupUserLocale =
    !isMutationRequest && !isServerActionRequest && !isPrefetch && !cookiePreferredLocale && hasSessionCookie
  const shouldReadUserProfile =
    !isMutationRequest && !isServerActionRequest && !isPrefetch && hasSessionCookie
  const shouldRunSupabaseMiddleware =
    supabaseConfigured && (shouldRefreshProtectedSession || shouldLookupUserLocale)

  // First, update Supabase session for normal navigation requests.
  // Server Actions are frequent (logs polling, saves, etc.) and will manage auth
  // in the action itself; skipping middleware auth refresh here reduces auth churn.
  const supabaseResponse = !shouldRunSupabaseMiddleware
    ? NextResponse.next({ request: { headers: request.headers } })
    : await updateSession(request);

  // If supabase returned a redirect response, return it
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }

  if (studioRoute) {
    const response = NextResponse.next({ request: { headers: request.headers } })
    copySupabaseResponseState(supabaseResponse, response)
    return response
  }

  const userIdFromMiddleware = supabaseResponse.headers.get('x-user-id');
  const shouldReadRuntimeAccess =
    !isMutationRequest && !isServerActionRequest && !isPrefetch
  const [userProfileContext, runtimeAccess] = await Promise.all([
    shouldReadUserProfile
      ? getUserProfileContext(request, userIdFromMiddleware)
      : Promise.resolve({ language: null, role: null }),
    shouldReadRuntimeAccess
      ? getAppAccessControlsFromRequest(request)
      : Promise.resolve(createDefaultAppAccessControls()),
  ])
  const isAdmin = userProfileContext.role === 'admin'
  const normalizedPathname = getLocaleAgnosticPathname(pathname)
  const requestLocale =
    userProfileContext.language === 'en' || cookiePreferredLocale === 'en'
      ? 'en'
      : getPathLocale(pathname)

  if (shouldReadRuntimeAccess && !isAdmin) {
    if (
      runtimeAccess.maintenanceScope !== 'none' &&
      maintenanceScopeApplies(runtimeAccess.maintenanceScope, normalizedPathname) &&
      !shouldBypassMaintenancePath(normalizedPathname)
    ) {
      const url = request.nextUrl.clone()
      url.pathname = `/${requestLocale}/maintenance`
      const redirectResponse = NextResponse.redirect(url)
      copySupabaseResponseState(supabaseResponse, redirectResponse)
      return redirectResponse
    }

    if (!runtimeAccess.registrationOpen && normalizedPathname.startsWith('/auth/signup')) {
      const url = request.nextUrl.clone()
      url.pathname = `/${requestLocale}/auth/login`
      const redirectResponse = NextResponse.redirect(url)
      copySupabaseResponseState(supabaseResponse, redirectResponse)
      return redirectResponse
    }

    const managedDashboardSection = getManagedDashboardSectionFromPath(normalizedPathname)
    if (managedDashboardSection) {
      const sectionAccess = resolveDashboardSectionAccess(
        managedDashboardSection,
        runtimeAccess,
        false,
        requestLocale
      )

      if (!sectionAccess.accessible) {
        const url = request.nextUrl.clone()
        url.pathname = `/${requestLocale}/dashboard`
        const redirectResponse = NextResponse.redirect(url)
        copySupabaseResponseState(supabaseResponse, redirectResponse)
        return redirectResponse
      }
    }
  }

  // Get user's stored language preference only for navigational requests.
  // Redirecting POST / Server Actions breaks Next.js action responses.
  const userLocale =
    isMutationRequest || isServerActionRequest || isPrefetch || cookiePreferredLocale
      ? null
      : userProfileContext.language;

  // Use cookie locale if no user locale from database
  const effectiveLocale = userLocale || cookiePreferredLocale;

  const response = intlMiddleware(request);

  // Preserve cookies/headers set by Supabase middleware response.
  copySupabaseResponseState(supabaseResponse, response)
  const middlewareUserId = supabaseResponse.headers.get('x-user-id');
  const middlewareUserEmail = supabaseResponse.headers.get('x-user-email');
  if (effectiveLocale && cookiePreferredLocale !== effectiveLocale) {
    response.cookies.set(LOCALE_COOKIE_NAME, effectiveLocale, {
      path: '/',
      sameSite: 'lax',
      maxAge: LOCALE_COOKIE_MAX_AGE,
    });
  }

  // If effective locale doesn't match URL, redirect
  if (effectiveLocale) {
    const segments = pathname.split('/');
    const currentLocale = segments[1];

    // If no locale in URL or locale doesn't match user preference, redirect
    if (!locales.includes(currentLocale as (typeof locales)[number]) || currentLocale !== effectiveLocale) {
      const newPath = `/${effectiveLocale}${pathname.startsWith(`/${currentLocale}`) ? pathname.slice(`/${currentLocale}`.length) : pathname}`;
      const url = request.nextUrl.clone();
      url.pathname = newPath;
      const redirectResponse = NextResponse.redirect(url);
      copySupabaseResponseState(supabaseResponse, redirectResponse)
      if (middlewareUserId) {
        redirectResponse.headers.set('x-user-id', middlewareUserId);
      }
      if (middlewareUserEmail) {
        redirectResponse.headers.set('x-user-email', middlewareUserEmail);
      }
      redirectResponse.cookies.set(LOCALE_COOKIE_NAME, effectiveLocale, {
        path: '/',
        sameSite: 'lax',
        maxAge: LOCALE_COOKIE_MAX_AGE,
      });
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  // Skip all paths that should not be internationalized
  // This includes: api routes, _next, static files, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
