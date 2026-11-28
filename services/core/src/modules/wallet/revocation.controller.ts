import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Req,
  ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IdentityGuard, type IdentifiedRequest, RequireStepUp } from '../identity-access/public-api';
import { OFFICER_TENANT, WALLET_REPOSITORY } from './tokens';
import type { IssuedView, WalletRepository } from './wallet.repository';

/**
 * Revocation and suspension asked for over HTTP (P4-F5; doc phase-4/07). The status list bit changes through the
 * wallet schema's functions only; these routes decide who may ask. Both need a recent sign-in (step-up, P3-A4):
 * a revocation cannot be undone.
 */
class ReasonDto {
  @ApiProperty({ enum: ['holder-request', 'lost-device', 'data-changed', 'issued-in-error', 'under-review', 'review-cleared'] }) reason!: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const view = (v: IssuedView) => ({
  id: v.id, vct: v.vct, issuer: v.issuer, status: v.status, status_reason: v.statusReason,
  issued_at: v.issuedAt.toISOString(), expires_at: v.expiresAt.toISOString(), status_changed_at: v.statusChangedAt?.toISOString() ?? null,
});
const reasonOf = (b: unknown): string => {
  const r = (b as { reason?: unknown } | undefined)?.reason;
  if (typeof r !== 'string' || !/^[a-z-]{3,20}$/.test(r)) throw new BadRequestException('reason is required');
  return r;
};

/** The holder's side: the credentials issued to them, and revoking one (a lost phone, or no longer wanted). */
@ApiTags('wallet')
@ApiBearerAuth()
@Controller('v1/wallet/issued')
export class HolderRevocationController {
  constructor(@Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository | null) {}

  private r(): WalletRepository {
    if (!this.repo) throw new ServiceUnavailableException('The wallet is not available in this cell');
    return this.repo;
  }

  @Get()
  @UseGuards(IdentityGuard)
  @ApiOperation({ summary: 'Credentials issued to the signed-in person: type, issuer, status, dates (no claim values)' })
  async list(@Req() req: IdentifiedRequest): Promise<unknown> {
    if (req.identity!.realm !== 'citizens') throw new ForbiddenException('for citizens');
    return (await this.r().issuedTo(req.identity!.personId)).map(view);
  }

  @Post(':action')
  @HttpCode(200)
  @RequireStepUp()
  @ApiOperation({ summary: '{id}:revoke — revoke one of your credentials (reason holder-request or lost-device); final' })
  @ApiBody({ type: ReasonDto })
  async revoke(@Req() req: IdentifiedRequest, @Param('action') action: string, @Body() body: ReasonDto): Promise<unknown> {
    const m = /^([0-9a-f-]{36}):revoke$/.exec(action);
    if (!m || !UUID.test(m[1]!)) throw new NotFoundException();
    if (req.identity!.realm !== 'citizens') throw new ForbiddenException('for citizens');
    const reason = reasonOf(body);
    const r = await this.r().holderRevoke(req.identity!.personId, m[1]!, reason);
    if (r === 'unknown') throw new NotFoundException('no such credential');
    if (r === 'conflict') throw new ConflictException('this credential is already revoked');
    if (r === 'invalid') throw new BadRequestException('reason: holder-request or lost-device');
    return { id: m[1], status: 'revoked', reason };
  }
}

/** The issuer's officers: look up an issued credential, suspend it for a review, reinstate it, or revoke it. */
@ApiTags('wallet')
@ApiBearerAuth()
@Controller('v1/admin/wallet/issued')
export class OfficerRevocationController {
  constructor(@Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository | null, @Inject(OFFICER_TENANT) private readonly tenant: string | null) {}

  private r(): WalletRepository {
    if (!this.repo) throw new ServiceUnavailableException('The wallet is not available in this cell');
    return this.repo;
  }

  private officer(req: IdentifiedRequest): string {
    const id = req.identity!;
    if (id.realm !== 'staff' || !id.roles.includes('credential-officer')) throw new ForbiddenException('the credential-officer role is required');
    if (this.tenant !== null && id.tenantId !== this.tenant) throw new ForbiddenException('only the issuer\'s officers');
    return id.personId;
  }

  @Get(':id')
  @UseGuards(IdentityGuard)
  @ApiOperation({ summary: 'An issued credential: type, issuer, status, dates, history (no claim values, not the subject)' })
  async get(@Req() req: IdentifiedRequest, @Param('id') id: string): Promise<unknown> {
    this.officer(req);
    if (!UUID.test(id)) throw new NotFoundException();
    const v = await this.r().officerView(id);
    if (!v) throw new NotFoundException('no such credential');
    return { ...view(v), history: v.history };
  }

  @Post(':action')
  @HttpCode(200)
  @RequireStepUp()
  @ApiOperation({ summary: '{id}:suspend (under-review, lost-device, data-changed), {id}:reinstate (review-cleared), {id}:revoke (final)' })
  @ApiBody({ type: ReasonDto })
  async act(@Req() req: IdentifiedRequest, @Param('action') action: string, @Body() body: ReasonDto): Promise<unknown> {
    const officer = this.officer(req);
    const m = /^([0-9a-f-]{36}):(suspend|reinstate|revoke)$/.exec(action);
    if (!m || !UUID.test(m[1]!)) throw new NotFoundException();
    const status = m[2] === 'suspend' ? 'suspended' : m[2] === 'reinstate' ? 'valid' : 'revoked';
    const reason = reasonOf(body);
    const r = await this.r().officerSetStatus(m[1]!, status, reason, officer);
    if (r === 'unknown') throw new NotFoundException('no such credential');
    if (r === 'conflict') throw new ConflictException('no change, or the credential is revoked (final)');
    if (r === 'invalid') throw new BadRequestException('this reason does not fit this action');
    return { id: m[1], status, reason };
  }
}
