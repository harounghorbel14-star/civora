import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { createApp, JsonLogger } from './app.factory';

process.env.CIVORA_ENV = 'test';
delete process.env.DATABASE_URL;

/**
 * Log privacy (Phase 0 §10.6; docs/phase-2/07 §7.3): requests carry a synthetic canary value in every place a client
 * controls (query, path, headers, cookies, body, malformed body). The canary must never appear in any log line, and
 * error responses must not echo it beyond the request path (RFC 9457 `instance`; personal identifiers are never
 * allowed in paths by the API standard, docs/phase-2/10).
 */
describe('log privacy: client-controlled values never reach the logs', () => {
  const canary = `canary${randomBytes(6).toString('hex')}`;
  const lines: string[] = [];
  const responses: { what: string; status: number; text: string; headers: string }[] = [];
  let app: INestApplication;
  let base: string;
  const original = { out: process.stdout.write.bind(process.stdout), err: process.stderr.write.bind(process.stderr) };

  before(async () => {
    // Application loggers write strings; the test runner's own protocol messages are binary and pass through.
    const capture = (target: typeof original.out) => ((chunk: unknown, ...rest: unknown[]): boolean => {
      if (typeof chunk === 'string') { lines.push(chunk); return true; }
      return (target as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;
    process.stdout.write = capture(original.out);
    process.stderr.write = capture(original.err);
    app = await createApp({ logger: new JsonLogger() });
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;

    const send = async (what: string, path: string, init: RequestInit = {}): Promise<void> => {
      const res = await fetch(base + path, init);
      responses.push({ what, status: res.status, text: await res.text(), headers: JSON.stringify([...res.headers]) });
    };
    const headers = {
      authorization: `Bearer ${canary}`,
      cookie: `session=${canary}`,
      'user-agent': canary,
      'x-forwarded-for': `10.0.0.1, ${canary}`,
      'x-request-id': `bad ${canary}`,
      'accept-language': `${canary};q=0.9`,
      'x-national-id': canary,
    };
    await send('query + headers on a known route', `/health?nationalId=${canary}`, { headers });
    await send('locales with a hostile accept-language', '/v1/meta/locales', { headers });
    await send('unknown route with the canary in the query', `/v1/unknown?email=${canary}`, { headers });
    await send('JSON body to an unknown route', '/v1/unknown', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ nationalId: canary }) });
    await send('malformed JSON body', '/health', { method: 'POST', headers: { 'content-type': 'application/json' }, body: `{"nationalId": ${canary}` });
    await send('form body', '/health', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `nationalId=${canary}` });
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    await app.close();
    process.stdout.write = original.out;
    process.stderr.write = original.err;
  });

  it('the requests were actually made and logs were captured (control)', () => {
    assert.deepEqual(responses.map((r) => r.status), [200, 200, 404, 404, 400, 404]);
    assert.ok(lines.some((l) => l.includes('"service":"civora-core"')), 'expected start-up log lines from JsonLogger');
  });

  it('no log line contains the canary', () => {
    const leaked = lines.filter((l) => l.includes(canary));
    assert.deepEqual(leaked, []);
  });

  it('every log line is structured JSON with the fixed field set only', () => {
    for (const raw of lines.join('').split('\n').filter(Boolean)) {
      const entry = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(entry)) assert.ok(['ts', 'level', 'service', 'context', 'msg'].includes(key), `unexpected log field ${key}`);
    }
  });

  it('error responses use problem details with the right status and do not echo the canary (query, headers, body)', () => {
    for (const r of responses.filter((x) => x.status >= 400)) {
      assert.ok(r.status < 500, `${r.what}: client errors must not become ${r.status}`);
      assert.ok(!r.text.includes(canary), `${r.what}: response body echoes the canary: ${r.text}`);
      assert.ok(!r.headers.includes(canary), `${r.what}: response headers echo the canary`);
    }
  });
});
