import { CredentialError } from './jws';
import { NEVER_DISCLOSABLE } from './sd-jwt-vc';

/**
 * The W3C Verifiable Credentials Data Model v2.0 view of a verified SD-JWT VC (P4-A3; doc phase-4/08).
 *
 * The cell issues SD-JWT VC (`dc+sd-jwt`, HAIP). For systems that consume the W3C data model, a verifier can turn
 * what it verified into a VCDM 2.0 credential document: the same claim names, given their meaning by a JSON-LD
 * context (CIVORA_CLAIMS_CONTEXT, served by the cell at /v1/contexts/civora-claims-v1.jsonld), with the issuer, type and
 * validity of the credential. It is a data-model view of a credential already verified (signature, key binding,
 * status), not a second secured format: it carries no proof, and it is never handed back to a wallet.
 *
 * The mapping refuses a claim that has no term in the context, so a new claim cannot be mapped silently to the
 * "issuer-dependent" vocabulary of the base context.
 */
export const VCDM2_BASE_CONTEXT = 'https://www.w3.org/ns/credentials/v2';
export const CIVORA_CLAIMS_CONTEXT_PATH = '/v1/contexts/civora-claims-v1.jsonld';

const S = 'https://schema.org/';
/** Claim names of the SD-JWT VC credentials (OpenID Connect standard claims where they exist) → schema.org terms. */
export const CIVORA_CLAIMS_CONTEXT = {
  '@context': {
    '@version': 1.1,
    '@protected': true,
    civora: 'urn:civora:vocab:',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    given_name: `${S}givenName`,
    family_name: `${S}familyName`,
    given_name_ar: { '@id': `${S}givenName`, '@language': 'ar' },
    family_name_ar: { '@id': `${S}familyName`, '@language': 'ar' },
    birthdate: { '@id': `${S}birthDate`, '@type': 'xsd:date' },
    address: {
      '@id': `${S}address`,
      '@context': { '@protected': true, locality: `${S}addressLocality`, country: `${S}addressCountry` },
    },
    document_number: 'civora:documentNumber',
  },
} as const;

type Ctx = Record<string, unknown>;
const terms = (ctx: Ctx): Set<string> => new Set(Object.keys(ctx).filter((k) => !k.startsWith('@') && k !== 'civora' && k !== 'xsd'));
const scoped = (ctx: Ctx, term: string): Ctx | null => {
  const def = ctx[term];
  return def && typeof def === 'object' && '@context' in def ? ((def as { '@context': Ctx })['@context']) : null;
};

/** `urn:civora:tn:synthetic:residence-certificate:1` → `ResidenceCertificate` (the credential's VCDM type). */
export function vcdm2TypeName(vct: string): string {
  const m = /^urn:civora:[a-z]{2}:[a-z-]+:([a-z0-9-]+):[0-9]+$/.exec(vct);
  if (!m) throw new CredentialError('vcdm2', 'not a CIVORA credential type');
  return m[1]!.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

const iso = (seconds: unknown, name: string): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) throw new CredentialError('vcdm2', `${name} is not a NumericDate`);
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
};

/**
 * The VCDM 2.0 document of a verified credential. `claims` are the verified claims (processing claims are left out:
 * they become issuer, type and validity). `contextUrl` is where this cell serves CIVORA_CLAIMS_CONTEXT.
 */
export function toVcdm2(v: { iss: string; vct: string; claims: Record<string, unknown> }, contextUrl: string): Record<string, unknown> {
  if (!/^https:\/\/[^\s]+$/.test(contextUrl)) throw new CredentialError('vcdm2', 'the context URL must be https');
  const ctx = CIVORA_CLAIMS_CONTEXT['@context'] as unknown as Ctx;
  const known = terms(ctx);
  const subject: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(v.claims)) {
    if (NEVER_DISCLOSABLE.has(name) || name === 'iat' || name === '_sd' || name === '_sd_alg') continue;
    if (!known.has(name)) throw new CredentialError('vcdm2', `claim ${name} has no term in the CIVORA context`);
    const inner = scoped(ctx, name);
    if (inner && value && typeof value === 'object' && !Array.isArray(value)) {
      const innerTerms = terms(inner);
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(value as Record<string, unknown>)) {
        if (k === '_sd') continue;
        if (!innerTerms.has(k)) throw new CredentialError('vcdm2', `claim ${name}/${k} has no term in the CIVORA context`);
        out[k] = x;
      }
      subject[name] = out;
    } else subject[name] = value;
  }
  const c = v.claims;
  return {
    '@context': [VCDM2_BASE_CONTEXT, contextUrl],
    type: ['VerifiableCredential', vcdm2TypeName(v.vct)],
    issuer: v.iss,
    validFrom: iso(c.nbf ?? c.iat, c.nbf !== undefined ? 'nbf' : 'iat'),
    ...(c.exp !== undefined ? { validUntil: iso(c.exp, 'exp') } : {}),
    credentialSubject: subject,
  };
}
