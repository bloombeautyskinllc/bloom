export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
// Only English ships for now; add messages/es.json (+ backoffice.es.json) and a locale switch to enable Spanish
export const defaultLocale: Locale = 'en';

/** Site + emails (messages/<locale>.json) and the back office (messages/backoffice.<locale>.json, namespace "bo") */
export async function loadMessages(locale: Locale) {
  const [site, backoffice] = await Promise.all([
    import(`../messages/${locale}.json`),
    import(`../messages/backoffice.${locale}.json`),
  ]);
  return { ...site.default, bo: backoffice.default };
}
