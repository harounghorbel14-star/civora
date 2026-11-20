import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addWorkingDays, buildManifest, DEFAULT_PACKS_DIR, loadCountryPack, PackIntegrityError, workingDaysBetween } from './index';

/*
 * Global core, country configuration (ADR-017; doc 03): a second country is DATA, not code.
 * A synthetic pack "xx" (user-assigned code, no real country) is written next to nothing but JSON files, with a
 * different weekend, holidays, locales, currency and its own rule pack. The same loader, verifier and calendar
 * functions must accept it and produce different deadlines — with no change to any source file.
 */
function writeSyntheticPack(): string {
  const base = mkdtempSync(join(tmpdir(), 'packs-'));
  const dir = join(base, 'xx');
  mkdirSync(join(dir, 'rule-packs'), { recursive: true });
  const tn = JSON.parse(readFileSync(join(DEFAULT_PACKS_DIR, 'tn', 'country-pack.json'), 'utf8'));
  const rp = JSON.parse(readFileSync(join(DEFAULT_PACKS_DIR, 'tn', 'rule-packs', 'RP-BCT-2022-08.json'), 'utf8'));
  const pack = {
    ...tn,
    packId: 'xx',
    country: { iso3166: 'XX', name: { en: 'Synthetic country XX' } },
    locales: { supported: ['en', 'es'], default: 'es', fallback: 'en', numberingSystem: 'latn' },
    currency: { code: 'XXX', minorUnits: 2 },
    timeZone: 'Atlantic/Canary',
    calendar: {
      weekend: ['fri', 'sat'],
      holidayDataStatus: 'SYNTHETIC: test data only',
      holidays: [{ date: '2026-12-01', name: 'Synthetic holiday', kind: 'fixed', verified: false }],
    },
    hosting: { devStaging: 'any, synthetic data only', pilotProduction: 'in-country host (synthetic)', personalDataTransferAbroad: 'prohibited (synthetic)' },
    dataProtection: { law: 'Synthetic data protection act', authority: 'Synthetic authority', authorityStatusNote: 'synthetic' },
    rulePacks: ['RP-XX-SYN-01'],
  };
  const rule = { ...rp, id: 'RP-XX-SYN-01', deadline: { ...rp.deadline, ceiling: 10 } };
  writeFileSync(join(dir, 'country-pack.json'), JSON.stringify(pack, null, 2));
  writeFileSync(join(dir, 'rule-packs', 'RP-XX-SYN-01.json'), JSON.stringify(rule, null, 2));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(buildManifest(dir), null, 2));
  return base;
}

test('a second country pack loads through the same verifier, with its own locales, currency and rule pack', () => {
  const base = writeSyntheticPack();
  const { pack, rulePacks, digest } = loadCountryPack('xx', base);
  assert.equal(pack.locales.default, 'es');
  assert.deepEqual(pack.locales.supported, ['en', 'es']);
  assert.equal((pack as unknown as { currency: { code: string } }).currency.code, 'XXX');
  assert.equal(rulePacks['RP-XX-SYN-01']?.deadline.ceiling, 10);
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test('deadlines follow the pack calendar: same dates, different results for TN and XX', () => {
  const base = writeSyntheticPack();
  const xx = loadCountryPack('xx', base).pack.calendar;
  const tn = loadCountryPack('tn').pack.calendar;
  // Monday 30 Nov 2026 + 3 working days: TN (Sat/Sun weekend) -> Thu 3 Dec; XX (Fri/Sat weekend, 1 Dec holiday) -> Sun 6 Dec.
  assert.equal(addWorkingDays('2026-11-30', 3, tn), '2026-12-03');
  assert.equal(addWorkingDays('2026-11-30', 3, xx), '2026-12-06');
  assert.notEqual(workingDaysBetween('2026-11-30', '2026-12-14', tn), workingDaysBetween('2026-11-30', '2026-12-14', xx));
});

test('the second pack is protected by the same integrity checks (tampering detected)', () => {
  const base = writeSyntheticPack();
  const f = join(base, 'xx', 'rule-packs', 'RP-XX-SYN-01.json');
  writeFileSync(f, readFileSync(f, 'utf8').replace('"ceiling": 10', '"ceiling": 99'));
  assert.throws(() => loadCountryPack('xx', base), PackIntegrityError);
});
