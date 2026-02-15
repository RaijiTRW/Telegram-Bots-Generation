import createMiddleware from 'next-intl/middleware';
import { locales } from './app/i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // First, update Supabase session
  const supabaseResponse = await updateSession(request);
  
  // If supabase returned a redirect response, return it
  if (supabaseResponse.status >= 300 && supabaseResponse.status < 400) {
    return supabaseResponse;
  }
  
  // Then apply next-intl middleware
  const intlMiddleware = createMiddleware({
    // A list of all locales that are supported
    locales,

    // Used when no locale matches
    defaultLocale: 'ru',

    // Automatically detect user's preferred language
    localeDetection: true,
  });
  
  return intlMiddleware(request);
}

export const config = {
  // Skip all paths that should not be internationalized
  // This includes: api routes, _next, static files, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
