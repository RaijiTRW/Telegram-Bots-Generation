import { getRequestConfig } from 'next-intl/server';

export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming locale parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'ru';
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
