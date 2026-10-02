import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, loadMessages } from './config';

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: await loadMessages(locale), timeZone: 'America/New_York' };
});
