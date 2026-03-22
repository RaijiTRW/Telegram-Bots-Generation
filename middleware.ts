import createMiddleware from 'next-intl/middleware';
import { locales } from './app/i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './lib/supabase/types';

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

function isPrefetchRequest(request: NextRequest) {
  return request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
}

async function getUserLocale(request: NextRequest, userId?: string | null): Promise<string | null> {
  if (!userId) {
    return null;
  }

  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      .select('language')
      .eq('id', userId)
      .single() as { data: { language: string } | null };

    if (data?.language && locales.includes(data.language as (typeof locales)[number])) {
      return data.language;
    }
  } catch {
    // Silently fail if we can't get user locale
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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
  const shouldRunSupabaseMiddleware = shouldRefreshProtectedSession || shouldLookupUserLocale

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

  const userIdFromMiddleware = supabaseResponse.headers.get('x-user-id');

  // Get user's stored language preference only for navigational requests.
  // Redirecting POST / Server Actions breaks Next.js action responses.
  const userLocale =
    isMutationRequest || isServerActionRequest || isPrefetch || cookiePreferredLocale
      ? null
      : await getUserLocale(request, userIdFromMiddleware);

  // Use cookie locale if no user locale from database
  const effectiveLocale = userLocale || cookiePreferredLocale;

  const response = intlMiddleware(request);

  // Preserve cookies/headers set by Supabase middleware response.
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  const middlewareUserId = supabaseResponse.headers.get('x-user-id');
  const middlewareUserEmail = supabaseResponse.headers.get('x-user-email');
  if (middlewareUserId) {
    response.headers.set('x-user-id', middlewareUserId);
  }
  if (middlewareUserEmail) {
    response.headers.set('x-user-email', middlewareUserEmail);
  }
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
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirectResponse.cookies.set(cookie);
      }
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
