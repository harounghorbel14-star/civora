import { applyDecorators, type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { recentlyAuthenticated, stepUpChallenge } from './account-security';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import { STEP_UP_MAX_AGE } from './tokens';

/**
 * Step-up (P3-A4) as defined by RFC 9470: when the access token does not show a recent sign-in with credentials,
 * the answer is 401 with WWW-Authenticate error="insufficient_user_authentication" and max_age; the app then signs
 * the person in again (prompt=login / max_age) and retries with the new token.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(@Inject(STEP_UP_MAX_AGE) private readonly maxAge: number) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<IdentifiedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    if (req.identity && recentlyAuthenticated(req.identity, this.maxAge)) return true;
    res.setHeader('WWW-Authenticate', stepUpChallenge(this.maxAge));
    throw new UnauthorizedException('A recent sign-in is required for this action');
  }
}

/** Requires a valid access token AND a recent sign-in (identity guard first, then step-up). */
export const RequireStepUp = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    UseGuards(IdentityGuard, StepUpGuard),
    ApiUnauthorizedResponse({ description: 'No valid access token, or no recent sign-in (WWW-Authenticate: error="insufficient_user_authentication", max_age)' }),
  );
