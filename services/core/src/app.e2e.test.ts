import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { buildOpenApi, createApp } from './app.factory';

process.env.CIVORA_ENV = 'test';
delete process.env.DATABASE_URL;

describe('civora-core walking skeleton (O-T1)', () => {
  let app: INestApplication;
  let base: string;
  before(async () => {
    app = await createApp({ logger: false });
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });
  after(async () => app.close());

  it('GET /health returns ok with the verified country pack', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, any>;
    assert.equal(body.status, 'ok');
    assert.equal(body.countryPack.id, 'tn');
    assert.equal(body.countryPack.status, 'synthetic-development-only');
    assert.match(body.countryPack.digest, /^[0-9a-f]{64}$/);
    assert.equal(body.checks.database, 'not-configured');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('x-request-id'));
  });

  it('GET /v1/meta/locales negotiates Arabic and reports RTL', async () => {
    const res = await fetch(`${base}/v1/meta/locales`, { headers: { 'accept-language': 'ar;q=0.9, fr;q=0.5' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-language'), 'ar-TN');
    const body = (await res.json()) as Record<string, any>;
    assert.equal(body.default, 'ar-TN');
    assert.equal(body.negotiated, 'ar-TN');
    const ar = body.locales.find((l: any) => l.code === 'ar-TN');
    assert.equal(ar.dir, 'rtl');
    assert.equal(ar.numberingSystem, 'latn');
    const fr = body.locales.find((l: any) => l.code === 'fr-TN');
    assert.equal(fr.dir, 'ltr');
  });

  it('GET /v1/meta/locales falls back to French for an unsupported language', async () => {
    const res = await fetch(`${base}/v1/meta/locales`, { headers: { 'accept-language': 'de-DE, fr;q=0.4' } });
    const body = (await res.json()) as Record<string, any>;
    assert.equal(body.negotiated, 'fr-TN');
  });

  it('echoes a valid X-Request-Id and replaces an invalid one', async () => {
    const ok = await fetch(`${base}/health`, { headers: { 'x-request-id': 'abcdef12-3456' } });
    assert.equal(ok.headers.get('x-request-id'), 'abcdef12-3456');
    const bad = await fetch(`${base}/health`, { headers: { 'x-request-id': '<script>' } });
    assert.notEqual(bad.headers.get('x-request-id'), '<script>');
  });

  it('unknown routes return RFC 9457 problem details', async () => {
    const res = await fetch(`${base}/v1/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /application\/problem\+json/);
    const body = (await res.json()) as Record<string, any>;
    assert.equal(body.status, 404);
    assert.equal(body.instance, '/v1/does-not-exist');
  });

  it('exposes Prometheus metrics but keeps them out of the public contract', async () => {
    const res = await fetch(`${base}/metrics`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /civora_core_process_cpu/);
    const doc = buildOpenApi(app, 'test');
    assert.ok(doc.paths['/health']);
    assert.ok(doc.paths['/v1/meta/locales']);
    assert.equal(doc.paths['/metrics'], undefined);
  });
});
