import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addWorkingDays, DEFAULT_PACKS_DIR, isWorkingDay, loadCountryPack, PackIntegrityError, workingDaysBetween } from './index';

test('TN pack v0 loads, validates and is marked synthetic-only', () => {
  const { pack, rulePacks, digest } = loadCountryPack('tn');
  assert.equal(pack.status, 'synthetic-development-only');
  assert.equal(pack.locales.default, 'ar-TN');
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(rulePacks).sort(), ['RP-BCT-2020-11', 'RP-BCT-2022-08', 'RP-BCT-2026-10']);
});

test('RP-BCT-2022-08 encodes the verified 15-banking-working-day ceiling; 2026-10 sets none', () => {
  const { rulePacks } = loadCountryPack('tn');
  assert.equal(rulePacks['RP-BCT-2022-08']?.deadline.ceiling, 15);
  assert.equal(rulePacks['RP-BCT-2022-08']?.deadline.unit, 'banking-working-days');
  assert.equal(rulePacks['RP-BCT-2026-10']?.deadline.ceiling, null);
  assert.equal(rulePacks['RP-BCT-2020-11']?.deadline.ceiling, 7);
  assert.ok(rulePacks['RP-BCT-2022-08']?.statements.some((s) => s.code === 'ROGS760'));
});

test('tampering with a pack file is detected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pack-'));
  cpSync(join(DEFAULT_PACKS_DIR, 'tn'), join(dir, 'tn'), { recursive: true });
  const f = join(dir, 'tn', 'rule-packs', 'RP-BCT-2022-08.json');
  writeFileSync(f, readFileSync(f, 'utf8').replace('"ceiling": 15', '"ceiling": 20'));
  assert.throws(() => loadCountryPack('tn', dir), PackIntegrityError);
});

test('working-day arithmetic matches the Phase 1 prototype cases', () => {
  const { pack } = loadCountryPack('tn');
  // 18/11/2026 (Wed) + 15 banking working days = 09/12/2026 (prototype task T1)
  assert.equal(addWorkingDays('2026-11-18', 15, pack.calendar), '2026-12-09');
  // 26/10/2026 + 15 = 16/11/2026 (prototype case RC-2026-0412)
  assert.equal(addWorkingDays('2026-10-26', 15, pack.calendar), '2026-11-16');
  assert.equal(isWorkingDay('2026-11-21', pack.calendar), false); // Saturday
  assert.equal(isWorkingDay('2026-12-17', pack.calendar), false); // listed holiday (unverified)
  assert.equal(workingDaysBetween('2026-11-16', '2026-11-18', pack.calendar), 2);
  assert.equal(workingDaysBetween('2026-11-18', '2026-11-16', pack.calendar), -2);
});
