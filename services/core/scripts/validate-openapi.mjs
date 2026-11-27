#!/usr/bin/env node
/**
 * Contract gate (ADR-015, O-API3):
 *  1. The committed contract validates against the official OpenAPI 3.1 JSON Schema.
 *  2. House rules: every operation has a unique operationId, a summary and a tag; business paths are under /v1;
 *     no OpenAPI 3.0-only keywords (`nullable`) remain; /metrics is never public.
 * Usage: node scripts/validate-openapi.mjs [openapi/core.openapi.json]
 */
import { readFileSync } from 'node:fs';
import { Validator } from '@seriousme/openapi-schema-validator';

const file = process.argv[2] ?? 'openapi/core.openapi.json';
const doc = JSON.parse(readFileSync(file, 'utf8'));
const problems = [];

const validator = new Validator();
const res = await validator.validate(doc);
if (!res.valid) problems.push(`schema: ${JSON.stringify(res.errors)}`);
if (validator.version !== '3.1') problems.push(`expected OpenAPI 3.1, found ${validator.version}`);

const ids = new Set();
const methods = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];
for (const [path, item] of Object.entries(doc.paths ?? {})) {
  if (path === '/metrics' || path.startsWith('/metrics/')) problems.push(`${path}: internal endpoint in the public contract`);
  // Discovery documents live where their standards put them (RFC 8615 /.well-known/; OpenID4VCI 1.0 §12.2.2, RFC 8414 §3).
  if (!path.startsWith('/v1/') && !path.startsWith('/health') && !path.startsWith('/.well-known/')) problems.push(`${path}: business paths must be versioned under /v1`);
  for (const m of methods) {
    const op = item[m];
    if (!op) continue;
    const where = `${m.toUpperCase()} ${path}`;
    if (!op.operationId) problems.push(`${where}: missing operationId`);
    else if (ids.has(op.operationId)) problems.push(`${where}: duplicate operationId ${op.operationId}`);
    else ids.add(op.operationId);
    if (!op.summary) problems.push(`${where}: missing summary`);
    if (!op.tags?.length) problems.push(`${where}: missing tag`);
  }
}
const walk = (node, at) => {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}/${i}`));
  if (node && typeof node === 'object') {
    if ('nullable' in node) problems.push(`${at}: 3.0 keyword "nullable"`);
    for (const [k, v] of Object.entries(node)) walk(v, `${at}/${k}`);
  }
};
walk(doc, '#');

if (problems.length) {
  console.error(`OpenAPI contract check failed (${problems.length}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`OpenAPI ${validator.version} contract valid: ${Object.keys(doc.paths).length} paths, ${ids.size} operations, house rules pass.`);
