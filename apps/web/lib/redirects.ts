import { DEFAULT_LANG, isLang, type Lang } from './locales';

const SAFE = /^\/(ar|fr|en)(\/[A-Za-z0-9_-]+)*\/?(\?[A-Za-z0-9=&_-]{0,200})?$/;

/** Where to go after a sign-in: only a path of this app (no open redirect), else the home page of the language. */
export function safeReturnTo(value: unknown, lang: Lang = DEFAULT_LANG): string {
  return typeof value === 'string' && SAFE.test(value) ? value : `/${lang}`;
}

export function langOfPath(path: string): Lang {
  const seg = path.split('/')[1];
  return isLang(seg) ? seg : DEFAULT_LANG;
}
