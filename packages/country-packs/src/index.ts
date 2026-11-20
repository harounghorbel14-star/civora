import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

export * from './calendar';

export interface RulePack {
  id: string;
  version: string;
  source: { text: string; url: string; verifiedOn: string; interpretationStatus: string };
  appliesTo: string[];
  caseTypes: { code: string; countsInRegulatoryStatistics: boolean }[];
  exclusions: string[];
  deadline: { ceiling: number | null; unit: string | null; from: string; suspension: string };
  subjects?: string[];
  mandatoryFields: string[];
  statements: { code: string; frequency: string; format: string; dueDaysAfterReportingDate?: number; dueRule?: string; schemaStatus?: string }[];
}

export interface CountryPack {
  packId: string;
  version: string;
  status: 'synthetic-development-only' | 'pilot-approved' | 'production-approved';
  country: { iso3166: string; name: Record<string, string> };
  locales: { supported: string[]; default: string; fallback: string; numberingSystem: string };
  currency: { code: string; minorUnits: number };
  timeZone: string;
  calendar: { weekend: string[]; holidayDataStatus: string; holidays: { date: string; name: string; kind: string; verified: boolean }[] };
  hosting: { devStaging: string; pilotProduction: string; personalDataTransferAbroad: string };
  dataProtection: { law: string; authority: string; authorityStatusNote?: string };
  identifiers: Record<string, { pattern: string; syntheticPattern: string; note?: string }>;
  rulePacks: string[];
  featureFlags: Record<string, boolean | string | number>;
}

export interface LoadedPack {
  pack: CountryPack;
  rulePacks: Record<string, RulePack>;
  digest: string;
}

export class PackIntegrityError extends Error {}

const PACKAGE_ROOT = resolve(__dirname, '..');
export const DEFAULT_PACKS_DIR = PACKAGE_ROOT;

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.name.endsWith('.json') && e.name !== 'manifest.json') out.push(p);
  }
  return out.sort();
}

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Write manifest.json with SHA-256 of every pack file and an overall digest (ADR-017). */
export function buildManifest(packDir: string): { files: Record<string, string>; digest: string } {
  const files: Record<string, string> = {};
  for (const f of listFiles(packDir)) files[relative(packDir, f)] = sha256(readFileSync(f));
  const digest = sha256(JSON.stringify(files));
  writeFileSync(join(packDir, 'manifest.json'), JSON.stringify({ files, digest }, null, 2) + '\n');
  return { files, digest };
}

function verifyManifest(packDir: string): string {
  const manifestPath = join(packDir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new PackIntegrityError(`missing manifest in ${packDir}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: Record<string, string>; digest: string };
  const actual = listFiles(packDir).map((f) => relative(packDir, f));
  const expected = Object.keys(manifest.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new PackIntegrityError(`pack file list differs from manifest in ${packDir}`);
  for (const [rel, hash] of Object.entries(manifest.files)) {
    if (sha256(readFileSync(join(packDir, rel))) !== hash) throw new PackIntegrityError(`digest mismatch for ${rel}`);
  }
  if (sha256(JSON.stringify(manifest.files)) !== manifest.digest) throw new PackIntegrityError('manifest digest mismatch');
  return manifest.digest;
}

/** Load, verify (digests + JSON Schema + cross-references) and return a country pack. Throws on any problem. */
export function loadCountryPack(packId: string, baseDir: string = DEFAULT_PACKS_DIR): LoadedPack {
  if (!/^[a-z]{2}$/.test(packId)) throw new PackIntegrityError(`invalid pack id ${packId}`);
  const packDir = join(baseDir, packId);
  const digest = verifyManifest(packDir);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validatePack = ajv.compile(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'schema', 'country-pack.schema.json'), 'utf8')));
  const validateRule = ajv.compile(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'schema', 'rule-pack.schema.json'), 'utf8')));
  const pack = JSON.parse(readFileSync(join(packDir, 'country-pack.json'), 'utf8')) as CountryPack;
  if (!validatePack(pack)) throw new PackIntegrityError(`country pack invalid: ${ajv.errorsText(validatePack.errors)}`);
  if (!pack.locales.supported.includes(pack.locales.default) || !pack.locales.supported.includes(pack.locales.fallback)) {
    throw new PackIntegrityError('default and fallback locales must be supported');
  }
  const rulePacks: Record<string, RulePack> = {};
  for (const id of pack.rulePacks) {
    const file = join(packDir, 'rule-packs', `${id}.json`);
    if (!existsSync(file)) throw new PackIntegrityError(`rule pack ${id} referenced but missing`);
    const rp = JSON.parse(readFileSync(file, 'utf8')) as RulePack;
    if (!validateRule(rp)) throw new PackIntegrityError(`rule pack ${id} invalid: ${ajv.errorsText(validateRule.errors)}`);
    if (rp.id !== id) throw new PackIntegrityError(`rule pack id mismatch: ${rp.id} vs ${id}`);
    rulePacks[id] = rp;
  }
  for (const [name, spec] of Object.entries(pack.identifiers)) {
    try {
      new RegExp(spec.pattern);
      new RegExp(spec.syntheticPattern);
    } catch {
      throw new PackIntegrityError(`identifier ${name} has an invalid pattern`);
    }
  }
  return { pack, rulePacks, digest };
}
