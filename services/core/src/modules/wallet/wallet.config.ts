import { pkcs11Signer, type Pkcs11Signer, type Signer } from '@civora/credentials';
import type { JWK } from 'jose';
import type { IssuerRow } from './wallet.repository';

/**
 * Configuration of the wallet's issuer endpoints (Phase 4, doc phase-4/03). Off unless WALLET_PUBLIC_URL is set.
 *
 *   WALLET_PUBLIC_URL      https base URL the wallet endpoints are reached under (issuer identifiers are
 *                          <WALLET_PUBLIC_URL>/issuers/<slug>; DPoP proofs name <WALLET_PUBLIC_URL><path>)
 *   WALLET_HSM_MODULE      PKCS#11 module of the issuers' token (SoftHSM in dev and test, ADR-028)
 *   WALLET_HSM_PIN_ENV     name of the variable holding the token's user PIN (default CIVORA_HSM_PIN)
 *   WALLET_STATUS_LIST_VALIDITY_SECONDS  how long a signed status list may be used (exp; default 86400, Q4-4)
 */
export interface WalletConfig {
  publicUrl: string;
  hsm: { module: string; pinEnv: string };
  offerTtlSeconds: number;
  tokenTtlSeconds: number;
  nonceTtlSeconds: number;
  statusListTtlSeconds: number;
  statusListValiditySeconds: number;
}

export function loadWalletConfig(env: NodeJS.ProcessEnv = process.env): WalletConfig | null {
  const publicUrl = (env.WALLET_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  if (!publicUrl) return null;
  if (!/^https:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/.test(publicUrl)) throw new Error('WALLET_PUBLIC_URL must be an https base URL without a path');
  const module = (env.WALLET_HSM_MODULE ?? '').trim();
  if (!module) throw new Error('WALLET_HSM_MODULE is required when the wallet is on (issuer keys live in the HSM, P4-A5)');
  const validity = Number(env.WALLET_STATUS_LIST_VALIDITY_SECONDS ?? 86400);
  if (!Number.isInteger(validity) || validity < 300 || validity > 7 * 86400) throw new Error('WALLET_STATUS_LIST_VALIDITY_SECONDS: 300 to 604800');
  return {
    publicUrl,
    hsm: { module, pinEnv: (env.WALLET_HSM_PIN_ENV ?? 'CIVORA_HSM_PIN').trim() },
    offerTtlSeconds: 600,
    tokenTtlSeconds: 300,
    nonceTtlSeconds: 300,
    statusListTtlSeconds: 300,
    statusListValiditySeconds: validity,
  };
}

/** Issuer signers, one per issuer key, made on first use (the signer checks itself against the token, doc 02). */
export class IssuerSigners {
  private readonly cache = new Map<string, Promise<Pkcs11Signer>>();

  constructor(private readonly cfg: WalletConfig) {}

  async forIssuer(issuer: IssuerRow): Promise<Signer & { publicJwk: JWK }> {
    return this.forKey({ tokenLabel: issuer.hsmTokenLabel, keyId: issuer.hsmKeyId, kid: issuer.kid, publicJwk: issuer.publicJwk });
  }

  /** Any key of the cell's token (issuers and verifiers), checked against the public key registered for it. */
  async forKey(k: { tokenLabel: string; keyId: string; kid: string; publicJwk: JWK }): Promise<Signer & { publicJwk: JWK }> {
    const key = `${k.tokenLabel}\0${k.keyId}\0${k.kid}`;
    let p = this.cache.get(key);
    if (!p) {
      p = pkcs11Signer({ module: this.cfg.hsm.module, tokenLabel: k.tokenLabel, keyId: k.keyId, pinEnv: this.cfg.hsm.pinEnv, kid: k.kid });
      this.cache.set(key, p);
      p.catch(() => this.cache.delete(key));
    }
    const signer = await p;
    if (signer.publicJwk.x !== k.publicJwk.x || signer.publicJwk.y !== k.publicJwk.y) {
      throw new Error(`the token key for ${k.kid} is not the registered public key`);
    }
    return signer;
  }
}

/**
 * The institution whose staff (role credential-officer) may suspend, reinstate and revoke issued credentials
 * (P4-F5; doc phase-4/07): the cell operator, as the demo issuers are its own (Q4-1). Required outside dev and test.
 */
export function loadOfficerTenant(env: NodeJS.ProcessEnv = process.env): string | null {
  const t = (env.WALLET_OFFICER_TENANT ?? '').trim() || null;
  // Only a cell with the wallet on has officers to restrict; without the wallet the routes answer 503 anyway.
  const walletOn = !!(env.WALLET_PUBLIC_URL ?? '').trim();
  if (!t && walletOn && !['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('WALLET_OFFICER_TENANT is required when the wallet is on, outside dev and test');
  if (t && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)) throw new Error('WALLET_OFFICER_TENANT must be the issuing institution\'s tenant id (a UUID)');
  return t;
}
