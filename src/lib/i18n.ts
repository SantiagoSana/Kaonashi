// KAONASHI I18N RUNTIME HELPER (§6.9)
import esMessages from '../../messages/es.json';
import enMessages from '../../messages/en.json';
import jaMessages from '../../messages/ja.json';
import { Locale } from './types';

export const MESSAGES: Record<Locale, Record<string, Record<string, string>>> = {
  es: esMessages,
  en: enMessages,
  ja: jaMessages,
};

export function getTranslation(
  locale: Locale,
  keyPath: string,
  params?: Record<string, string | number>
): string {
  const [namespace, key] = keyPath.split('.');
  const dict = MESSAGES[locale] || MESSAGES.es;
  const nsDict = dict[namespace] || MESSAGES.es[namespace] || {};
  let text = nsDict[key] || MESSAGES.es[namespace]?.[key];

  if (!text) {
    if (process.env.NODE_ENV === 'development') {
      return `⟦${keyPath}⟧`;
    }
    return keyPath;
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }

  return text;
}
