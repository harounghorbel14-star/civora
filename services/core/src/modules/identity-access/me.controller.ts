import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { LoadedPack } from '@civora/country-packs';
import { COUNTRY_PACK } from '../../country-config/country-config.module';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import type { IamRepository } from './iam.repository';
import { ACCESSIBILITY_KEYS, accessibilityProblems } from './mandate-rules';
import { IAM_REPOSITORY } from './tokens';
import { loadPairwiseSectors, pairwiseSub } from './pairwise';

class AccountDto {
  @ApiProperty({ enum: ['citizens', 'staff'] }) realm!: string;
  @ApiProperty({ enum: ['active', 'suspended', 'closed'] }) status!: string;
  @ApiProperty({ enum: ['AAL1', 'AAL2', 'AAL3'] }) assuranceLevel!: string;
}
export class MeResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ar-TN' }) preferredLocale!: string;
  @ApiProperty({ type: 'object', additionalProperties: true, example: { textSize: 'large', highContrast: true } }) accessibility!: Record<string, unknown>;
  @ApiProperty({ type: [AccountDto] }) accounts!: AccountDto[];
}
class MePatch {
  @ApiPropertyOptional({ example: 'fr-TN', description: 'One of the locales supported by the country pack' }) preferredLocale?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: `Allowed keys: ${Object.keys(ACCESSIBILITY_KEYS).join(', ')}` })
  accessibility?: Record<string, unknown>;
}

class PairwiseDto {
  @ApiProperty({ example: 'rp1.agency.invalid', description: 'The relying party\'s sector (host)' }) sector!: string;
  @ApiProperty({ format: 'uuid', description: 'The identifier that relying party knows you by' }) subject!: string;
}

@ApiTags('identity')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid access token' })
@UseGuards(IdentityGuard)
@Controller('v1/me')
export class MeController {
  /** Relying-party sectors and salts (P3-DB6), loaded once; empty when the cell has none configured. */
  private readonly sectors = loadPairwiseSectors();

  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository, @Inject(COUNTRY_PACK) private readonly pack: LoadedPack) {}

  /** Mirrors the person's pairwise subjects (iam.pairwise_id), computed as Keycloak computes them; only what changed. */
  private async mirror(req: IdentifiedRequest): Promise<void> {
    const id = req.identity!;
    if (id.realm !== 'citizens' || !this.sectors.length) return;
    const have = new Map((await this.repo.pairwiseIds(id.personId)).map((r) => [r.sector, r.subject]));
    const rows = this.sectors.map((s) => ({ sector: s.sector, subject: pairwiseSub(s.sector, id.subject, s.salt) })).filter((r) => have.get(r.sector) !== r.subject);
    if (rows.length) await this.repo.mirrorPairwiseIds(id.personId, rows);
  }

  @Get('pairwise')
  @ApiOperation({ operationId: 'listMyPairwiseIds', summary: 'Which services know you under which identifier (your pairwise subjects; citizens)' })
  @ApiOkResponse({ type: [PairwiseDto] })
  async pairwise(@Req() req: IdentifiedRequest): Promise<PairwiseDto[]> {
    if (req.identity!.realm !== 'citizens') return [];
    await this.mirror(req);
    return this.repo.pairwiseIds(req.identity!.personId);
  }

  @Get()
  @ApiOperation({ operationId: 'getMe', summary: 'The signed-in person: preferences and accounts (P3-API2)' })
  @ApiOkResponse({ type: MeResponse })
  async get(@Req() req: IdentifiedRequest): Promise<MeResponse> {
    const me = await this.repo.me(req.identity!.personId);
    if (!me) throw new NotFoundException();
    await this.mirror(req).catch(() => undefined); // the mirror never fails the profile
    return me;
  }

  @Patch()
  @HttpCode(204)
  @ApiOperation({ operationId: 'updateMe', summary: 'Change language and accessibility preferences (P3-F3, P3-F4)' })
  @ApiBody({ type: MePatch })
  @ApiNoContentResponse({ description: 'Updated' })
  async patch(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<void> {
    const b = (body ?? {}) as Record<string, unknown>;
    const errors: string[] = [];
    if (typeof b !== 'object' || Array.isArray(b)) errors.push('body: an object is required');
    for (const k of Object.keys(b)) if (!['preferredLocale', 'accessibility'].includes(k)) errors.push('body: only preferredLocale and accessibility may be changed');
    if (b.preferredLocale !== undefined && (typeof b.preferredLocale !== 'string' || !this.pack.pack.locales.supported.includes(b.preferredLocale))) {
      errors.push(`preferredLocale: must be one of ${this.pack.pack.locales.supported.join(', ')}`);
    }
    if (b.accessibility !== undefined) errors.push(...accessibilityProblems(b.accessibility));
    if (errors.length) throw new BadRequestException({ errors: [...new Set(errors)] });
    await this.repo.updateMe(req.identity!.personId, {
      preferredLocale: b.preferredLocale as string | undefined,
      accessibility: b.accessibility as Record<string, unknown> | undefined,
    });
  }
}
