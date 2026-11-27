import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { LANGS, LOCALES, type Snapshot, trimTrailingSlashes } from './content';
import { translator } from './messages';
import { hasLanguage, historyPage, indexPage, officesPage, paths, servicePage } from './pages';
import { CSS } from './styles';

/**
 * The whole public directory as files: path (no leading slash) → content. Pure and deterministic: the same snapshot
 * gives the same bytes, so a rebuild that changes nothing changes no file (P5-A2).
 */
export interface Site { files: Map<string, string>; indexable: string[] }

/**
 * The response headers the static server sends with every file (deployment: the gateway or the object store's
 * front). No script runs on these pages: `script-src 'none'` (the schema.org block is data, not script).
 */
export const HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

const html = (el: ReactElement) => `<!DOCTYPE html>${renderToStaticMarkup(el)}`;
const file = (p: string) => (p.endsWith('/') ? `${p}index.html` : p).replace(/^\//, '');
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildSite(snap: Snapshot, opts: { origin: string }): Site {
  const origin = trimTrailingSlashes(opts.origin);
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) throw new Error('origin must be an https origin without a path');
  const files = new Map<string, string>();
  const indexable: { path: string; lastmod?: string; alternates: string[] }[] = [];
  const put = (p: string, content: string) => {
    if (!/^\/[a-z0-9/._-]+$/.test(p) || p.split('/').some((seg) => seg === '..' || seg === '.')) throw new Error(`unsafe path ${p}`);
    if (files.has(file(p))) throw new Error(`two pages at ${p}`);
    files.set(file(p), content);
  };
  for (const lang of LANGS) {
    const t = translator(lang);
    put(paths.index(lang), html(indexPage({ services: snap.services, lang, t, origin })));
    indexable.push({ path: paths.index(lang), alternates: LANGS.map((l) => paths.index(l)) });
    put(paths.offices(lang), html(officesPage({ offices: snap.offices, lang, t, origin })));
    indexable.push({ path: paths.offices(lang), alternates: LANGS.map((l) => paths.offices(l)) });
    for (const svc of snap.services) {
      const slug = svc.current.content.slug;
      const own = LANGS.filter((l) => hasLanguage(svc.current, l));
      put(paths.service(lang, slug), html(servicePage({ svc, v: svc.current, lang, t, origin, offices: snap.offices })));
      put(paths.history(lang, slug), html(historyPage({ svc, lang, t, origin })));
      if (own.includes(lang)) {
        const lastmod = svc.current.publishedAt.slice(0, 10) || undefined;
        indexable.push({ path: paths.service(lang, slug), lastmod, alternates: own.map((l) => paths.service(l, slug)) });
        indexable.push({ path: paths.history(lang, slug), lastmod, alternates: own.map((l) => paths.history(l, slug)) });
      }
      for (const v of svc.versions) {
        if (v === svc.current) continue;
        put(paths.version(lang, slug, v.content.version), html(servicePage({ svc, v, lang, t, origin, offices: snap.offices })));
      }
    }
  }
  put(paths.css, CSS);
  const hreflang = (p: string) => LANGS.find((l) => p.startsWith(`/${l}/`))!;
  put('/sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...indexable.map((u) => [
      '  <url>',
      `    <loc>${xml(origin + u.path)}</loc>`,
      ...(u.lastmod ? [`    <lastmod>${u.lastmod}</lastmod>`] : []),
      ...u.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${LOCALES[hreflang(a)]}" href="${xml(origin + a)}"/>`),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n'));
  // Served by the gateway at the origin's root together with the web app's paths (doc phase-5/02).
  put('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  return { files, indexable: indexable.map((u) => u.path) };
}
