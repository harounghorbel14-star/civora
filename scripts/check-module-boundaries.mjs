#!/usr/bin/env node
/**
 * Architecture fitness function (ADR-001, docs/phase-2/18-coding-standards.md §4).
 * 1. A bounded context in services/core/src/modules/<m> may import another module only through
 *    ../<other>/public-api (never its internals).
 * 2. Platform code (src/common, health, meta, ...) must not import module internals.
 * 3. packages/* must not import services/* or apps/*.
 * 4. No source file may reference a non-synthetic Tunisian identifier pattern in test data
 *    (CIN outside 99xxxxxx or +216 numbers outside +2160xxxxxxx) — guards rule "no real personal data".
 * Exits 1 with a list of violations.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const violations = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}
const importRe = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const importsOf = (file) => [...readFileSync(file, 'utf8').matchAll(importRe)].map((m) => m[1] ?? m[2]);

const coreSrc = join(root, 'services', 'core', 'src');
const modulesDir = join(coreSrc, 'modules');
for (const file of walk(coreSrc)) {
  const rel = relative(coreSrc, file).split(sep);
  const ownModule = rel[0] === 'modules' ? rel[1] : null;
  for (const spec of importsOf(file)) {
    if (!spec.startsWith('.')) continue;
    const target = relative(coreSrc, resolve(file, '..', spec)).split(sep);
    if (target[0] !== 'modules') continue;
    const targetModule = target[1];
    const isPublic = target.length === 3 && target[2] === 'public-api';
    const isModuleFile = target.length === 3 && target[2] === `${targetModule}.module`;
    if (ownModule === targetModule) continue;
    if (isPublic) continue;
    if (!ownModule && rel[0] === 'app.module.ts' && isModuleFile) continue;
    violations.push(`${relative(root, file)} imports ${spec} (module internals of "${targetModule}")`);
  }
}
for (const file of walk(join(root, 'packages'))) {
  for (const spec of importsOf(file)) {
    if (/(^|\/)(services|apps)\//.test(spec) || spec.startsWith('@civora/core')) violations.push(`${relative(root, file)} imports ${spec} (packages must not depend on services/apps)`);
  }
}
const cinLike = /\b(?:CIN|cin)\b[^\n]{0,20}['"](?!99)\d{8}['"]/;
const phoneLike = /\+216(?!0)\d{8}\b/;
for (const file of [...walk(join(root, 'packages')), ...walk(join(root, 'services'))]) {
  const text = readFileSync(file, 'utf8');
  if (cinLike.test(text)) violations.push(`${relative(root, file)} contains a CIN-like literal outside the synthetic range 99xxxxxx`);
  if (phoneLike.test(text)) violations.push(`${relative(root, file)} contains a +216 number outside the synthetic range +2160xxxxxxx`);
}

if (violations.length) {
  console.error(`Module-boundary check failed (${violations.length}):\n- ` + violations.join('\n- '));
  process.exit(1);
}
const modules = readdirSync(modulesDir).length;
console.log(`Module-boundary check passed (${modules} bounded contexts, packages isolated, no non-synthetic identifiers).`);
