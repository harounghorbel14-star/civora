#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from './index';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : def;
}
const out = arg('out', 'out/synthetic');
const ds = generate({ seed: Number(arg('seed', '42')), tenants: Number(arg('tenants', '3')), casesPerTenant: Number(arg('cases', '200')), packId: arg('pack', 'tn') });
mkdirSync(out, { recursive: true });
for (const key of ['tenants', 'customers', 'cases'] as const) {
  writeFileSync(join(out, `${key}.jsonl`), ds[key].map((x) => JSON.stringify(x)).join('\n') + '\n');
}
writeFileSync(join(out, 'README.txt'), `SYNTHETIC DATA — NOT REAL PEOPLE OR INSTITUTIONS. Generated ${JSON.stringify(ds.generatedWith)}\n`);
console.log(`wrote ${ds.tenants.length} tenants, ${ds.customers.length} customers, ${ds.cases.length} cases to ${out}`);
