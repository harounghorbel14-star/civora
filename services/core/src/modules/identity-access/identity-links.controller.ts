import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Inject, NotFoundException,
  Param, ParseUUIDPipe, Post, Req, ServiceUnavailableException, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty,
  ApiPropertyOptional, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readSecret } from '../../config/app-config';
import { EidRejected, EidUnavailable, type NationalEid } from '../integrations/public-api';
import type { IamRepository } from './iam.repository';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import { keycloakLocale } from './locale';
import { RequireStepUp } from './step-up.guard';
import { IAM_REPOSITORY, IDENTITY_LINKS } from './tokens';

/** What identity links need: the eID adapter and the cell's key for identifier digests. */
export interface IdentityLinksDeps {
  eid: NationalEid;
  digestKey: Buffer;
}

/** The cell's key for identifier digests (IDENTITY_CLAIM_DIGEST_KEY or _FILE, base64, at least 32 bytes); null if unset. */
export function loadIdentityDigestKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = readSecret(env, 'IDENTITY_CLAIM_DIGEST_KEY');
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length < 32) throw new Error('IDENTITY_CLAIM_DIGEST_KEY must be at least 32 bytes, base64-encoded');
  return key;
}

const ATTEMPT_SECONDS = 600;
const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();
const token = (): string => randomBytes(32).toString('base64url');

/** Keyed digest of a national identifier (HMAC-SHA-256 with the cell's key): the only form the core keeps. */
export function nationalIdDigest(key: Buffer, nationalId: string): Buffer {
  return createHmac('sha256', key).update(`national-id-link\0${nationalId}`, 'utf8').digest();
}

class IdentityClaimDto {
  @ApiProperty({ enum: ['national-id-link', 'phone', 'email', 'legal-name'] }) type!: string;
  @ApiProperty({ enum: ['eid-simulated', 'self-asserted', 'staff-verified'] }) source!: string;
  @ApiProperty({ enum: ['low', 'substantial', 'high'] }) loa!: string;
  @ApiProperty({ format: 'date-time' }) verifiedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', type: String, nullable: true }) expiresAt!: string | null;
}
class StartLink {
  @ApiPropertyOptional({ example: 'fr-TN', description: 'Language of the eID pages; default: your preferred language' }) locale?: string;
}
class LinkAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['pending'] }) status!: string;
  @ApiProperty({ description: 'Send the browser here: a fresh authentication at the (simulated) national eID' }) authorizationUrl!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
class CompleteLink {
  @ApiProperty({ description: 'The code the eID returned to the app callback' }) code!: string;
  @ApiProperty({ description: 'The state the eID returned to the app callback' }) state!: string;
}
class LinkResultDto {
  @ApiProperty({ enum: ['linked', 'refreshed'] }) outcome!: string;
  @ApiProperty({ enum: ['substantial', 'high'] }) loa!: string;
  @ApiProperty({ format: 'date-time' }) authenticatedAt!: string;
}

/**
 * Identity links (P3-API6) through the national eID adapter (P3-D4; simulated in Phase 3). The citizen starts an attempt
 * (recent sign-in required), authenticates at the eID, and the app completes the attempt with the code and state the eID
 * returned. The core verifies the eID's signed answer and keeps a keyed digest of the national identifier, never the
 * value (iam.identity_claim, P3-DB4). One national identity links to one person.
 */
@ApiTags('identity')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid access token' })
@Controller('v1/identity/links')
export class IdentityLinksController {
  constructor(
    @Inject(IAM_REPOSITORY) private readonly repo: IamRepository,
    @Inject(IDENTITY_LINKS) private readonly links: IdentityLinksDeps | null,
  ) {}

  @Get()
  @UseGuards(IdentityGuard)
  @ApiOperation({ operationId: 'listIdentityLinks', summary: 'Your verified identity claims: type, source and level only (never the identifier)' })
  @ApiOkResponse({ type: [IdentityClaimDto] })
  async list(@Req() req: IdentifiedRequest): Promise<IdentityClaimDto[]> {
    return (await this.repo.identityClaims(req.identity!.personId)).map((c) => ({
      type: c.type, source: c.source, loa: c.loa, verifiedAt: c.verifiedAt.toISOString(), expiresAt: c.expiresAt?.toISOString() ?? null,
    }));
  }

  @Post()
  @RequireStepUp()
  @ApiOperation({ operationId: 'startIdentityLink', summary: 'Start linking your national eID identity (citizens; recent sign-in required)' })
  @ApiBody({ type: StartLink, required: false })
  @ApiCreatedResponse({ type: LinkAttemptDto })
  @ApiForbiddenResponse({ description: 'Citizens only' })
  @ApiTooManyRequestsResponse({ description: 'More than 5 attempts in an hour' })
  async start(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<LinkAttemptDto> {
    const deps = this.deps();
    const id = req.identity!;
    if (id.realm !== 'citizens') throw new ForbiddenException('Citizens only');
    const requested = (body as { locale?: unknown } | undefined)?.locale;
    if (requested !== undefined && (typeof requested !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(requested))) {
      throw new BadRequestException({ errors: ['locale: a locale such as ar-TN, fr-TN or en'] });
    }
    const state = token();
    const nonce = token();
    const verifier = token();
    let attemptId: string;
    try {
      attemptId = await this.repo.startIdentityLink(id.personId, sha256(state), nonce, verifier, ATTEMPT_SECONDS);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '42501') throw new ForbiddenException('Citizens only');
      if (code === '53400') throw new HttpException('Too many identity link attempts; try again later', HttpStatus.TOO_MANY_REQUESTS);
      throw e;
    }
    const locale = typeof requested === 'string' ? requested : id.locale;
    return {
      id: attemptId,
      status: 'pending',
      authorizationUrl: deps.eid.authorizationUrl({
        state, nonce, codeChallenge: createHash('sha256').update(verifier).digest('base64url'), locale: locale ? keycloakLocale(locale) : undefined,
      }),
      expiresAt: new Date(Date.now() + ATTEMPT_SECONDS * 1000).toISOString(),
    };
  }

  @Post(':id\\:complete')
  @HttpCode(200)
  @UseGuards(IdentityGuard)
  @ApiOperation({ operationId: 'completeIdentityLink', summary: 'Complete a link attempt with the code and state the eID returned' })
  @ApiBody({ type: CompleteLink })
  @ApiOkResponse({ type: LinkResultDto })
  @ApiNotFoundResponse({ description: 'No such open attempt of yours, or the state does not match, or it expired or was used (not distinguished)' })
  @ApiUnprocessableEntityResponse({ description: 'The eID did not confirm an identity (refused, or its answer failed verification)' })
  @ApiConflictResponse({ description: 'This national identity is linked to another account, or your account to another identity' })
  async complete(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) attemptId: string, @Body() body: unknown): Promise<LinkResultDto> {
    const deps = this.deps();
    const b = (body ?? {}) as { code?: unknown; state?: unknown };
    if (typeof b.code !== 'string' || !/^[A-Za-z0-9._~+/=-]{1,2048}$/.test(b.code) || typeof b.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.state)) {
      throw new BadRequestException({ errors: ['code and state: as returned by the eID to the app callback'] });
    }
    const me = req.identity!.personId;
    const claimed = await this.repo.claimIdentityLink(me, attemptId, sha256(b.state));
    if (!claimed) throw new NotFoundException();
    let identity;
    try {
      identity = await deps.eid.complete({
        code: b.code, codeVerifier: claimed.codeVerifier, nonce: claimed.nonce, correlationId: String(req.headers['x-request-id'] ?? ''),
      });
    } catch (e) {
      if (e instanceof EidRejected) {
        await this.repo.finishIdentityLink(me, attemptId, null, deps.eid.claimSource, null);
        throw new UnprocessableEntityException('The national eID did not confirm an identity; start again');
      }
      if (e instanceof EidUnavailable) throw new ServiceUnavailableException('The national eID is unavailable; start again later');
      throw e;
    }
    const outcome = await this.repo.finishIdentityLink(me, attemptId, nationalIdDigest(deps.digestKey, identity.nationalId), deps.eid.claimSource, identity.loa);
    if (outcome === 'linked-elsewhere') throw new ConflictException('This national identity is already linked to another account');
    if (outcome === 'other-identity') throw new ConflictException('Your account is already linked to a different national identity');
    if (outcome !== 'linked' && outcome !== 'refreshed') throw new UnprocessableEntityException('The national eID did not confirm an identity; start again');
    return { outcome, loa: identity.loa, authenticatedAt: identity.authenticatedAt.toISOString() };
  }

  private deps(): IdentityLinksDeps {
    if (!this.links) throw new ServiceUnavailableException('No national eID is configured in this cell');
    return this.links;
  }
}
