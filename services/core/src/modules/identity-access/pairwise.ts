import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Pairwise subject identifiers (P3-A3, P3-DB6): what a relying party sees as `sub`, computed the way Keycloak's
 * `oidc-sha256-pairwise-sub-mapper` does, so the core can mirror them in iam.pairwise_id without asking each relying
 * party: SHA-256 over sector identifier, local subject (the Keycloak user id) and the mapper's salt, turned into a
 * name-based UUID (version 3, as Java's UUID.nameUUIDFromBytes). Verified against real Keycloak tokens in the realms
 * test (C8). The salts live in Keycloak's database only (R-P3-4); the mirror job reads them through the admin API.
 */
export function pairwiseSub(sectorIdentifier: string, localSub: string, salt: string): string {
  const hash = createHash('sha256').update(sectorIdentifier, 'utf8').update(localSub, 'utf8').update(salt, 'utf8').digest();
  return nameUuidFromBytes(hash);
}

/** Java's UUID.nameUUIDFromBytes: MD5 of the bytes, version 3, IETF variant. */
export function nameUuidFromBytes(bytes: Buffer): string {
  const b = createHash('md5').update(bytes).digest();
  b[6] = (b[6]! & 0x0f) | 0x30;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The sector of a relying party: its sector identifier URI's host if set, else the host of its redirect URIs. */
export function sectorOf(sectorIdentifierUri: string | undefined, redirectUris: string[]): string | null {
  if (sectorIdentifierUri) return new URL(sectorIdentifierUri).host;
  const hosts = [...new Set(redirectUris.map((u) => { try { return new URL(u).host; } catch { return null; } }).filter((h): h is string => !!h))];
  return hosts.length === 1 ? hosts[0]! : null;
}

export interface PairwiseSector { sector: string; salt: string }

/**
 * The relying parties' sectors and salts (PAIRWISE_SECTORS_FILE: JSON written by infra/keycloak/apply-realm-policy.py
 * --pairwise-out, a deployment secret); an empty list when unset (no mirror).
 */
export function loadPairwiseSectors(env: NodeJS.ProcessEnv = process.env): PairwiseSector[] {
  const file = env.PAIRWISE_SECTORS_FILE;
  if (!file) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!Array.isArray(raw)) throw new Error('PAIRWISE_SECTORS_FILE: a JSON list');
  return raw.map((x: { sector?: unknown; salt?: unknown }) => {
    if (typeof x.sector !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,62}$/.test(x.sector) || typeof x.salt !== 'string' || x.salt.length < 8) {
      throw new Error('PAIRWISE_SECTORS_FILE: each entry needs a sector (host name) and a salt');
    }
    return { sector: x.sector, salt: x.salt };
  });
}
