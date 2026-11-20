import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:net';
import { describe, it } from 'node:test';
import { waitForDatabase } from './wait-for-database';

describe('waitForDatabase', () => {
  it('gives up after the timeout when nothing listens, logging no connection details', async () => {
    const lines: string[] = [];
    const started = Date.now();
    const ok = await waitForDatabase('postgres://user:secret-pw@127.0.0.1:1/db', 1500, 300, (m) => lines.push(m));
    assert.equal(ok, false);
    assert.ok(Date.now() - started >= 1000, 'should keep retrying until close to the deadline');
    assert.ok(lines.length === 1 && /not reachable after \d+ attempts/.test(lines[0]));
    assert.ok(!lines.join('').includes('secret-pw') && !lines.join('').includes('127.0.0.1'));
  });

  it('keeps retrying while connections are refused, then succeeds once the database answers', { skip: !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL not set' }, async () => {
    const real = new URL(process.env.TEST_DATABASE_URL as string);
    const target = { host: real.hostname, port: Number(real.port || 5432) };
    // A local port that refuses for ~1 s, then forwards to the real database (simulates a policy not yet programmed).
    const { connect } = await import('node:net');
    let server: Server | undefined;
    const port = await new Promise<number>((resolve) => {
      const probe = createServer().listen(0, '127.0.0.1', () => {
        const p = (probe.address() as { port: number }).port;
        probe.close(() => resolve(p));
      });
    });
    setTimeout(() => {
      server = createServer((sock) => {
        const up = connect(target.port, target.host);
        sock.pipe(up).pipe(sock);
        sock.on('error', () => up.destroy());
        up.on('error', () => sock.destroy());
      }).listen(port, '127.0.0.1');
    }, 1000);
    real.hostname = '127.0.0.1';
    real.port = String(port);
    const lines: string[] = [];
    const ok = await waitForDatabase(real.toString(), 10_000, 250, (m) => lines.push(m));
    server?.close();
    assert.equal(ok, true);
    assert.match(lines[0], /database reachable \(attempt ([2-9]|\d{2,})\)/);
  });
});
