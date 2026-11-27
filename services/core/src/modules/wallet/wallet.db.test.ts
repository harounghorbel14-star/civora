import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { softwareKey, STATUS, StatusList } from '@civora/credentials';
import { Client } from 'pg';

/**
 * Phase 4 week 1: the wallet schema (P4-DB1..DB5) on a real PostgreSQL, used as the least-privilege role
 * civora_core_app. Checks the access model (row-level security, functions as the only way to change issued
 * credentials and status bits), random status indexes, and that the bit layout matches the credentials package.
 * Runs only when TEST_DATABASE_URL is set (CI; local Postgres).
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const root = resolve(__dirname, '..', '..', '..', '..');
const display = { ar: 'مصدر تجريبي', fr: 'Émetteur de démonstration', en: 'Demo issuer' };
const VCT = 'urn:civora:tn:synthetic:residence-certificate:1';

describe('wallet schema (Phase 4, P4-DB1..DB5)', { skip: !adminUrl && 'TEST_DATABASE_URL not set' }, () => {
  let dbName: string;
  let app: Client;
  const personA = randomUUID();
  const personB = randomUUID();
  let issuerId: string;
  let typeId: string;

  before(async () => {
    dbName = `wallet_db_${Date.now()}_${process.pid}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    // One fixed test-only password for every test file: the files run in parallel and share this role, so a
    // password per file would lock the others out mid-run.
    const appPw = 'test-only-civora-core-app';
    try { await admin.query('create role civora_core_app login nobypassrls'); } catch { /* exists */ }
    await admin.query(`alter role civora_core_app login nobypassrls password '${appPw}'`);
    await admin.end();
    const u = new URL(adminUrl as string);
    u.pathname = `/${dbName}`;
    execFileSync(resolve(root, 'node_modules', '.bin', 'node-pg-migrate'),
      ['up', '--migrations-dir', 'migrations', '--migration-file-language', 'sql', '--migrations-table', 'schema_migrations', '--check-order'],
      { cwd: root, env: { ...process.env, DATABASE_URL: u.toString() }, stdio: 'pipe' });
    u.username = 'civora_core_app';
    u.password = appPw;
    app = new Client({ connectionString: u.toString() });
    await app.connect();
  });
  after(async () => {
    await app?.end();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  const asPerson = async <T>(person: string | null, fn: (c: Client) => Promise<T>): Promise<T> => {
    await app.query('begin');
    try {
      if (person) await app.query("select set_config('app.person_id', $1, true)", [person]);
      const r = await fn(app);
      await app.query('commit');
      return r;
    } catch (e) {
      await app.query('rollback');
      throw e;
    }
  };
  const refused = async (sql: string, params: unknown[] = [], person: string | null = null) =>
    assert.rejects(asPerson(person, (c) => c.query(sql, params)), `expected refusal: ${sql}`);

  it('issuers and credential types: registered through functions, public key only, processing claims never subject claims', async () => {
    const jwk = { ...softwareKey().publicJwk, d: 'must-not-be-stored' };
    issuerId = (await app.query('select wallet.register_issuer($1,$2,$3,$4,$5,$6,$7) as id',
      ['demo-civil-registry', 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', display, 'demo-civil-registry-2026-1', jwk, 'civora-issuers', '01'])).rows[0].id;
    const row = (await app.query('select public_jwk from wallet.issuer where id = $1', [issuerId])).rows[0];
    assert.equal(row.public_jwk.d, undefined, 'the private part is never stored');
    typeId = (await app.query('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,$7,$8) as id',
      [issuerId, VCT, display, ['given_name', 'family_name', 'address', 'address/locality'], ['given_name', 'family_name', 'address/locality'], 365, 'residence-certificate', [30, 7]])).rows[0].id;
    await refused('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,null,null)', [issuerId, 'urn:civora:tn:synthetic:other:1', display, ['given_name', 'exp'], [], 30]);
    await refused('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,null,null)', [issuerId, 'urn:civora:tn:synthetic:other:1', display, ['given_name'], ['family_name'], 30]);
    await refused('select wallet.register_credential_type($1,$2,$3,$4,$5,$6,null,null)', [issuerId, 'urn:real:tn:identity-card:1', display, ['given_name'], [], 30]);
    await refused('insert into wallet.issuer (slug, issuer_url, display, kid, public_jwk, hsm_token_label, hsm_key_id) values ($1,$2,$3,$4,$5,$6,$7)',
      ['x-issuer', 'https://x.invalid', display, 'x', softwareKey().publicJwk, 't', '02']);
  });

  it('issuance: random free indexes in the issuer\'s list, an event per issuance, expiry within the type\'s validity', async () => {
    const exp = new Date(Date.now() + 300 * 86400_000);
    const idx = new Set<number>();
    let listId = '';
    for (let i = 0; i < 20; i++) {
      const r = (await app.query('select * from wallet.record_issuance($1,$2,$3,$4,$5)', [typeId, i % 2 ? personA : personB, 'A'.repeat(43), exp, 'issuer-system:demo'])).rows[0];
      idx.add(r.status_idx);
      listId = r.status_list_id;
    }
    assert.equal(idx.size, 20, 'no index given twice');
    const sorted = [...idx].sort((a, b) => a - b);
    assert.ok(sorted.some((v, i) => i > 0 && v - sorted[i - 1]! > 1), 'not handed out in sequence');
    const list = (await app.query('select allocated, size, bits from wallet.status_list where id = $1', [listId])).rows[0];
    assert.deepEqual([list.allocated, list.size, list.bits], [20, 131072, 2]);
    await refused('select * from wallet.record_issuance($1,$2,$3,$4,$5)', [typeId, personA, 'A'.repeat(43), new Date(Date.now() + 400 * 86400_000), 'issuer-system:demo']);
    await refused('select * from wallet.record_issuance($1,$2,$3,$4,$5)', [typeId, personA, 'not-a-thumbprint', exp, 'issuer-system:demo']);
    await refused('insert into wallet.issued_credential (issuer_id, credential_type_id, subject_person_id, holder_jkt, status_list_id, status_idx, expires_at) values ($1,$2,$3,$4,$5,$6,$7)',
      [issuerId, typeId, personA, 'A'.repeat(43), listId, 5, exp]);
  });

  it('status: suspend, reinstate, revoke set the bits (read back with the credentials package); revocation is final', async () => {
    const exp = new Date(Date.now() + 30 * 86400_000);
    const a = (await app.query('select * from wallet.record_issuance($1,$2,$3,$4,$5)', [typeId, personA, 'B'.repeat(43), exp, 'issuer-system:demo'])).rows[0];
    const b = (await app.query('select * from wallet.record_issuance($1,$2,$3,$4,$5)', [typeId, personA, 'C'.repeat(43), exp, 'issuer-system:demo'])).rows[0];
    const bits = async () => {
      const r = (await app.query('select bits, bitmap, version from wallet.status_list where id = $1', [a.status_list_id])).rows[0];
      // The package reads the bytes the database wrote: same layout (index 0 in the low bits of byte 0).
      return { list: new StatusList(r.bits, (r.bitmap.length * 8) / r.bits, r.bitmap), version: Number(r.version) };
    };
    const v0 = (await bits()).version;
    await app.query('select wallet.set_credential_status($1,$2,$3,$4)', [a.issued_credential_id, 'suspended', 'under-review', 'staff:officer-1']);
    await app.query('select wallet.set_credential_status($1,$2,$3,$4)', [b.issued_credential_id, 'revoked', 'holder-request', 'holder:self']);
    let s = await bits();
    assert.equal(s.list.get(a.status_idx), STATUS.SUSPENDED);
    assert.equal(s.list.get(b.status_idx), STATUS.INVALID);
    assert.equal(s.version, v0 + 2);
    await app.query('select wallet.set_credential_status($1,$2,$3,$4)', [a.issued_credential_id, 'valid', 'review-cleared', 'staff:officer-1']);
    s = await bits();
    assert.equal(s.list.get(a.status_idx), STATUS.VALID);
    await refused('select wallet.set_credential_status($1,$2,$3,$4)', [b.issued_credential_id, 'valid', 'review-cleared', 'staff:officer-1']);
    await refused('select wallet.set_credential_status($1,$2,$3,$4)', [a.issued_credential_id, 'revoked', null, 'staff:officer-1']);
    await refused("update wallet.status_list set bitmap = ''::bytea");
    await refused("update wallet.issued_credential set status = 'valid'");
    const events = (await asPerson(personA, (c) => c.query('select action from wallet.issued_credential_event where issued_credential_id = $1 order by id', [a.issued_credential_id]))).rows;
    assert.deepEqual(events.map((e) => e.action), ['issued', 'suspended', 'reinstated']);
  });

  it('row-level security: a person sees only their own wallet entries and issued credentials; nobody sees any without a person', async () => {
    const entry = ['urn:civora:tn:synthetic:residence-certificate:1', 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', new Date(), new Date(Date.now() + 86400_000)];
    await asPerson(personA, (c) => c.query('insert into wallet.credential (person_id, vct, issuer_url, issued_at, expires_at, backup_ciphertext, backup_key_jkt) values ($1,$2,$3,$4,$5,$6,$7)',
      [personA, ...entry, Buffer.alloc(64, 1), 'D'.repeat(43)]));
    await refused('insert into wallet.credential (person_id, vct, issuer_url, issued_at, expires_at) values ($1,$2,$3,$4,$5)', [personB, ...entry], personA);
    assert.equal((await asPerson(personA, (c) => c.query('select * from wallet.credential'))).rowCount, 1);
    assert.equal((await asPerson(personB, (c) => c.query('select * from wallet.credential'))).rowCount, 0);
    assert.equal((await asPerson(null, (c) => c.query('select * from wallet.credential'))).rowCount, 0);
    const mine = (await asPerson(personB, (c) => c.query('select distinct subject_person_id from wallet.issued_credential'))).rows;
    assert.deepEqual(mine.map((r) => r.subject_person_id), [personB]);
    assert.equal((await asPerson(null, (c) => c.query('select * from wallet.issued_credential'))).rowCount, 0);
    await refused('insert into wallet.credential (person_id, vct, issuer_url, issued_at, expires_at, backup_ciphertext) values ($1,$2,$3,$4,$5,$6)', [personA, ...entry, Buffer.alloc(64)], personA);
  });

  it('presentation log: append-only, claim names and reason codes only', async () => {
    const verifier = (await app.query('select wallet.register_verifier($1,$2,$3,$4,$5,$6,$7,$8,null) as id',
      ['verifier.civora-cell.invalid', display, softwareKey().publicJwk, 'verifier-1', 'civora-verifiers', '01', [VCT], ['given_name', 'address/locality']])).rows[0].id;
    await refused('select wallet.register_verifier($1,$2,$3,$4,$5,$6,$7,$8,null)', ['other.civora-cell.invalid', display, softwareKey().publicJwk, 'verifier-2', 'civora-verifiers', '02', ['urn:civora:tn:synthetic:unknown:1'], []]);
    await refused('select wallet.register_verifier($1,$2,$3,$4,$5,$6,$7,$8,null)', ['https://not-a-registered-id', display, softwareKey().publicJwk, 'verifier-3', 'civora-verifiers', '03', [VCT], []]);
    await app.query('insert into wallet.presentation_log (verifier_id, request_id, result, credential_types, disclosed_claims) values ($1,$2,$3,$4,$5)',
      [verifier, randomUUID(), 'accepted', [VCT], ['given_name', 'address/locality']]);
    await app.query('insert into wallet.presentation_log (verifier_id, request_id, result, reason) values ($1,$2,$3,$4)', [verifier, randomUUID(), 'rejected', 'revoked']);
    await refused('insert into wallet.presentation_log (verifier_id, request_id, result, disclosed_claims) values ($1,$2,$3,$4)', [verifier, randomUUID(), 'accepted', ['given_name=Amina']]);
    await refused('insert into wallet.presentation_log (verifier_id, request_id, result, disclosed_claims) values ($1,$2,$3,$4)', [verifier, randomUUID(), 'accepted', ['Ben Salah']]);
    await refused('insert into wallet.presentation_log (verifier_id, request_id, result) values ($1,$2,$3)', [verifier, randomUUID(), 'rejected']);
    await refused('update wallet.presentation_log set result = $1', ['accepted']);
    await refused('delete from wallet.presentation_log');
  });

  it('expiry reminders (P4-D5): each threshold of the type once, across people, only through the functions; defaults for other types', async () => {
    const day = 86_400_000;
    const add = (person: string, vct: string, inDays: number) => asPerson(person, async (c) => (await c.query(
      'insert into wallet.credential (person_id, vct, issuer_url, issued_at, expires_at) values ($1,$2,$3,$4,$5) returning id',
      [person, vct, 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry', new Date(Date.now() - day), new Date(Date.now() + inDays * day)])).rows[0].id as string);
    const soon = await add(personA, VCT, 20);
    const later = await add(personB, VCT, 60);
    const foreign = await add(personB, 'urn:example:diploma', 5);
    const dueNow = async () => Object.fromEntries((await app.query('select entry_id, threshold from wallet.due_reminders(100)')).rows.map((r) => [r.entry_id, r.threshold]));
    let d = await dueNow();
    assert.equal(d[soon], 30, 'within 30 days: the 30-day reminder');
    assert.equal(d[later], undefined, 'not yet');
    assert.equal(d[foreign], 7, 'another issuer\'s type: default thresholds, the smallest crossed');
    assert.equal((await app.query('select wallet.mark_reminded($1, 30) as ok', [soon])).rows[0].ok, true);
    assert.equal((await app.query('select wallet.mark_reminded($1, 30) as ok', [soon])).rows[0].ok, false, 'once per threshold');
    d = await dueNow();
    assert.equal(d[soon], undefined, 'the 30-day reminder is not sent twice');
    await app.query('select wallet.mark_reminded($1, 7)', [foreign]);
    assert.equal((await dueNow())[foreign], undefined);
    // Five days before expiry the 7-day reminder becomes due after the 30-day one.
    await asPerson(personA, (c) => c.query("update wallet.credential set expires_at = now() + interval '5 days' where id = $1", [soon]));
    assert.equal((await dueNow())[soon], 7);
    assert.equal((await asPerson(null, (c) => c.query('update wallet.credential set last_reminder_days = 1'))).rowCount, 0, 'no one else\'s entries change without a person');
  });
});
