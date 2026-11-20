import { Client } from 'pg';
import { readFileSync } from 'node:fs';

/**
 * Waits until the database accepts a connection; run before migrations (migration Job, ADR-024).
 * A new pod can be refused for a moment until network policy is programmed for its IP (seen with k3s in the
 * staging rehearsal, 20 Nov 2026), and a deploy may coincide with a database failover. Logs fixed messages only:
 * never the URL, host or error text.
 */
export async function waitForDatabase(
  url: string,
  timeoutMs: number,
  intervalMs = 1000,
  log: (msg: string) => void = (msg) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'info', service: 'civora-core', context: 'wait-for-database', msg }) + '\n'),
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; ; attempt++) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: Math.max(500, Math.min(5000, timeoutMs)) });
    client.on('error', () => undefined); // a dropped connection must not crash the process
    try {
      await client.connect();
      await client.query('select 1');
      await client.end();
      log(`database reachable (attempt ${attempt})`);
      return true;
    } catch {
      await client.end().catch(() => undefined);
    }
    if (Date.now() + intervalMs > deadline) {
      log(`database not reachable after ${attempt} attempts`);
      return false;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

if (require.main === module) {
  const file = process.env.DATABASE_URL_FILE;
  const url = file ? readFileSync(file, 'utf8').trim() : process.env.DATABASE_URL;
  const seconds = Number(process.env.WAIT_FOR_DATABASE_SECONDS ?? '60');
  if (!url) {
    process.stderr.write('DATABASE_URL or DATABASE_URL_FILE is required\n');
    process.exit(2);
  }
  void waitForDatabase(url, seconds * 1000).then((ok) => process.exit(ok ? 0 : 1));
}
