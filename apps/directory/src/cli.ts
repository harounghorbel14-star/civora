#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { ContentError, coreFetcher, loadSnapshot } from './content';
import { buildSite, HEADERS } from './site';

/**
 * Generates the public directory (P5-A2) from the core's public API into a NEW directory:
 *   civora-directory --core http://civora-core:3000 --origin https://www.civora-cell.invalid --out /srv/directory/<id>
 * The output directory must not exist (or be empty): a run never edits the site being served. Deployment switches to
 * the new directory once the run has succeeded (doc phase-5/02). A service whose signature does not verify, or whose
 * cited sources or offices are missing, stops the run before anything is written (exit 2).
 * Also writes `_manifest.json` (every file with its SHA-256) and `_headers.json` (the response headers to serve).
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

export async function main(): Promise<number> {
  const core = arg('core');
  const origin = arg('origin');
  const out = arg('out');
  if (!core || !origin || !out) {
    process.stderr.write('usage: civora-directory --core <core URL> --origin <https origin> --out <new directory>\n');
    return 64;
  }
  const dir = resolve(out);
  if (existsSync(dir) && readdirSync(dir).length) {
    process.stderr.write('the output directory exists and is not empty: write each build to a new directory\n');
    return 73;
  }
  let snap;
  try {
    snap = await loadSnapshot(coreFetcher(core));
  } catch (e) {
    if (e instanceof ContentError) {
      process.stderr.write(`refused, nothing written: ${e.message}\n`);
      return 2;
    }
    throw e;
  }
  const site = buildSite(snap, { origin });
  const manifest: Record<string, string> = {};
  for (const [p, content] of [...site.files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // The paths are checked when the site is built; check again that nothing lands outside the output directory.
    const target = resolve(dir, p);
    if (!target.startsWith(dir + sep)) throw new Error(`refusing to write outside the output directory: ${p}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, { encoding: 'utf8', mode: 0o644 });
    manifest[p] = createHash('sha256').update(content, 'utf8').digest('hex');
  }
  writeFileSync(join(dir, '_manifest.json'), `${JSON.stringify({ services: snap.services.length, offices: snap.offices.length, files: manifest }, null, 2)}\n`);
  writeFileSync(join(dir, '_headers.json'), `${JSON.stringify(HEADERS, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ msg: 'directory generated', services: snap.services.length, offices: snap.offices.length, files: site.files.size })}\n`);
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (e: unknown) => {
    process.stderr.write(`failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
