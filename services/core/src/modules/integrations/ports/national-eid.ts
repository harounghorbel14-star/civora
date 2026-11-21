import type { AdapterMode, AdapterRegistration } from '../adapter-registry';

/**
 * Port NationalEid (Phase 0 §8.7 IdentityProvider family; Phase 3 P3-D4). The person proves who they are at the
 * national eID; the adapter returns what the eID asserted, verified. Phase 3: simulated only (register entry I-01 is
 * class 3, not authorised; the scheme itself is open question Q3-2).
 */
export type EidLoa = 'substantial' | 'high';

export interface EidAuthorizationRequest {
  /** Opaque, single-use, bound to the person's link attempt. */
  state: string;
  /** Bound into the eID's signed answer. */
  nonce: string;
  /** PKCE S256 challenge. */
  codeChallenge: string;
  /** ar, fr or en, for the eID's pages. */
  locale?: string;
}

export interface EidCompletion {
  code: string;
  codeVerifier: string;
  nonce: string;
  correlationId: string;
}

export interface EidIdentity {
  /** The national identifier the eID asserted. Callers keep only a keyed digest of it, never the value. */
  nationalId: string;
  loa: EidLoa;
  /** When the person authenticated at the eID. */
  authenticatedAt: Date;
}

/** The eID refused, or its answer failed verification (signature, issuer, audience, nonce, freshness, format). */
export class EidRejected extends Error {}
/** The eID could not be reached or answered with a server error. */
export class EidUnavailable extends Error {}

export interface NationalEid {
  readonly registration: AdapterRegistration;
  readonly mode: AdapterMode;
  /** iam.identity_claim.source of claims verified through this adapter. */
  readonly claimSource: 'eid-simulated';
  /** Where the person's browser goes to authenticate at the eID (always a fresh authentication). */
  authorizationUrl(req: EidAuthorizationRequest): string;
  /** Exchanges the code and verifies the eID's signed answer. Throws EidRejected or EidUnavailable. */
  complete(c: EidCompletion): Promise<EidIdentity>;
}
