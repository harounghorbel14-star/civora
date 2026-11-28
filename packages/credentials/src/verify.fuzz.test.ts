import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CredentialError } from './jws';
import { softwareKey } from './keys';
import { present } from './sd-jwt';
import { issueCredential, verifyCredential } from './sd-jwt-vc';

/**
 * Fuzzing of the verifier's input (Phase 4, P4-T3; doc phase-4/07): thousands of mutations of a valid, key-bound
 * SD-JWT VC presentation. Each must be refused with a CredentialError — never accepted, never another exception, never
 * slow. The mutations are seeded, so a failure names the seed and the case can be replayed exactly
 * (CIVORA_FUZZ_SEED, CIVORA_FUZZ_CASES).
 */
const SEED = Number(process.env.CIVORA_FUZZ_SEED ?? 20261128);
const CASES = Number(process.env.CIVORA_FUZZ_CASES ?? 3000);

/** Mulberry32: small, fast, seeded. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** The same bytes, encoded non-canonically: the unused low bits of the last character set (base64url malleability). */
const nonCanonical = (seg: string, rand: () => number): string => {
  const unused = (seg.length * 6) % 8;
  if (unused === 0) return seg;
  const mask = (1 << unused) - 1;
  const i = B64U.indexOf(seg[seg.length - 1]!);
  return seg.slice(0, -1) + B64U[(i & ~mask) | (1 + Math.floor(rand() * mask))];
};
const lastSegment = (jws: string, f: (seg: string) => string) => jws.slice(0, jws.lastIndexOf('.') + 1) + f(jws.slice(jws.lastIndexOf('.') + 1));

describe('fuzzing the credential verifier (P4-T3)', () => {
  const issuer = softwareKey({ kid: 'demo-issuer-fuzz-1' });
  const holder = softwareKey();
  const other = softwareKey();
  const kb = { aud: 'x509_san_dns:verifier.example.invalid', nonce: 'nonce-fuzz-1234567890' };
  const vct = 'urn:civora:tn:synthetic:residence-certificate:1';
  const opts = { issuerKey: async () => issuer.publicJwk, keyBinding: kb, acceptedVct: [vct] };

  it(`${CASES} seeded mutations (seed ${SEED}) are all refused with a CredentialError, each in under 250 ms`, async () => {
    const issued = await issueCredential(issuer, {
      iss: 'https://wallet.civora-cell.invalid/issuers/demo', vct, holderJwk: holder.publicJwk, exp: Math.floor(Date.now() / 1000) + 86400,
      claims: { given_name: 'Synthetic', family_name: 'Person', locality: 'Sfax', address: { locality: 'Sfax', country: 'TN' } },
      selectivelyDisclosable: ['given_name', 'family_name', 'locality'],
    });
    const valid = await present(issued.sdJwt, issued.disclosures.map((d) => d.encoded), holder, kb);
    await verifyCredential(valid, opts); // the seed input is valid
    const otherKb = await present(issued.sdJwt, issued.disclosures.map((d) => d.encoded), other, kb);
    const parts = valid.split('~');
    const [h, p, s] = parts[0]!.split('.') as [string, string, string];
    const rand = prng(SEED);
    const pick = <T>(xs: readonly T[] | string): T => (typeof xs === 'string' ? xs[Math.floor(rand() * xs.length)] : xs[Math.floor(rand() * xs.length)]) as T;
    const at = (str: string) => Math.floor(rand() * Math.max(1, str.length));
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());

    const mutations: [string, () => string][] = [
      ['flip a character', () => { const i = at(valid); const c = valid[i]!; const r = pick<string>(B64U.replace(c, '')); return valid.slice(0, i) + r + valid.slice(i + 1); }],
      ['delete a character', () => { const i = at(valid); return valid.slice(0, i) + valid.slice(i + 1); }],
      ['insert a character', () => { const i = at(valid); return valid.slice(0, i) + pick<string>(`${B64U}.~=+/ \u0000é`) + valid.slice(i); }],
      ['truncate', () => valid.slice(0, Math.floor(rand() * (valid.length - 1)))],
      ['drop a disclosure', () => { const q = [...parts]; q.splice(1 + Math.floor(rand() * (q.length - 2)), 1); return q.join('~'); }],
      ['duplicate a disclosure', () => { const q = [...parts]; const d = q[1 + Math.floor(rand() * (q.length - 2))]!; q.splice(1, 0, d); return q.join('~'); }],
      ['a disclosure that is not in the digests', () => { const q = [...parts]; q.splice(1, 0, b64(['salt-fuzz', 'given_name', 'Intruder'])); return q.join('~'); }],
      ['change a disclosure value', () => { const q = [...parts]; const i = 1 + Math.floor(rand() * (q.length - 2)); const d = JSON.parse(Buffer.from(q[i]!, 'base64url').toString()); d[2] = 'Changed'; q[i] = b64(d); return q.join('~'); }],
      ['remove the key binding', () => parts.slice(0, -1).join('~') + '~'],
      ['key binding by another key', () => otherKb],
      ['alg none', () => [`${b64({ ...header, alg: 'none' })}.${p}.`, ...parts.slice(1)].join('~')],
      ['alg HS256 with the public key as secret', () => [`${b64({ ...header, alg: 'HS256' })}.${p}.${s}`, ...parts.slice(1)].join('~')],
      ['typ changed', () => [`${b64({ ...header, typ: 'JWT' })}.${p}.${s}`, ...parts.slice(1)].join('~')],
      ['payload changed (exp in the past)', () => [`${h}.${b64({ ...payload, exp: 1 })}.${s}`, ...parts.slice(1)].join('~')],
      ['payload changed (vct)', () => [`${h}.${b64({ ...payload, vct: 'urn:other' })}.${s}`, ...parts.slice(1)].join('~')],
      ['payload changed (cnf to another key)', () => [`${h}.${b64({ ...payload, cnf: { jwk: other.publicJwk } })}.${s}`, ...parts.slice(1)].join('~')],
      ['signature of another message', () => [`${h}.${p}.${s.split('').reverse().join('')}`, ...parts.slice(1)].join('~')],
      ['segments swapped', () => [`${p}.${h}.${s}`, ...parts.slice(1)].join('~')],
      ['random base64url', () => Array.from({ length: 20 + Math.floor(rand() * 400) }, () => pick<string>(B64U)).join('')],
      ['random JSON-looking', () => JSON.stringify({ vp: valid.slice(0, at(valid)), x: rand() })],
      ['many tildes', () => `${parts[0]}${'~'.repeat(1 + Math.floor(rand() * 2000))}`],
      ['very long', () => valid + '~' + 'A'.repeat(40_000 + Math.floor(rand() * 40_000))],
      ['empty or blank', () => pick<string>(['', '~', '.', '..', '~~~', ' ', '\n'])],
      ['issuer signature encoded non-canonically (same bytes)', () => [lastSegment(parts[0]!, (x) => nonCanonical(x, rand)), ...parts.slice(1)].join('~')],
      ['key-binding signature encoded non-canonically (same bytes)', () => [...parts.slice(0, -1), lastSegment(parts.at(-1)!, (x) => nonCanonical(x, rand))].join('~')],
      ['payload encoded non-canonically', () => [`${h}.${nonCanonical(p, rand)}.${s}`, ...parts.slice(1)].join('~')],
      ['nested JSON in a disclosure', () => { const q = [...parts]; q.splice(1, 0, b64(['s', 'given_name', JSON.parse('['.repeat(500) + ']'.repeat(500))])); return q.join('~'); }],
    ];
    const seen = new Map<string, number>();
    for (let n = 0; n < CASES; n++) {
      const [name, mutate] = mutations[n % mutations.length]!;
      const input = mutate();
      if (input === valid) continue; // a no-op mutation (rare) is not an invalid input
      const t0 = performance.now();
      let outcome: string;
      try {
        await verifyCredential(input, opts);
        outcome = 'accepted';
      } catch (e) {
        outcome = e instanceof CredentialError ? 'refused' : `threw ${e instanceof Error ? e.constructor.name : typeof e}: ${String(e).slice(0, 120)}`;
      }
      const ms = performance.now() - t0;
      assert.equal(outcome, 'refused', `seed ${SEED} case ${n} (${name}): ${outcome}`);
      assert.ok(ms < 250, `seed ${SEED} case ${n} (${name}): ${ms.toFixed(0)} ms`);
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    assert.equal(seen.size, mutations.length, 'every kind of mutation was tried');
  });
});
