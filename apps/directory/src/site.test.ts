import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { b64u, softwareKey } from '@civora/credentials';
import { ContentError, type Fetcher, LANGS, loadSnapshot, type Snapshot } from './content';
import { MESSAGE_KEYS, messagesOf } from './messages';
import { buildSite, HEADERS } from './site';

/**
 * The public directory pages (P5-D3, P5-A2, P5-F1..F3, P5-T2 internal links, P5-T3 structure) built from a fake core
 * whose content is signed with a software key, as the core signs with the HSM. Fixture content, not a curated procedure.
 */
const TYP = 'civora-catalogue-content+jws';
const ORIGIN = 'https://www.civora-cell.invalid';
const key = softwareKey({ kid: 'catalogue-content-1' });
const other = softwareKey({ kid: 'catalogue-content-1' });

async function sign(canonical: string, signer = key): Promise<string> {
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: 'catalogue-content-1', typ: TYP }));
  return `${h}..${b64u(await signer.sign(Buffer.from(`${h}.${b64u(canonical)}`, 'ascii')))}`;
}

const srcPage = { id: '11111111-1111-4111-8111-111111111111', kind: 'official-page', title: 'Page officielle (test)', publisher: 'Ministère (test)', url: 'https://example.invalid/page', jort_reference: null, language: 'fr', accessed_on: '2026-11-20' };
const srcLaw = { id: '22222222-2222-4222-8222-222222222222', kind: 'legal-text', title: 'Décret (test)', publisher: 'JORT', url: 'https://example.invalid/decret', jort_reference: 'JORT n° 0 (test)', language: 'fr', accessed_on: '2026-11-21' };
const office = {
  code: 'tunis-test-office', name: { ar: 'مكتب تجريبي', fr: 'Bureau de test' }, institution: { ar: 'بلدية', fr: 'Municipalité' }, governorate: 'Tunis',
  address: { ar: 'عنوان تجريبي', fr: 'Adresse de test' }, latitude: '36.800000', longitude: '10.180000', hours: { ar: '8:00–17:00', fr: '8 h – 17 h' },
  last_verified_on: '2026-11-22', source: srcPage,
};

function content(o: { code: string; slug: string; category: string; version: number; title: Record<string, string>; en?: boolean; fee?: number; note?: string }) {
  const tx = (a: string, f: string, e: string) => (o.en ? { ar: a, fr: f, en: e } : { ar: a, fr: f });
  return {
    code: o.code, slug: o.slug, category: o.category, version: o.version, title: o.title,
    summary: tx('ملخص تجريبي', 'Résumé de test', 'Test summary'), institution: tx('بلدية', 'Municipalité', 'Municipality'),
    online_url: 'https://services.example.invalid/apply', processing_time: tx('يوم واحد', 'Un jour', 'One day'),
    last_verified_on: '2026-11-25', change_note: o.note ?? 'first version',
    requirements: [
      { kind: 'step', position: 2, text: tx('سحب الوثيقة', 'Retirer le document', 'Collect the document'), amount_tnd: null, sources: [srcPage.id] },
      { kind: 'step', position: 1, text: tx('تقديم المطلب', 'Déposer la demande', 'Submit the request'), amount_tnd: null, sources: [srcLaw.id, srcPage.id] },
      { kind: 'document', position: 1, text: tx('بطاقة التعريف', "Carte d'identité", 'Identity card'), amount_tnd: null, sources: [srcLaw.id] },
      { kind: 'fee', position: 1, text: tx('معلوم', 'Frais', 'Fee'), amount_tnd: o.fee ?? 2, sources: [srcLaw.id] },
    ],
    offices: ['tunis-test-office'],
  };
}

interface Fake { routes: Map<string, unknown>; get: Fetcher }

async function fakeCore(mutate?: (r: Map<string, unknown>) => void | Promise<void>): Promise<Fake> {
  const routes = new Map<string, unknown>();
  const svc1v1 = JSON.stringify(content({ code: 'TN-CIV-001', slug: 'birth-extract', category: 'civil-status', version: 1, title: { ar: 'مضمون ولادة', fr: 'Extrait de naissance' } }));
  const svc1v2 = JSON.stringify(content({ code: 'TN-CIV-001', slug: 'birth-extract', category: 'civil-status', version: 2, title: { ar: 'مضمون ولادة', fr: 'Extrait de naissance' }, fee: 2.5, note: 'fee updated' }));
  // Markup in the content must stay text, in the page and in the schema.org block.
  const svc2v1 = JSON.stringify(content({ code: 'TN-IDN-001', slug: 'identity-card', category: 'identity', version: 1, en: true,
    title: { ar: 'بطاقة التعريف', fr: 'Carte </script><b>x</b> & "test"', en: 'Identity card </script><script>alert(1)</script>' } }));
  routes.set('/v1/services', [{ code: 'TN-IDN-001' }, { code: 'TN-CIV-001' }]);
  routes.set('/v1/catalogue/keys', { keys: [{ ...key.publicJwk, kid: 'catalogue-content-1', alg: 'ES256', use: 'sig' }] });
  routes.set('/v1/offices', [office]);
  routes.set('/v1/services/TN-CIV-001/versions', [{ version: 2, state: 'published' }, { version: 1, state: 'superseded' }]);
  routes.set('/v1/services/TN-IDN-001/versions', [{ version: 1, state: 'published' }]);
  for (const [code, v, c, at] of [['TN-CIV-001', 1, svc1v1, '2026-11-01T10:00:00Z'], ['TN-CIV-001', 2, svc1v2, '2026-11-26T10:00:00Z'], ['TN-IDN-001', 1, svc2v1, '2026-11-26T11:00:00Z']] as const) {
    routes.set(`/v1/services/${code}/versions/${v}/content`, { content: c, signature: await sign(c) });
    routes.set(`/v1/services/${code}/versions/${v}`, { sources: [srcPage, srcLaw], published_at: at, translation_review: 'pending' });
  }
  await mutate?.(routes);
  return {
    routes,
    get: async (path) => {
      if (!routes.has(path)) throw new ContentError(`GET ${path}: 404`);
      return structuredClone(routes.get(path));
    },
  };
}

const page = (site: Map<string, string>, p: string) => {
  const html = site.get(p);
  assert.ok(html, `no page ${p}`);
  return html;
};

describe('public directory pages (Phase 5, P5-D3, P5-A2)', () => {
  let snap: Snapshot;
  let files: Map<string, string>;
  let indexable: string[];

  it('loads only content whose signature verifies, and builds every page in three languages', async () => {
    snap = await loadSnapshot((await fakeCore()).get);
    assert.deepEqual(snap.services.map((s) => [s.current.content.code, s.versions.map((v) => `${v.content.version}:${v.state}`)]),
      [['TN-CIV-001', ['2:published', '1:superseded']], ['TN-IDN-001', ['1:published']]]);
    ({ files, indexable } = buildSite(snap, { origin: ORIGIN }));
    for (const l of LANGS) {
      for (const p of [`${l}/services/index.html`, `${l}/offices/index.html`, `${l}/services/birth-extract/index.html`, `${l}/services/birth-extract/history/index.html`,
        `${l}/services/birth-extract/v/1/index.html`, `${l}/services/identity-card/index.html`]) assert.ok(files.has(p), p);
      assert.ok(!files.has(`${l}/services/birth-extract/v/2/index.html`), 'the current version is the service page itself');
    }
    assert.ok(files.has('assets/directory.css') && files.has('sitemap.xml') && files.has('robots.txt'));
  });

  it('a service page: steps in order, documents, fees in TND, offices, numbered sources with JORT reference, last verified, digest (P5-F1)', () => {
    const fr = page(files, 'fr/services/birth-extract/index.html');
    assert.match(fr, /^<!DOCTYPE html><html lang="fr-TN" dir="ltr">/);
    assert.ok(fr.indexOf('Déposer la demande') < fr.indexOf('Retirer le document'), 'steps by position');
    assert.match(fr, /<ol class="parts parts-step">/);
    assert.match(fr, /2,500\s*DT/, 'fee formatted in TND');
    assert.match(fr, /Bureau de test/);
    assert.match(fr, /<li id="source-1"><span class="kind">Texte juridique<\/span> <bdi><a href="https:\/\/example.invalid\/decret"/, 'first cited source first');
    assert.match(fr, /Journal officiel \(JORT\) : <bdi>JORT n° 0 \(test\)<\/bdi>/);
    assert.ok(fr.includes('<span class="vh">Source </span>1</a></span><span><span class="sep">,</span><a href="#source-2" class="cite">'), 'citations separated');
    assert.match(fr, /href="#source-2"/);
    assert.match(fr, /Dernière vérification le 25 novembre 2026/);
    const digest = createHash('sha256').update(JSON.stringify(content({ code: 'TN-CIV-001', slug: 'birth-extract', category: 'civil-status', version: 2, title: { ar: 'مضمون ولادة', fr: 'Extrait de naissance' }, fee: 2.5, note: 'fee updated' })), 'utf8').digest('base64url');
    assert.ok(fr.includes(`<bdi><code dir="ltr">${digest}</code></bdi>`), 'the digest of the signed bytes, isolated');
    assert.match(fr, /La traduction de cette page n’a pas encore été relue|La traduction de cette page n&#x27;a pas encore été relue/);
  });

  it('Arabic pages are right to left; English without its own text shows French marked as French, and is not indexed', () => {
    const ar = page(files, 'ar/services/birth-extract/index.html');
    assert.match(ar, /^<!DOCTYPE html><html lang="ar-TN" dir="rtl">/);
    assert.match(ar, /<h1>مضمون ولادة<\/h1>/);
    const en = page(files, 'en/services/birth-extract/index.html');
    assert.match(en, /<html lang="en" dir="ltr">/);
    assert.match(en, /<h1><span lang="fr-TN" dir="ltr">Extrait de naissance<\/span><\/h1>/);
    assert.match(en, /not yet available in English/);
    assert.match(en, /<meta name="robots" content="noindex"\/>/);
    assert.ok(!indexable.includes('/en/services/birth-extract/'));
    assert.ok(indexable.includes('/en/services/identity-card/'), 'a procedure with English text is indexed in English');
    assert.ok(!/<link rel="alternate" hrefLang="en"/.test(ar), 'the Arabic page does not offer the fallback to search engines as an alternate');
    assert.match(ar, /<link rel="alternate" hrefLang="fr-TN" href="https:\/\/www\.civora-cell\.invalid\/fr\/services\/birth-extract\/"\/>/);
    assert.match(ar, /<a href="\/en\/services\/birth-extract\/" lang="en" hrefLang="en">English<\/a>/, 'readers can still switch to it');
  });

  it('the page carries no script and no inline style; markup in the content stays text, in the page and the schema.org block', () => {
    for (const [p, html] of files) {
      if (!p.endsWith('.html')) continue;
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      assert.ok(scripts.every((s) => s === '<script type="application/ld+json">'), `${p}: only data blocks`);
      assert.ok(!/\sstyle=|\son[a-z]+=/i.test(html), `${p}: no inline style or handler`);
      assert.ok(!/(href|src)="http:/.test(html), `${p}: https only`);
    }
    const en = page(files, 'en/services/identity-card/index.html');
    assert.ok(!en.includes('<script>alert'), 'no script injected');
    assert.match(en, /<h1>Identity card &lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/);
    const ld = en.match(/<script type="application\/ld\+json">([^<]*)<\/script>/);
    assert.ok(ld, 'one data block, not closed early');
    const data = JSON.parse(ld[1]!);
    assert.equal(data['@type'], 'GovernmentService');
    assert.equal(data.name, 'Identity card </script><script>alert(1)</script>');
    assert.equal(data.url, `${ORIGIN}/en/services/identity-card/`);
    assert.match(page(files, 'fr/services/identity-card/index.html'), /<h1>Carte &lt;\/script&gt;&lt;b&gt;x&lt;\/b&gt; &amp; &quot;test&quot;<\/h1>/);
    assert.match(HEADERS['content-security-policy']!, /script-src 'none'/);
  });

  it('structure for assistive technology (P5-T3): one h1, no skipped heading level, landmarks, skip link, labelled navigation', () => {
    for (const [p, html] of files) {
      if (!p.endsWith('.html')) continue;
      const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
      assert.equal(levels.filter((l) => l === 1).length, 1, `${p}: one h1`);
      assert.equal(levels[0], 1, `${p}: starts with h1`);
      levels.reduce((prev, l) => { assert.ok(l <= prev + 1, `${p}: h${prev} then h${l}`); return l; });
      for (const tag of ['<header', '<main id="main"', '<footer', '<a class="skip" href="#main"']) assert.ok(html.includes(tag), `${p}: ${tag}`);
      for (const nav of html.match(/<nav\b[^>]*>/g) ?? []) assert.match(nav, /aria-label="[^"]+"/, `${p}: labelled nav`);
      for (const a of html.match(/<a\b[^>]*>\s*<\/a>/g) ?? []) assert.fail(`${p}: empty link ${a}`);
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `${p}: ids unique`);
      for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(m[1]), `${p}: aria-labelledby ${m[1]}`);
    }
  });

  it('every internal link and fragment resolves to a generated page (P5-T2, internal links)', () => {
    for (const [p, html] of files) {
      if (!p.endsWith('.html')) continue;
      const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
        const href = m[1]!;
        if (href.startsWith('https://')) continue;
        if (href.startsWith('#')) { assert.ok(ids.has(href.slice(1)), `${p}: ${href}`); continue; }
        assert.ok(href.startsWith('/'), `${p}: ${href}`);
        const [path, frag] = href.split('#') as [string, string | undefined];
        const target = (path.endsWith('/') ? `${path}index.html` : path).slice(1);
        assert.ok(files.has(target), `${p}: ${href} → ${target}`);
        if (frag) assert.ok(new RegExp(`\\sid="${frag}"`).test(files.get(target)!), `${p}: ${href}`);
      }
    }
  });

  it('history: every version readable by number; an earlier version is marked, not indexed, and points to the current one (P5-F3)', () => {
    const h = page(files, 'fr/services/birth-extract/history/index.html');
    assert.ok(h.indexOf('Lire la version 2') < h.indexOf('Lire la version 1'), 'newest first');
    assert.match(h, /fee updated/);
    const v1 = page(files, 'fr/services/birth-extract/v/1/index.html');
    assert.match(v1, /version antérieure/);
    assert.match(v1, /<meta name="robots" content="noindex"\/>/);
    assert.match(v1, new RegExp(`<link rel="canonical" href="${ORIGIN}/fr/services/birth-extract/"/>`));
    assert.match(v1, /2,000\s*DT/, 'the old fee as it was signed');
  });

  it('sitemap with language alternates, robots.txt; the same snapshot gives the same bytes', () => {
    const sm = files.get('sitemap.xml')!;
    assert.match(sm, /<loc>https:\/\/www\.civora-cell\.invalid\/ar\/services\/birth-extract\/<\/loc>\n    <lastmod>2026-11-26<\/lastmod>/);
    assert.match(sm, /hreflang="fr-TN" href="https:\/\/www\.civora-cell\.invalid\/fr\/services\/identity-card\/"/);
    assert.ok(!sm.includes('/v/1/'), 'earlier versions are not in the sitemap');
    assert.equal(files.get('robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    assert.deepEqual([...buildSite(snap, { origin: ORIGIN }).files], [...files]);
    assert.throws(() => buildSite(snap, { origin: 'http://www.civora-cell.invalid' }), /https origin/);
  });

  it('offices page by governorate, with address, hours, map link and source (P5-F2)', () => {
    const o = page(files, 'ar/offices/index.html');
    assert.match(o, /<h2 id="gov-1">Tunis<\/h2>/);
    assert.match(o, /مكتب تجريبي/);
    assert.match(o, /href="https:\/\/www\.openstreetmap\.org\/\?mlat=36\.8&amp;mlon=10\.18#map=18\/36\.8\/10\.18"/);
    assert.match(o, /href="https:\/\/example\.invalid\/page"/);
  });

  it('nothing is written when a signature fails, a cited source or office is missing, or no key is published (P5-SEC3)', async () => {
    const refused = async (mutate: (r: Map<string, unknown>) => void | Promise<void>, re: RegExp) =>
      assert.rejects(loadSnapshot((await fakeCore(mutate)).get), (e: unknown) => e instanceof ContentError && re.test(e.message), String(re));
    await refused((r) => { const c = r.get('/v1/services/TN-CIV-001/versions/2/content') as { content: string }; c.content = c.content.replace('"amount_tnd":2.5', '"amount_tnd":25'); },
      /TN-CIV-001: the signature does not verify/);
    await refused(async (r) => { const c = r.get('/v1/services/TN-IDN-001/versions/1/content') as { content: string; signature: string }; c.signature = await sign(c.content, other); },
      /TN-IDN-001: the signature does not verify/);
    await refused((r) => { (r.get('/v1/services/TN-CIV-001/versions/1') as { sources: unknown[] }).sources = [srcPage]; }, /TN-CIV-001: cited sources missing: 2222/);
    await refused((r) => { r.set('/v1/offices', []); }, /offices missing: tunis-test-office/);
    await refused((r) => { r.set('/v1/catalogue/keys', { keys: [] }); }, /publishes no content key/);
    await refused(async (r) => { const c = r.get('/v1/services/TN-CIV-001/versions/1/content') as { content: string; signature: string };
      const two = (r.get('/v1/services/TN-CIV-001/versions/2/content') as { content: string; signature: string }); c.content = two.content; c.signature = two.signature; },
    /another service or version/);
    await refused((r) => { r.set('/v1/services/TN-IDN-001/versions/1', { sources: [srcPage, { ...srcLaw, url: 'http://example.invalid/decret' }] }); }, /not https/);
  });

  it('interface text exists in Arabic, French and English for every key', () => {
    for (const l of LANGS) for (const k of MESSAGE_KEYS) assert.equal(typeof messagesOf(l)[k], 'string', `${l}: ${k}`);
  });
});
