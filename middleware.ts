import createMiddleware from 'next-intl/middleware';
import { locales } from './app/i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './lib/supabase/types';

async function getUserLocale(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single() as { data: { language: string } | null };

      if (data?.language && locales.includes(data.language as any)) {
        return data.language;
      }
    }
  } catch (error) {
    // Silently fail if we can't get user locale
  }

  return null;
}

export async function middleware(request: NextRequest) {
  // First, update Supabase session
  const supabaseResponse = await updateSession(request);

  // If supabase returned a redirect response, return it
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }

  // Get user's stored language preference
  const userLocale = await getUserLocale(request);

  // Then apply next-intl middleware
  const intlMiddleware = createMiddleware({
    // A list of all locales that are supported
    locales,

    // Used when no locale matches
    defaultLocale: 'ru',

    // Automatically detect user's preferred language
    localeDetection: true,
  });

  const response = await intlMiddleware(request);

  // If user has a stored locale preference and the URL doesn't match, redirect
  if (userLocale) {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/');
    const currentLocale = segments[1];

    // If no locale in URL or locale doesn't match user preference, redirect
    if (!locales.includes(currentLocale as any) || currentLocale !== userLocale) {
      const newPath = `/${userLocale}${pathname.startsWith(`/${currentLocale}`) ? pathname.slice(`/${currentLocale}`.length) : pathname}`;
      const url = request.nextUrl.clone();
      url.pathname = newPath;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // Skip all paths that should not be internationalized
  // This includes: api routes, _next, static files, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
