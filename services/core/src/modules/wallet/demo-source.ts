import { createHash } from 'node:crypto';
import { BRANCH_CITIES, FAMILY_NAMES, GIVEN_NAMES } from '@civora/synthetic-data';

/**
 * The demo issuers' source of claims (ADR-025, ADR-028; decision Q4-1: no real registry until agreements exist).
 * Claims are synthetic and derived from the person id and the credential type, so the same person gets the same
 * synthetic values every time (re-issuance, renewal) and nothing real is ever looked up or stored.
 */
export interface ClaimSource {
  claimsFor(personId: string, vct: string, claimPaths: string[]): Promise<Record<string, unknown>>;
}

export class DemoClaimSource implements ClaimSource {
  async claimsFor(personId: string, vct: string, claimPaths: string[]): Promise<Record<string, unknown>> {
    const h = createHash('sha256').update(`civora-demo-issuer\0${personId}\0${vct}`, 'utf8').digest();
    const pick = <T>(list: readonly T[], i: number): T => list[h[i]! % list.length]!;
    const given = pick(GIVEN_NAMES, 0);
    const family = pick(FAMILY_NAMES, 1);
    const year = 1950 + (h.readUInt16BE(2) % 56);
    const month = 1 + (h[4]! % 12);
    const day = 1 + (h[5]! % 28);
    const values: Record<string, unknown> = {
      given_name: given.fr,
      family_name: family.fr,
      given_name_ar: given.ar,
      family_name_ar: family.ar,
      birthdate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      'address/locality': pick(BRANCH_CITIES, 6).replace(/ (Centre|Lac)$/, ''),
      'address/country': 'TN',
      document_number: `SYN-${h.subarray(7, 11).toString('hex').toUpperCase()}`,
    };
    const out: Record<string, unknown> = {};
    for (const path of claimPaths) {
      const [top, sub] = path.split('/') as [string, string | undefined];
      if (sub === undefined) {
        if (!(path in values) && !claimPaths.some((p) => p.startsWith(`${path}/`))) throw new Error(`the demo source has no claim ${path}`);
        if (path in values) out[path] = values[path];
      } else {
        if (!(path in values)) throw new Error(`the demo source has no claim ${path}`);
        const parent = (out[top] ??= {}) as Record<string, unknown>;
        parent[sub] = values[path];
      }
    }
    return out;
  }
}
