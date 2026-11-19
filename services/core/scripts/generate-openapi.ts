/**
 * OpenAPI generation pipeline (O-API3, ADR-015).
 * Boots the application module without listening, writes a stable (key-sorted) JSON contract.
 * CI regenerates and fails when the committed contract differs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOpenApi, createApp } from '../src/app.factory';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]));
  }
  return value;
}

async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? 'openapi/core.openapi.json');
  process.env.CIVORA_ENV ??= 'test';
  const app = await createApp({ logger: false });
  await app.init();
  const doc = buildOpenApi(app, process.env.APP_VERSION ?? '0.1.0');
  await app.close();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(sortKeys(doc), null, 2) + '\n');
  process.stdout.write(`wrote ${out} (${Object.keys(doc.paths).length} paths)\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(String(err instanceof Error ? err.stack : err) + '\n');
  process.exit(1);
});
