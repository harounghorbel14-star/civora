import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initFlags } from './index';

test('pack defaults, tenant overrides and locked platform flags', async () => {
  const client = await initFlags(
    {
      packDefaults: { 'meta.locales.english': true, 'workspace.customer-status-page': false, 'integrations.production-adapters': false },
      tenantOverrides: { 'bank-a': { 'workspace.customer-status-page': true, 'integrations.production-adapters': true } },
    },
    'test-1',
  );
  assert.equal(await client.getBooleanValue('meta.locales.english', false), true);
  assert.equal(await client.getBooleanValue('workspace.customer-status-page', false, { tenantId: 'bank-b' }), false);
  assert.equal(await client.getBooleanValue('workspace.customer-status-page', false, { tenantId: 'bank-a' }), true);
  // a tenant can never switch on production adapters (ADR-021, ADR-028)
  assert.equal(await client.getBooleanValue('integrations.production-adapters', false, { tenantId: 'bank-a' }), false);
  // unknown flag falls back to the caller default
  assert.equal(await client.getBooleanValue('not.declared', true), true);
});

test('overrides of undeclared flags are rejected', async () => {
  await assert.rejects(initFlags({ packDefaults: {}, tenantOverrides: { t: { rogue: true } } }, 'test-2'));
});
