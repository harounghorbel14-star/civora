import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { Client, Pool } from 'pg';
import { CatalogueRepository } from './catalogue.repository';

/**
 * Phase 5 week 1: the catalogue schema (P5-DB1..DB6) on its own database (the pg-public cluster in a cell), used as the
 * least-privilege role. Checks 100 % citation coverage, four-eyes approval, signed digests of the canonical content,
 * publication with history, the read views, error reports without personal data, and search with Arabic and French
 * normalisation. The content here is a test fixture, not a curated procedure. Runs only with TEST_DATABASE_URL.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const root = resolve(__dirname, '..', '..', '..', '..');
const ar = (a: string, f: string) => ({ ar: a, fr: f });

describe('catalogue schema (Phase 5, P5-DB1..DB6)', { skip: !adminUrl && 'TEST_DATABASE_URL not set' }, () => {
  let dbName: string;
  let app: Client;
  let appUrl = '';
  const author = randomUUID();
  const approver = randomUUID();

  before(async () => {
    dbName = `catalogue_db_${Date.now()}_${process.pid}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const appPw = 'test-only-civora-core-app';
    try { await admin.query('create role civora_core_app login nobypassrls'); } catch { /* exists */ }
    await admin.query(`alter role civora_core_app login nobypassrls password '${appPw}'`);
    await admin.end();
    const u = new URL(adminUrl as string);
    u.pathname = `/${dbName}`;
    execFileSync(resolve(root, 'node_modules', '.bin', 'node-pg-migrate'),
      ['up', '--migrations-dir', 'migrations-public', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations_public', '--check-order'],
      { cwd: root, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
    u.username = 'civora_core_app';
    u.password = appPw;
    appUrl = u.toString();
    app = new Client({ connectionString: appUrl });
    await app.connect();
  });
  after(async () => {
    await app?.end();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  const fails = (sql: string, params: unknown[], match: RegExp) => assert.rejects(app.query(sql, params), (e: Error) => match.test(e.message), `expected ${match}`);
  let source: string;
  let service: string;

  const draft = (src: string[], extra: Record<string, unknown> = {}) => ({
    title: ar('بطاقة اختبار', 'Fiche de test'), summary: ar('ملخص تجريبي للهويّة', 'Résumé de démonstration'), institution: ar('مؤسسة', 'Institution'),
    change_note: 'first draft', last_verified_on: new Date().toISOString().slice(0, 10),
    requirements: [
      { kind: 'step', position: 1, text: ar('الخطوة الأولى', 'Première étape'), source_ids: src },
      { kind: 'document', position: 1, text: ar('وثيقة', 'Pièce'), source_ids: src },
      { kind: 'fee', position: 1, text: ar('معلوم', 'Frais'), amount_tnd: 5, source_ids: src },
    ],
    ...extra,
  });

  it('sources: legal texts need their official-journal reference; https only', async () => {
    source = (await app.query("select catalogue.add_source('official-page', 'Test page', 'Test publisher', 'https://example.invalid/test-page', null, 'fr', current_date) as id")).rows[0].id;
    await fails("select catalogue.add_source('legal-text', 'Décret', 'JORT', 'https://example.invalid/decret', null, 'fr', current_date)", [], /violates check/);
    await fails("select catalogue.add_source('official-page', 'Page', 'P', 'http://example.invalid/x', null, 'fr', current_date)", [], /violates check/);
  });

  it('a draft goes to review only when complete and every part cites a source (P5-AC1)', async () => {
    service = (await app.query('select catalogue.create_service($1, $2, $3, $4, $5) as id', ['TN-TST-001', 'test-service', 'civil-status', author, draft([randomUUID()])])).rows[0].id;
    await fails('select catalogue.submit($1, 1, $2)', [service, author], /a cited source does not exist/);
    await fails('select catalogue.put_draft($1, 1, $2, $3)', [service, author, { ...draft([source]), requirements: [{ kind: 'step', position: 1, text: ar('خطوة', 'Étape'), source_ids: [] }] }], /violates check/);
    await app.query('select catalogue.put_draft($1, 1, $2, $3)', [service, author, { ...draft([source]), requirements: [] }]);
    await fails('select catalogue.submit($1, 1, $2)', [service, author], /no steps/);
    await app.query('select catalogue.put_draft($1, 1, $2, $3)', [service, author, draft([source])]);
    await app.query('select catalogue.submit($1, 1, $2)', [service, author]);
    await fails('select catalogue.put_draft($1, 1, $2, $3)', [service, author, draft([source])], /only a draft/);
  });

  it('four-eyes approval with the digest of the canonical content; publication; drafts are not readable', async () => {
    const canonical = (await app.query('select catalogue.canonical_content($1, 1)::text as c', [service])).rows[0].c as string;
    const digest = createHash('sha256').update(canonical, 'utf8').digest();
    const sig = 'eyJhbGciOiJFUzI1NiJ9..c2lnbmF0dXJl';
    assert.equal((await app.query('select count(*)::int as n from catalogue.published_version')).rows[0].n, 0, 'nothing published yet');
    await fails('select * from catalogue.service_version', [], /permission denied/);
    await fails('select catalogue.approve($1, 1, $2, $3, $4)', [service, author, digest, sig], /four-eyes/);
    await fails('select catalogue.approve($1, 1, $2, $3, $4)', [service, approver, createHash('sha256').update('other').digest(), sig], /digest/);
    await app.query('select catalogue.approve($1, 1, $2, $3, $4)', [service, approver, digest, sig]);
    await app.query('select catalogue.publish($1, 1, $2)', [service, approver]);
    const pub = (await app.query("select code, version, state, approved_by, encode(content_digest, 'hex') as d from catalogue.published_version")).rows;
    assert.deepEqual(pub, [{ code: 'TN-TST-001', version: 1, state: 'published', approved_by: approver, d: digest.toString('hex') }]);
    assert.equal((await app.query('select count(*)::int as n from catalogue.published_requirement')).rows[0].n, 3);
    // The page address other modules link to (the wallet's renewal links, P4-F6): published slugs only, as the app role.
    const repo = new CatalogueRepository(new Pool({ connectionString: appUrl, max: 1 }));
    try {
      assert.equal(await repo.isPublishedSlug('test-service'), true);
      assert.equal(await repo.isPublishedSlug('TN-TST-001'), false, 'the slug, not the code');
      assert.equal(await repo.isPublishedSlug('no-such-service'), false);
    } finally {
      await repo.close();
    }
  });

  it('a new version supersedes the published one; history kept (P5-F3); the editorial log records each decision', async () => {
    await fails('select catalogue.put_draft($1, 3, $2, $3)', [service, author, draft([source])], /the next version is 2/);
    await app.query('select catalogue.put_draft($1, 2, $2, $3)', [service, author, draft([source], { change_note: 'fee updated' })]);
    await app.query('select catalogue.submit($1, 2, $2)', [service, author]);
    await app.query("select catalogue.request_changes($1, 2, $2, 'cite the decree')", [service, approver]);
    await app.query('select catalogue.submit($1, 2, $2)', [service, author]);
    const canonical = (await app.query('select catalogue.canonical_content($1, 2)::text as c', [service])).rows[0].c as string;
    await app.query('select catalogue.approve($1, 2, $2, $3, $4)', [service, approver, createHash('sha256').update(canonical, 'utf8').digest(), 'eyJhbGciOiJFUzI1NiJ9..c2ln']);
    await app.query('select catalogue.publish($1, 2, $2)', [service, approver]);
    const versions = (await app.query('select version, state from catalogue.published_version order by version')).rows;
    assert.deepEqual(versions, [{ version: 1, state: 'superseded' }, { version: 2, state: 'published' }]);
    await fails('select catalogue.publish($1, 1, $2)', [service, approver], /only an approved version/);
  });

  it('search: Arabic and French normalisation (diacritics, alef forms, taa marbuta; accents); published only', async () => {
    const codes = async (q: string) => (await app.query('select code from catalogue.search($1, 10)', [q])).rows.map((r) => r.code);
    assert.deepEqual(await codes('الهوية'), ['TN-TST-001'], 'matches الهويّة with shadda and taa marbuta');
    assert.deepEqual(await codes('resume'), ['TN-TST-001'], 'matches Résumé without accents');
    assert.deepEqual(await codes('Fiche'), ['TN-TST-001']);
    assert.deepEqual(await codes('غير موجود'), []);
  });

  it('report an error (P5-F4): a message only, for a published service', async () => {
    const id = (await app.query("select catalogue.report_error('TN-TST-001', 2, 'Le montant a changé selon le nouveau décret') as id")).rows[0].id;
    assert.ok(id);
    await fails("select catalogue.report_error('TN-XXX-999', 1, 'nothing to report here')", [], /no such published service/);
    await fails("select catalogue.report_error('TN-TST-001', 2, 'no')", [], /violates check/);
    await fails('select * from catalogue.content_error_report', [], /permission denied/);
  });

  it('reports name a published version; editors list them and decide each once (P5-F4, migration 1765324800000)', async () => {
    await fails("select catalogue.report_error('TN-TST-001', 9, 'a version that was never published')", [], /no such published version/);
    const id = (await app.query("select catalogue.report_error('TN-TST-001', 1, 'La version 1 indiquait un ancien montant') as id")).rows[0].id;
    const open = (await app.query("select id, code, version, status from catalogue.list_error_reports('open', 50)")).rows;
    assert.ok(open.some((r) => r.id === id && r.code === 'TN-TST-001' && r.version === 1 && r.status === 'open'), 'a superseded version can be reported');
    assert.equal(open.length, 2, 'both open reports');
    await app.query("select catalogue.decide_error_report($1, $2, 'accepted', 'corrected in version 2')", [id, approver]);
    await fails("select catalogue.decide_error_report($1, $2, 'rejected', null)", [id, approver], /already been decided/);
    await fails("select catalogue.decide_error_report($1, $2, 'maybe', null)", [id, approver], /accepted or rejected/);
    await fails("select catalogue.decide_error_report(gen_random_uuid(), $1, 'accepted', null)", [approver], /no such report/);
    const done = (await app.query("select id, status, note, handled_at is not null as handled from catalogue.list_error_reports('accepted', 50)")).rows;
    assert.deepEqual(done, [{ id, status: 'accepted', note: 'corrected in version 2', handled: true }]);
    assert.equal((await app.query("select count(*)::int as n from catalogue.list_error_reports('open', 50)")).rows[0].n, 1);
  });
});
