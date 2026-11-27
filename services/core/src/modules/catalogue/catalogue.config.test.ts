import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CatalogueError } from './catalogue.repository';
import { Catalogue, loadCatalogueConfig, ROLES, type Editor } from './catalogue.service';

/**
 * The editorial settings (doc phase-5/01 §3): the editors' institution is required outside dev and test even when the
 * cell has no content-signing key, and a key named in part is refused at start-up.
 */
describe('catalogue configuration (P5-SEC1, P5-SEC2)', () => {
  const key = { CATALOGUE_HSM_MODULE: '/usr/lib/softhsm/libsofthsm2.so', CATALOGUE_SIGNING_TOKEN: 'civora-content', CATALOGUE_SIGNING_KEY_ID: '0C', CATALOGUE_SIGNING_KID: 'catalogue-content-1' };

  it('outside dev and test, the editors\' institution is required, with or without a signing key', () => {
    for (const env of ['staging', 'pilot', 'prod']) {
      assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: env }), /CATALOGUE_EDITOR_TENANT is required/);
      assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: env, ...key }), /CATALOGUE_EDITOR_TENANT is required/);
    }
    assert.deepEqual(loadCatalogueConfig({ CIVORA_ENV: 'staging', CATALOGUE_EDITOR_TENANT: 'operator' }), { hsm: null, editorTenant: 'operator' });
    assert.deepEqual(loadCatalogueConfig({ CIVORA_ENV: 'dev' }), { hsm: null, editorTenant: null });
  });

  it('a signing key named in part, or without a module, is a configuration error', () => {
    assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: 'test', CATALOGUE_SIGNING_TOKEN: 'civora-content' }), /needs CATALOGUE_SIGNING_TOKEN/);
    assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: 'test', ...key, CATALOGUE_SIGNING_KID: '' }), /needs CATALOGUE_SIGNING_TOKEN/);
    assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: 'test', ...key, CATALOGUE_HSM_MODULE: '' }), /needs CATALOGUE_SIGNING_TOKEN/);
    assert.throws(() => loadCatalogueConfig({ CIVORA_ENV: 'test', ...key, CATALOGUE_SIGNING_KEY_ID: 'zz' }), /is hex/);
    const cfg = loadCatalogueConfig({ CIVORA_ENV: 'test', ...key, CATALOGUE_EDITOR_TENANT: 'operator' });
    assert.deepEqual(cfg.hsm, { module: key.CATALOGUE_HSM_MODULE, tokenLabel: 'civora-content', keyId: '0c', kid: 'catalogue-content-1', pinEnv: 'CIVORA_HSM_PIN' });
  });

  it('without a signing key, only the operator\'s editors may draft, and approval is refused', async () => {
    const calls: string[] = [];
    const repo = { addSource: async () => { calls.push('addSource'); return 'src'; }, canonical: async () => '{}' } as never;
    const cat = new Catalogue(repo, loadCatalogueConfig({ CIVORA_ENV: 'staging', CATALOGUE_EDITOR_TENANT: 'operator' }));
    const src = { kind: 'official-page', title: 't', publisher: 'p', url: 'https://example.invalid/', jortReference: null, language: 'fr', accessedOn: '2026-11-27' };
    const staff = (tenantId: string | null, roles: string[]): Editor => ({ personId: '00000000-0000-4000-8000-000000000001', tenantId, roles });
    const refused = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof CatalogueError && e.kind === 'forbidden' && re.test(e.message));
    await refused(cat.addSource(staff('other-institution', [ROLES.editor]), src), /cell operator/);
    await refused(cat.addSource(staff(null, [ROLES.editor]), src), /cell operator/);
    await refused(cat.addSource(staff('operator', []), src), /catalogue-editor role/);
    assert.equal(await cat.addSource(staff('operator', [ROLES.editor]), src), 'src');
    assert.deepEqual(calls, ['addSource']);
    await refused(cat.approve(staff('operator', [ROLES.approver]), '00000000-0000-4000-8000-000000000002', 1), /signing is not configured/);
    assert.deepEqual(await cat.keys(), { keys: [] }, 'no key in this cell: an empty key set, not an error');
  });
});
