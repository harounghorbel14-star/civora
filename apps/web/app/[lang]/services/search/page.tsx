import { notFound } from 'next/navigation';
import { formatDate } from '@civora/i18n';
import { publicCoreGet } from '@/lib/core';
import { searchHits, searchQuery, textIn, type SearchHit } from '@/lib/directory';
import { isLang, LOCALES } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { config, correlationId } from '@/server/context';

/**
 * Search in the services directory (P5-D4; doc phase-5/03). A plain GET form, so it works without scripts; the results
 * link to the directory's static pages (/<lang>/services/<slug>/). Arabic and French are normalised by the core.
 */
export default async function SearchServices({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const raw = (await searchParams).q;
  const q = searchQuery(raw);
  let hits: SearchHit[] | null = null;
  let error: 'short' | 'unavailable' | null = null;
  if (raw !== undefined) {
    if (q === null) error = 'short';
    else {
      const r = await publicCoreGet<unknown>(config(), `/v1/services?q=${encodeURIComponent(q)}`, await correlationId()).catch(() => null);
      if (r?.status === 200) hits = searchHits(r.body);
      else error = 'unavailable';
    }
  }
  const day = (d: string) => formatDate(new Date(`${d}T12:00:00Z`), LOCALES[lang], { dateStyle: 'long' }, 'latn', 'UTC');
  return (
    <section>
      <h1>{t.t('services.search.title')}</h1>
      <form method="get" action={`/${lang}/services/search`} role="search" className="stack" data-testid="services-search-form">
        <label>{t.t('services.search.label')}
          <input type="search" name="q" defaultValue={typeof raw === 'string' ? raw : ''} minLength={2} maxLength={200} required
            aria-describedby="search-hint" data-testid="services-search-q" />
        </label>
        <p id="search-hint" className="hint">{t.t('services.search.hint')}</p>
        <button type="submit" data-testid="services-search-submit">{t.t('services.search.submit')}</button>
      </form>
      {error && <p className="notice notice-danger" role="alert" data-testid={`services-search-${error}`}>{t.t(`services.search.${error}`)}</p>}
      {hits && q && (
        <div role="status" aria-live="polite">
          <h2>{hits.length ? t.t('services.search.results', { q, count: hits.length }) : t.t('services.search.none', { q })}</h2>
          <ul className="list" data-testid="services-search-results">
            {hits.map((h) => {
              const title = textIn(h.title, lang);
              const summary = textIn(h.summary, lang);
              return (
                <li key={h.code}>
                  <div>
                    <a href={`/${lang}/services/${h.slug}/`} lang={title.lang === lang ? undefined : LOCALES[title.lang]}>{title.text}</a>
                    <p lang={summary.lang === lang ? undefined : LOCALES[summary.lang]}>{summary.text}</p>
                    <p className="hint">{t.t('services.search.lastVerified', { date: day(h.lastVerifiedOn) })}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p><a href={`/${lang}/services/`}>{t.t('services.search.all')}</a></p>
    </section>
  );
}
