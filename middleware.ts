import createMiddleware from 'next-intl/middleware';
import { locales } from './app/i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './lib/supabase/types';

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
  const isMutationRequest = request.method !== 'GET' && request.method !== 'HEAD'
  const isServerActionRequest = Boolean(request.headers.get('next-action'))

  // First, update Supabase session for normal navigation requests.
  // Server Actions are frequent (logs polling, saves, etc.) and will manage auth
  // in the action itself; skipping middleware auth refresh here reduces auth churn.
  const supabaseResponse = isServerActionRequest
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
    isMutationRequest || isServerActionRequest
      ? null
      : await getUserLocale(request, userIdFromMiddleware);

  // Check for NEXT_LOCALE cookie preference first (for guest users)
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const cookiePreferredLocale = cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
    ? cookieLocale
    : null;

  // Use cookie locale if no user locale from database
  const effectiveLocale = userLocale || cookiePreferredLocale;

  // Then apply next-intl middleware
  const intlMiddleware = createMiddleware({
    // A list of all locales that are supported
    locales,

    // Used when no locale matches
    defaultLocale: 'ru',

    // Automatically detect user's preferred language
    localeDetection: true,
  });

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

  // If effective locale doesn't match URL, redirect
  if (effectiveLocale) {
    const pathname = request.nextUrl.pathname;
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
