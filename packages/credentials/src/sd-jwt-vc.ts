import type { JWK } from 'jose';
import { CredentialError, type Signer } from './jws';
import { type Issued, issueSdJwt, verifySdJwt, type VerifyOptions } from './sd-jwt';

/**
 * SD-JWT-based Verifiable Digital Credentials (IETF draft-ietf-oauth-sd-jwt-vc, -26 of November 2026): typ dc+sd-jwt,
 * a credential type `vct`, the holder's key in `cnf.jwk`, an optional status reference (Token Status List). Claims
 * that verifiers rely on to process the credential are never selectively disclosable.
 */
export const VC_TYP = 'dc+sd-jwt';
export const NEVER_DISCLOSABLE = new Set(['iss', 'nbf', 'exp', 'cnf', 'vct', 'vct#integrity', 'status']);

export interface StatusReference {
  status_list: { idx: number; uri: string };
}

export interface CredentialInput {
  iss: string;
  vct: string;
  holderJwk: JWK;
  iat?: number;
  nbf?: number;
  exp: number;
  status?: StatusReference;
  /** The subject's claims (W3C VC 2.0 data model mapped to JSON claims; doc phase-4). */
  claims: Record<string, unknown>;
  /** Paths of the claims the holder may disclose one by one (e.g. "given_name", "address/locality"). */
  selectivelyDisclosable: string[];
  decoys?: number;
}

export async function issueCredential(signer: Signer, input: CredentialInput): Promise<Issued> {
  for (const p of input.selectivelyDisclosable) {
    if (NEVER_DISCLOSABLE.has(p.split('/')[0]!)) throw new CredentialError('claims', `${p} cannot be selectively disclosable`);
  }
  for (const k of Object.keys(input.claims)) if (NEVER_DISCLOSABLE.has(k) || k === 'iat') throw new CredentialError('claims', `${k} is set by the issuer, not a subject claim`);
  if (input.holderJwk.d) throw new CredentialError('key', 'the holder key must be public');
  if (!Number.isInteger(input.exp)) throw new CredentialError('claims', 'exp is required');
  const iat = input.iat ?? Math.floor(Date.now() / 1000);
  const payload = {
    iss: input.iss, iat, ...(input.nbf ? { nbf: input.nbf } : {}), exp: input.exp, vct: input.vct,
    cnf: { jwk: input.holderJwk }, ...(input.status ? { status: input.status } : {}), ...input.claims,
  };
  return issueSdJwt(signer, VC_TYP, JSON.parse(JSON.stringify(payload)) as Parameters<typeof issueSdJwt>[2], input.selectivelyDisclosable, input.decoys ?? 0);
}

export interface VerifiedCredential {
  iss: string;
  vct: string;
  claims: Record<string, unknown>;
  status?: StatusReference;
  disclosedPaths: string[];
}

/** Verifies an SD-JWT VC presentation; the caller then checks the issuer is trusted for `vct` and the status. */
export async function verifyCredential(compact: string, opts: Omit<VerifyOptions, 'typ'> & { acceptedVct?: string[] }): Promise<VerifiedCredential> {
  const v = await verifySdJwt(compact, { ...opts, typ: VC_TYP });
  const c = v.claims;
  if (typeof c.iss !== 'string' || typeof c.vct !== 'string') throw new CredentialError('claims', 'iss and vct are required');
  if (typeof c.exp !== 'number') throw new CredentialError('claims', 'exp is required by this profile');
  if (opts.acceptedVct && !opts.acceptedVct.includes(c.vct)) throw new CredentialError('vct', `credential type ${c.vct} not accepted`);
  for (const p of v.disclosedPaths) if (NEVER_DISCLOSABLE.has(p.split('/')[0]!)) throw new CredentialError('claims', `${p} must not be selectively disclosed`);
  const status = c.status as StatusReference | undefined;
  if (status !== undefined) {
    const sl = status?.status_list;
    if (!sl || !Number.isInteger(sl.idx) || sl.idx < 0 || typeof sl.uri !== 'string' || !/^https:\/\//.test(sl.uri)) throw new CredentialError('status', 'malformed status reference');
  }
  return { iss: c.iss, vct: c.vct, claims: c, status, disclosedPaths: v.disclosedPaths };
}
