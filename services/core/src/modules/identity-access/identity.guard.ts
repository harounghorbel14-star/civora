import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { LoadedPack } from '@civora/country-packs';
import { COUNTRY_PACK } from '../../country-config/country-config.module';
import { packLocale } from './locale';
import { ADAPTIVE_CONTROLS, IAM_REPOSITORY, TOKEN_VERIFIER } from './tokens';
import type { AdaptiveControls } from './adaptive-context';
import type { IamRepository } from './iam.repository';
import { TokenError, type TokenVerifier, type VerifiedToken } from './token-verifier';
import { type DpopConfig, DpopError, loadDpopConfig, verifyDpopProof } from './dpop';

export interface Identity extends VerifiedToken {
  personId: string;
}
export type IdentifiedRequest = Request & { identity?: Identity };

/**
 * Requires a verified access token. The person comes from the token only, never from the request body or path
 * (ADR-016). Tokens are never logged. A token bound to a key (DPoP, RFC 9449) is accepted only as
 * `Authorization: DPoP <token>` with a valid proof (dpop.ts); a bound token sent as a bearer token is refused, and so
 * is a bearer token from a client that must use DPoP (the web app).
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IAM_REPOSITORY) private readonly repo: IamRepository | null,
    @Inject(COUNTRY_PACK) private readonly pack: LoadedPack,
    @Optional() @Inject(ADAPTIVE_CONTROLS) private readonly adaptive: AdaptiveControls | null = null,
  ) {}

  private readonly dpop: DpopConfig = loadDpopConfig();

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<IdentifiedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    // A route may list this guard twice (class and step-up): verify once (a DPoP proof is single use).
    if (req.identity) return true;
    if (!this.verifier.enabled || !this.repo) throw new ServiceUnavailableException('Authentication is not configured in this cell');
    const header = req.headers.authorization ?? '';
    const match = /^(Bearer|DPoP) ([A-Za-z0-9._~+/=-]{20,8192})$/.exec(header);
    if (!match) return this.deny(res, 'invalid_request');
    const [, scheme, raw] = match as unknown as [string, 'Bearer' | 'DPoP', string];
    let token: VerifiedToken;
    try {
      token = await this.verifier.verify(raw);
    } catch (e) {
      if (e instanceof TokenError) return this.deny(res, 'invalid_token');
      throw new HttpException('Token verification unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (token.jkt) {
      const proof = req.headers.dpop;
      if (scheme !== 'DPoP' || typeof proof !== 'string') return this.deny(res, 'invalid_token', 'DPoP');
      const path = (req.originalUrl ?? req.url).split(/[?#]/)[0];
      const bases = this.dpop.publicUrls.length ? this.dpop.publicUrls : [`${req.protocol}://${req.get('host') ?? ''}`];
      try {
        await verifyDpopProof({ proof, method: req.method, urls: bases.map((b) => b + path), accessToken: raw, jkt: token.jkt,
          claimJti: (digest, ttl) => this.repo!.claimDpopJti(digest, ttl) });
      } catch (e) {
        if (e instanceof DpopError) return this.deny(res, 'invalid_dpop_proof', 'DPoP');
        throw new HttpException('Token verification unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }
    } else if (scheme !== 'Bearer' || (token.clientId && this.dpop.requiredClients.has(token.clientId))) {
      return this.deny(res, 'invalid_token', scheme === 'DPoP' ? 'DPoP' : 'Bearer');
    }
    // Keycloak sends a language (ar, fr, en); the person's preference is stored as a locale of the pack (ar-TN, ...).
    const { supported, default: fallback } = this.pack.pack.locales;
    const mapped: VerifiedToken = { ...token, locale: token.locale ? packLocale(token.locale, supported, fallback) : null };
    const identity = { ...mapped, personId: await this.repo.ensurePerson(mapped) };
    // Adaptive controls (doc phase-3/15): a session now used from another device or browser is ended and refused.
    if (this.adaptive && (await this.adaptive.check(identity, req.headers)) === 'deny') return this.deny(res, 'invalid_token', scheme);
    req.identity = identity;
    return true;
  }

  private deny(res: Response, error: 'invalid_request' | 'invalid_token' | 'invalid_dpop_proof', scheme: 'Bearer' | 'DPoP' = 'Bearer'): never {
    res.setHeader('WWW-Authenticate', scheme === 'DPoP' ? `DPoP realm="civora", error="${error}", algs="ES256 PS256 RS256 EdDSA"` : `Bearer realm="civora", error="${error}"`);
    throw new UnauthorizedException('A valid access token is required');
  }
}
