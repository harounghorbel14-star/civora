import { strict as assert } from 'node:assert';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { filterAttributes } from './tracing';

describe('span attribute allow-list (unit)', () => {
  it('keeps route templates and status codes, drops URLs, client data and SQL text', () => {
    const out = filterAttributes({
      'http.route': '/v1/meta/locales',
      'http.response.status_code': 200,
      'url.full': 'http://x/v1/meta/locales?cin=99123456',
      'url.query': 'cin=99123456',
      'client.address': '10.0.0.7',
      'user_agent.original': 'Mozilla',
      'db.statement': "select * from t where cin = '99123456'",
      'db.query.text': 'select 1',
      'db.system': 'postgresql',
    });
    assert.deepEqual(out, { 'http.route': '/v1/meta/locales', 'http.response.status_code': 200, 'db.system': 'postgresql' });
  });
});

/**
 * End-to-end scrubbing test (ADR-011): run the real service with tracing pointed at a fake collector, send requests
 * carrying synthetic identifiers in the query string and headers, and assert they never appear in exported spans.
 */
describe('exported traces contain no request data (e2e)', () => {
  let collector: Server;
  let child: ChildProcess;
  const bodies: string[] = [];
  let appPort = 0;

  const freePort = () =>
    new Promise<number>((res) => {
      const s = createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = (s.address() as AddressInfo).port;
        s.close(() => res(p));
      });
    });

  before(async () => {
    collector = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        bodies.push(Buffer.concat(chunks).toString('utf8'));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      });
    });
    await new Promise<void>((r) => collector.listen(0, '127.0.0.1', () => r()));
    const collectorPort = (collector.address() as AddressInfo).port;
    appPort = await freePort();
    child = spawn(process.execPath, [resolve(__dirname, '..', 'main.js')], {
      env: {
        ...process.env,
        CIVORA_ENV: 'test',
        PORT: String(appPort),
        DATABASE_URL: '',
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collectorPort}`,
        OTEL_BSP_SCHEDULE_DELAY: '100',
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
      stdio: 'ignore',
    });
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`http://127.0.0.1:${appPort}/health`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('service did not start');
  });

  after(async () => {
    child?.kill('SIGTERM');
    await new Promise((r) => collector.close(() => r(undefined)));
  });

  it('exports spans for business routes with templates only', async () => {
    await fetch(`http://127.0.0.1:${appPort}/v1/meta/locales?cin=99123456&phone=%2B21601234567`, {
      headers: { 'accept-language': 'ar', 'x-customer-email': 'person@synthetic.invalid', 'user-agent': 'synthetic-agent/1.0' },
    });
    await fetch(`http://127.0.0.1:${appPort}/v1/unknown/99123456`);
    // A route with a parameter, turned away by its own guard (no token): the template is still recorded, not the id.
    await fetch(`http://127.0.0.1:${appPort}/v1/oid4vp/requests/7d3f1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b`);
    for (let i = 0; i < 50 && !(bodies.join('').includes('/v1/meta/locales') && bodies.join('').includes('/v1/oid4vp/requests/:id')); i++) await new Promise((r) => setTimeout(r, 100));
    const all = bodies.join('\n');
    assert.ok(all.includes('civora-core'), 'service.name exported');
    assert.ok(all.includes('/v1/meta/locales'), 'route template exported');
    assert.ok(all.includes('/v1/oid4vp/requests/:id'), 'the template of a parameterised route, even when its guard refuses');
    for (const secret of ['7d3f1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b', '99123456', '21601234567', 'synthetic.invalid', 'synthetic-agent', '127.0.0.1', 'cin=', 'phone=']) {
      assert.ok(!all.includes(secret), `exported spans must not contain "${secret}"`);
    }
    assert.ok(!/"\/health"/.test(all), 'health checks are not traced');
  });
});
