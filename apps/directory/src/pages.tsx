import type { ReactNode } from 'react';
import { directionOf, formatDate, formatNumber } from '@civora/i18n';
import { KINDS, LANGS, LOCALES, type Lang, type Office, type Part, type Service, type Source, type Text, type Version } from './content';
import type { T } from './messages';

/**
 * The public directory pages (P5-D3, P5-F1, P5-F2, P5-F3), rendered once to static HTML. No JavaScript, no inline
 * styles, no third-party resources: one stylesheet from this site. Logical CSS properties, so Arabic needs no separate
 * stylesheet. Content in a language the procedure does not have (English is optional) is shown in French and marked
 * with its language (WCAG 3.1.2), and such pages are not indexed.
 */
export const paths = {
  index: (l: Lang) => `/${l}/services/`,
  /** Served by the web app (a server is needed): search and the error report (doc phase-5/03). */
  search: (l: Lang) => `/${l}/services/search`,
  report: (l: Lang, code: string, v: number, slug: string) => `/${l}/services/report?${new URLSearchParams({ code, v: String(v), slug })}`,
  service: (l: Lang, slug: string) => `/${l}/services/${slug}/`,
  history: (l: Lang, slug: string) => `/${l}/services/${slug}/history/`,
  version: (l: Lang, slug: string, n: number) => `/${l}/services/${slug}/v/${n}/`,
  offices: (l: Lang) => `/${l}/offices/`,
  css: '/assets/directory.css',
};

export interface Shown { text: string; lang: Lang; fallback: boolean }

/** The text of a field in the page's language; English falls back to French. */
export function pick(t: Text, lang: Lang): Shown {
  if (lang === 'en' && !t.en) return { text: t.fr, lang: 'fr', fallback: true };
  return { text: (lang === 'en' ? t.en : t[lang]) as string, lang, fallback: false };
}

/** Does the procedure have its own text in this language (every field it shows)? */
export function hasLanguage(v: Version, lang: Lang): boolean {
  if (lang !== 'en') return true;
  const c = v.content;
  return [c.title, c.summary, c.institution, ...(c.processing_time ? [c.processing_time] : []), ...c.requirements.map((r) => r.text)].every((x) => !!x.en);
}

function L({ s, page }: { s: Shown; page: Lang }): ReactNode {
  return s.lang === page ? s.text : <span lang={LOCALES[s.lang]} dir={directionOf(s.lang)}>{s.text}</span>;
}

const day = (iso: string, lang: Lang) => formatDate(new Date(`${iso.slice(0, 10)}T12:00:00Z`), LOCALES[lang], { dateStyle: 'long' }, 'latn', 'UTC');
const tnd = (n: number, lang: Lang) => formatNumber(n, LOCALES[lang], { style: 'currency', currency: 'TND' });

/**
 * A translated sentence with elements in it: each {name} becomes the given node, isolated from the sentence's
 * direction (<bdi>), so a French title, a JORT number or a digest keeps its order inside Arabic text.
 */
function rich(t: T, key: string, nodes: Record<string, ReactNode>): ReactNode[] {
  const marked = t(key, Object.fromEntries(Object.keys(nodes).map((k) => [k, `\u0000${k}\u0000`])));
  return marked.split('\u0000').map((part, i) => (i % 2 ? <bdi key={i}>{nodes[part]}</bdi> : part));
}

/** JSON inside a script data block: nothing in it can close the element or start markup. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export interface PageMeta {
  lang: Lang;
  t: T;
  origin: string;
  path: string;
  title: string;
  description: string;
  /** The same page in each language that has its own text (for search engines). */
  alternates: Partial<Record<Lang, string>>;
  /** The same page in every language it was generated in (the language switcher); defaults to the alternates. */
  switcher?: Partial<Record<Lang, string>>;
  noindex?: boolean;
  canonical?: string;
  jsonLd?: unknown;
  breadcrumbs: { href?: string; label: string }[];
}

function Layout({ meta, children }: { meta: PageMeta; children: ReactNode }) {
  const { lang, t, origin } = meta;
  const alt = Object.entries(meta.alternates) as [Lang, string][];
  return (
    <html lang={LOCALES[lang]} dir={directionOf(lang)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${meta.title} — ${t('site.directory')}`}</title>
        <meta name="description" content={meta.description} />
        {meta.noindex ? <meta name="robots" content="noindex" /> : null}
        <link rel="canonical" href={origin + (meta.canonical ?? meta.path)} />
        {meta.noindex ? null : alt.map(([l, href]) => <link key={l} rel="alternate" hrefLang={LOCALES[l]} href={origin + href} />)}
        {meta.noindex || !meta.alternates.ar ? null : <link rel="alternate" hrefLang="x-default" href={origin + meta.alternates.ar} />}
        <link rel="stylesheet" href={paths.css} />
        {meta.jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(meta.jsonLd) }} /> : null}
      </head>
      <body>
        <a className="skip" href="#main">{t('nav.skip')}</a>
        <header className="top">
          <div className="brand"><a href={paths.index(lang)}>{t('site.name')}</a><span className="tagline">{t('site.directory')}</span></div>
          <nav aria-label={t('nav.main')}>
            <ul>
              <li><a href={paths.index(lang)} aria-current={meta.path === paths.index(lang) ? 'page' : undefined}>{t('nav.services')}</a></li>
              <li><a href={paths.offices(lang)} aria-current={meta.path === paths.offices(lang) ? 'page' : undefined}>{t('nav.offices')}</a></li>
            </ul>
          </nav>
          <form method="get" action={paths.search(lang)} role="search" className="search">
            <label htmlFor="q" className="vh">{t('nav.search')}</label>
            <input id="q" type="search" name="q" minLength={2} maxLength={200} required placeholder={t('nav.search')} />
            <button type="submit">{t('nav.searchSubmit')}</button>
          </form>
          <nav aria-label={t('nav.language')} className="langs">
            <ul>
              {LANGS.map((l) => {
                const href = (meta.switcher ?? meta.alternates)[l] ?? paths.index(l);
                return <li key={l}><a href={href} lang={LOCALES[l]} hrefLang={LOCALES[l]} aria-current={l === lang ? 'true' : undefined}>{NATIVE[l]}</a></li>;
              })}
            </ul>
          </nav>
        </header>
        <nav aria-label={t('nav.breadcrumb')} className="crumbs">
          <ol>
            {meta.breadcrumbs.map((b, i) => <li key={i}>{b.href ? <a href={b.href}>{b.label}</a> : <span aria-current="page">{b.label}</span>}</li>)}
          </ol>
        </nav>
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="foot"><p>{t('footer.about')}</p></footer>
      </body>
    </html>
  );
}

const NATIVE: Record<Lang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };

/** Sources numbered in the order the page first cites them; every number links to its entry. */
function numbering(v: Version): Map<string, number> {
  const n = new Map<string, number>();
  for (const k of KINDS) for (const r of v.content.requirements.filter((x) => x.kind === k).sort((a, b) => a.position - b.position)) {
    for (const s of r.sources) if (!n.has(s)) n.set(s, n.size + 1);
  }
  return n;
}

function Cites({ part, nums, t }: { part: Part; nums: Map<string, number>; t: T }) {
  return (
    <span className="cites">
      {part.sources.map((s) => nums.get(s)!).sort((a, b) => a - b).map((n, i) => (
        <span key={n}>{i ? <span className="sep">,</span> : null}<a href={`#source-${n}`} className="cite"><span className="vh">{t('service.citation', { n: '' }).trim()} </span>{n}</a></span>
      ))}
    </span>
  );
}

function SourceItem({ s, n, lang, t }: { s: Source; n: number; lang: Lang; t: T }) {
  return (
    <li id={`source-${n}`}>
      <span className="kind">{s.kind === 'legal-text' ? t('source.legal') : t('source.page')}</span>{' '}
      <bdi><a href={s.url} rel="external noopener noreferrer" referrerPolicy="no-referrer" lang={s.language}>{s.title}</a></bdi>
      {' — '}<bdi>{s.publisher}</bdi>
      {s.jort_reference ? <>{' — '}{rich(t, 'source.jort', { ref: s.jort_reference })}</> : null}
      {' — '}{t('source.accessed', { date: day(s.accessed_on, lang) })}
    </li>
  );
}

function Parts({ v, kind, lang, t, nums }: { v: Version; kind: Part['kind']; lang: Lang; t: T; nums: Map<string, number> }) {
  const parts = v.content.requirements.filter((r) => r.kind === kind).sort((a, b) => a.position - b.position);
  const List = kind === 'step' ? 'ol' : 'ul';
  return (
    <section aria-labelledby={`h-${kind}`}>
      <h2 id={`h-${kind}`}>{t.kind(kind)}</h2>
      {parts.length === 0
        ? <p>{kind === 'fee' ? t('service.free') : t('service.none')}</p>
        : <List className={`parts parts-${kind}`}>
          {parts.map((p) => (
            <li key={p.position}>
              <L s={pick(p.text, lang)} page={lang} />
              {p.amount_tnd !== null ? <>{' — '}<strong className="amount">{tnd(p.amount_tnd, lang)}</strong></> : null}
              {' '}<Cites part={p} nums={nums} t={t} />
            </li>
          ))}
        </List>}
    </section>
  );
}

function OfficeCard({ o, lang, t, level }: { o: Office; lang: Lang; t: T; level: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  const hours = o.hours && typeof o.hours === 'object' && typeof (o.hours as Text).ar === 'string' && typeof (o.hours as Text).fr === 'string' ? (o.hours as Text) : null;
  const lat = o.latitude === null ? null : Number(o.latitude);
  const lon = o.longitude === null ? null : Number(o.longitude);
  return (
    <article className="office" id={`office-${o.code}`}>
      <H><L s={pick(o.name, lang)} page={lang} /></H>
      <p><L s={pick(o.institution, lang)} page={lang} /></p>
      <dl className="facts">
        <dt>{t('offices.address')}</dt><dd><L s={pick(o.address, lang)} page={lang} /></dd>
        {hours ? <><dt>{t('offices.hours')}</dt><dd><L s={pick(hours, lang)} page={lang} /></dd></> : null}
      </dl>
      {lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)
        ? <p><a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`} rel="external noopener noreferrer" referrerPolicy="no-referrer">{t('offices.map')}</a></p>
        : null}
      <p className="meta">{t('offices.lastVerified', { date: day(o.last_verified_on, lang) })}
        {o.source ? <>{' — '}{t('service.sourceRef')}: <bdi><a href={o.source.url} rel="external noopener noreferrer" referrerPolicy="no-referrer" lang={o.source.language}>{o.source.title}</a></bdi></> : null}</p>
    </article>
  );
}

export function servicePage(opts: { svc: Service; v: Version; lang: Lang; t: T; origin: string; offices: Office[] }) {
  const { svc, v, lang, t, origin } = opts;
  const c = v.content;
  const current = v === svc.current;
  const slug = svc.current.content.slug;
  const path = current ? paths.service(lang, slug) : paths.version(lang, slug, c.version);
  const nums = numbering(v);
  const byId = new Map(v.sources.map((s) => [s.id, s]));
  const offices = c.offices.map((code) => opts.offices.find((o) => o.code === code)).filter((o): o is Office => !!o);
  const title = pick(c.title, lang);
  const own = hasLanguage(v, lang);
  const here = (l: Lang) => (current ? paths.service(l, slug) : paths.version(l, slug, c.version));
  const alternates = Object.fromEntries(LANGS.filter((l) => hasLanguage(v, l)).map((l) => [l, here(l)]));
  const meta: PageMeta = {
    lang, t, origin, path, title: title.text, description: pick(c.summary, lang).text, alternates,
    switcher: Object.fromEntries(LANGS.map((l) => [l, here(l)])),
    noindex: !current || !own, canonical: current ? undefined : paths.service(lang, slug),
    breadcrumbs: [{ href: paths.index(lang), label: t('nav.services') }, { href: `${paths.index(lang)}#${c.category}`, label: t.category(c.category) }, { label: title.text }],
    jsonLd: current ? {
      '@context': 'https://schema.org', '@type': 'GovernmentService', name: title.text, description: pick(c.summary, lang).text,
      url: origin + path, inLanguage: LOCALES[title.lang], areaServed: { '@type': 'Country', name: 'TN' },
      provider: { '@type': 'GovernmentOrganization', name: pick(c.institution, lang).text },
      ...(c.online_url ? { availableChannel: { '@type': 'ServiceChannel', serviceUrl: c.online_url } } : {}),
      dateModified: v.publishedAt || undefined,
    } : undefined,
  };
  return (
    <Layout meta={meta}>
      <article>
        <h1><L s={title} page={lang} /></h1>
        <p className="summary"><L s={pick(c.summary, lang)} page={lang} /></p>
        {!current ? <p className="notice notice-warning">{t('notice.superseded')} <a href={paths.service(lang, slug)}>{t('notice.current')}</a></p> : null}
        {!own ? <p className="notice notice-info">{t('notice.fallback')}</p> : null}
        {v.translationReview === 'pending' ? <p className="notice notice-info">{t('notice.translation')}</p> : null}
        <dl className="facts">
          <dt>{t('service.institution')}</dt><dd><L s={pick(c.institution, lang)} page={lang} /></dd>
          {c.online_url ? <><dt>{t('service.online')}</dt><dd><a href={c.online_url} rel="external noopener noreferrer" referrerPolicy="no-referrer">{new URL(c.online_url).host}</a></dd></> : null}
          {c.processing_time ? <><dt>{t('service.processing')}</dt><dd><L s={pick(c.processing_time, lang)} page={lang} /></dd></> : null}
        </dl>
        <p className="meta">
          {t('service.lastVerified', { date: day(c.last_verified_on, lang) })}{' — '}
          {t('service.version', { n: c.version, date: v.publishedAt ? day(v.publishedAt, lang) : '' })}{' — '}
          <a href={paths.history(lang, slug)}>{t('service.history')}</a>
          {current ? <>{' — '}<a href={paths.report(lang, c.code, c.version, slug)}>{t('service.report')}</a></> : null}
        </p>
        {KINDS.map((k) => <Parts key={k} v={v} kind={k} lang={lang} t={t} nums={nums} />)}
        {offices.length ? (
          <section aria-labelledby="h-offices">
            <h2 id="h-offices">{t('service.offices')}</h2>
            {offices.map((o) => <OfficeCard key={o.code} o={o} lang={lang} t={t} level={3} />)}
          </section>
        ) : null}
        <section aria-labelledby="h-sources">
          <h2 id="h-sources">{t('service.sources')}</h2>
          <ol className="sources">{[...nums.entries()].map(([id, n]) => <SourceItem key={id} s={byId.get(id)!} n={n} lang={lang} t={t} />)}</ol>
        </section>
        <section aria-labelledby="h-integrity" className="integrity">
          <h2 id="h-integrity">{t('integrity.title')}</h2>
          <p>{rich(t, 'integrity.text', { digest: <code dir="ltr">{v.digest}</code>, kid: <code dir="ltr">{v.kid}</code> })}</p>
        </section>
      </article>
    </Layout>
  );
}

export function historyPage(opts: { svc: Service; lang: Lang; t: T; origin: string }) {
  const { svc, lang, t, origin } = opts;
  const c = svc.current.content;
  const title = pick(c.title, lang);
  const own = hasLanguage(svc.current, lang);
  const meta: PageMeta = {
    lang, t, origin, path: paths.history(lang, c.slug), title: t('history.title', { title: title.text }), description: t('history.intro'),
    alternates: Object.fromEntries(LANGS.filter((l) => hasLanguage(svc.current, l)).map((l) => [l, paths.history(l, c.slug)])), noindex: !own,
    switcher: Object.fromEntries(LANGS.map((l) => [l, paths.history(l, c.slug)])),
    breadcrumbs: [{ href: paths.index(lang), label: t('nav.services') }, { href: paths.service(lang, c.slug), label: title.text }, { label: t('service.history') }],
  };
  return (
    <Layout meta={meta}>
      <h1>{rich(t, 'history.title', { title: <L s={title} page={lang} /> })}</h1>
      <p>{t('history.intro')}</p>
      <ol className="list history" reversed>
        {svc.versions.map((v) => (
          <li key={v.content.version}>
            <div>
              <a href={v === svc.current ? paths.service(lang, c.slug) : paths.version(lang, c.slug, v.content.version)}>{t('history.read', { n: v.content.version })}</a>
              {' '}<span className="badge">{v === svc.current ? t('history.current') : t('history.superseded')}</span>
              <p className="meta">{t('service.version', { n: v.content.version, date: v.publishedAt ? day(v.publishedAt, lang) : '' })}{' — '}{t('service.lastVerified', { date: day(v.content.last_verified_on, lang) })}</p>
              <p>{t('service.changeNote', { note: v.content.change_note })}</p>
            </div>
          </li>
        ))}
      </ol>
    </Layout>
  );
}

export function indexPage(opts: { services: Service[]; lang: Lang; t: T; origin: string }) {
  const { services, lang, t, origin } = opts;
  const cats = [...new Set(services.map((s) => s.current.content.category))].sort((a, b) => t.category(a).localeCompare(t.category(b), LOCALES[lang]));
  const meta: PageMeta = {
    lang, t, origin, path: paths.index(lang), title: t('index.title'), description: t('index.intro'),
    alternates: Object.fromEntries(LANGS.map((l) => [l, paths.index(l)])), breadcrumbs: [{ label: t('nav.services') }],
  };
  return (
    <Layout meta={meta}>
      <h1>{t('index.title')}</h1>
      <p>{t('index.intro')}</p>
      {services.length === 0 ? <p>{t('index.empty')}</p> : null}
      {cats.map((cat) => (
        <section key={cat} aria-labelledby={cat}>
          <h2 id={cat}>{t.category(cat)}</h2>
          <ul className="list services">
            {services.filter((s) => s.current.content.category === cat).map((s) => {
              const c = s.current.content;
              return (
                <li key={c.code}>
                  <div>
                    <a href={paths.service(lang, c.slug)} className="title"><L s={pick(c.title, lang)} page={lang} /></a>
                    <p><L s={pick(c.summary, lang)} page={lang} /></p>
                    <p className="meta">{t('service.lastVerified', { date: day(c.last_verified_on, lang) })}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Layout>
  );
}

export function officesPage(opts: { offices: Office[]; lang: Lang; t: T; origin: string }) {
  const { offices, lang, t, origin } = opts;
  const govs = [...new Set(offices.map((o) => o.governorate))].sort((a, b) => a.localeCompare(b, LOCALES[lang]));
  const meta: PageMeta = {
    lang, t, origin, path: paths.offices(lang), title: t('offices.title'), description: t('offices.intro'),
    alternates: Object.fromEntries(LANGS.map((l) => [l, paths.offices(l)])), breadcrumbs: [{ label: t('nav.offices') }],
  };
  return (
    <Layout meta={meta}>
      <h1>{t('offices.title')}</h1>
      <p>{t('offices.intro')}</p>
      {offices.length === 0 ? <p>{t('offices.empty')}</p> : null}
      {govs.map((g, i) => (
        <section key={g} aria-labelledby={`gov-${i + 1}`}>
          <h2 id={`gov-${i + 1}`}>{g}</h2>
          {offices.filter((o) => o.governorate === g).map((o) => <OfficeCard key={o.code} o={o} lang={lang} t={t} level={3} />)}
        </section>
      ))}
    </Layout>
  );
}
