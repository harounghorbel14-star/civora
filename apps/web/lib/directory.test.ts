import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { publicCoreGet } from './core';
import { loadConfig } from './config';
import { reportMessage, reportTarget, searchHits, searchQuery, textIn } from './directory';
import { CATALOGUES } from './messages';

/** The directory's search and error reports in the web app (Phase 5, P5-D4, P5-F4; doc phase-5/03). */
describe('services directory: search and error reports (Phase 5)', () => {
  it('a search query is one value of 2 to 200 characters', () => {
    assert.equal(searchQuery('  الهوية '), 'الهوية');
    assert.equal(searchQuery('a'), null);
    assert.equal(searchQuery('x'.repeat(201)), null);
    assert.equal(searchQuery(['a', 'b']), null, 'a repeated key (an array) is refused');
    assert.equal(searchQuery(undefined), null);
  });

  it('only well-formed hits are shown: a slug that is not the catalogue\'s pattern never becomes a link', () => {
    const ok = { code: 'TN-CIV-001', slug: 'birth-extract', title: { ar: 'مضمون', fr: 'Extrait' }, summary: { ar: 'ملخص', fr: 'Résumé' }, last_verified_on: '2026-11-25' };
    assert.deepEqual(searchHits([ok]), [{ code: 'TN-CIV-001', slug: 'birth-extract', title: ok.title, summary: ok.summary, lastVerifiedOn: '2026-11-25' }]);
    for (const bad of [{ ...ok, slug: '../admin' }, { ...ok, slug: 'javascript:alert(1)' }, { ...ok, code: 'X' }, { ...ok, title: 'text' }, { ...ok, last_verified_on: 'soon' }, null]) {
      assert.deepEqual(searchHits([bad]), [], JSON.stringify(bad));
    }
    assert.deepEqual(searchHits({ error: 'x' }), []);
  });

  it('English falls back to French and says so', () => {
    assert.deepEqual(textIn({ ar: 'أ', fr: 'F' }, 'en'), { text: 'F', lang: 'fr' });
    assert.deepEqual(textIn({ ar: 'أ', fr: 'F', en: 'E' }, 'en'), { text: 'E', lang: 'en' });
    assert.deepEqual(textIn({ ar: 'أ', fr: 'F' }, 'ar'), { text: 'أ', lang: 'ar' });
  });

  it('a report names a published version by code and number, and carries 5 to 2000 characters', () => {
    assert.deepEqual(reportTarget('TN-CIV-001', '2'), { code: 'TN-CIV-001', version: 2 });
    for (const [c, v] of [['TN-CIV-001', '0'], ['TN-CIV-001', '2.5'], ['TN-CIV-001', ['2']], ['tn-civ-001', '2'], [undefined, '1']] as const) assert.equal(reportTarget(c, v), null);
    assert.equal(reportMessage('  Le montant a changé.  '), 'Le montant a changé.');
    assert.equal(reportMessage('abc'), null);
    assert.equal(reportMessage('x'.repeat(2001)), null);
  });

  it('the public GET calls the core without credentials, with the correlation id', async () => {
    const cfg = loadConfig({ CIVORA_ENV: 'test', APP_ORIGIN: 'http://localhost:3100', OIDC_ISSUER: 'http://localhost:8080/realms/civora-citizens', CORE_URL: 'http://127.0.0.1:3000', OIDC_CLIENT_KEY_FILE: '/k' },
      () => '-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----\n');
    let seen: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('[]', { status: 200 }); }) as unknown as typeof fetch;
    const r = await publicCoreGet(cfg, '/v1/services?q=ab', 'cid-1', fake);
    assert.deepEqual(r, { status: 200, body: [] });
    assert.equal(seen!.url, 'http://127.0.0.1:3000/v1/services?q=ab');
    const h = seen!.init.headers as Record<string, string>;
    assert.equal(h['x-request-id'], 'cid-1');
    assert.ok(!('authorization' in h) && !('cookie' in h), 'no credentials');
    assert.equal(seen!.init.method, undefined, 'GET');
  });

  it('the new texts exist in Arabic, French and English with the same placeholders', () => {
    const keys = Object.keys(CATALOGUES.en).filter((k) => k.startsWith('services.') || k === 'nav.services');
    assert.ok(keys.length >= 20);
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const l of ['fr', 'ar'] as const) for (const k of keys) {
      assert.equal(typeof CATALOGUES[l][k], 'string', `${l}: ${k}`);
      assert.equal(ph(CATALOGUES[l][k] as string), ph(CATALOGUES.en[k] as string), `${l}: ${k} placeholders`);
    }
  });
});
