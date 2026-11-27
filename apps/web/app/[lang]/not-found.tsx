import { headers } from 'next/headers';
import { isLang, type Lang } from '@/lib/locales';
import { translator } from '@/lib/messages';

/**
 * The app's own not-found page, rendered on request in the language layout: no inline style (Next's default page has
 * some, which the Content Security Policy refuses), translated, with a way back.
 */
export default async function NotFound() {
  const first = ((await headers()).get('x-pathname') ?? '').split('/')[1];
  const lang: Lang = isLang(first) ? first : 'ar';
  const t = translator(lang);
  return (
    <section data-testid="not-found">
      <h1>{t.t('error.notFound')}</h1>
      <p>{t.t('error.notFoundHint')}</p>
      <p><a href={`/${lang}`}>{t.t('nav.home')}</a></p>
    </section>
  );
}
