import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IAM_REPOSITORY, TOKEN_VERIFIER } from './tokens';
import type { IamRepository } from './iam.repository';
import { TokenError, type TokenVerifier, type VerifiedToken } from './token-verifier';

export interface Identity extends VerifiedToken {
  personId: string;
}
export type IdentifiedRequest = Request & { identity?: Identity };

/**
 * Requires a verified access token (Authorization: Bearer). The person comes from the token only, never from
 * the request body or path (ADR-016). Tokens are never logged.
 */
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(IAM_REPOSITORY) private readonly repo: IamRepository | null,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<IdentifiedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    if (!this.verifier.enabled || !this.repo) throw new ServiceUnavailableException('Authentication is not configured in this cell');
    const header = req.headers.authorization ?? '';
    const match = /^Bearer ([A-Za-z0-9._~+/=-]{20,8192})$/.exec(header);
    if (!match) return this.deny(res, 'invalid_request');
    let token: VerifiedToken;
    try {
      token = await this.verifier.verify(match[1]!);
    } catch (e) {
      if (e instanceof TokenError) return this.deny(res, 'invalid_token');
      throw new HttpException('Token verification unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
    req.identity = { ...token, personId: await this.repo.ensurePerson(token) };
    return true;
  }

  private deny(res: Response, error: 'invalid_request' | 'invalid_token'): never {
    res.setHeader('WWW-Authenticate', `Bearer realm="civora", error="${error}"`);
    throw new UnauthorizedException('A valid access token is required');
  }
}
