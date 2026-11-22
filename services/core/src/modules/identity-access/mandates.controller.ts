import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import { newInvitationCode, type IamRepository, type MandateRow } from './iam.repository';
import { effectiveStatus, MANDATE_ACTIONS, MANDATE_DOMAINS, mandateProblems } from './mandate-rules';
import { IAM_REPOSITORY } from './tokens';

const SCOPE_HELP = `Each scope is <domain>:<action>, domain in ${MANDATE_DOMAINS.join(', ')}, action in ${MANDATE_ACTIONS.join(', ')}`;

export class MandateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['principal', 'agent'], description: 'Your side of the mandate' }) role!: 'principal' | 'agent';
  @ApiProperty({ enum: ['proposed', 'active', 'revoked', 'expired'] }) status!: string;
  @ApiProperty({ type: [String], example: ['cases:read', 'payments:submit'], description: SCOPE_HELP }) scopes!: string[];
  @ApiProperty({ format: 'date-time' }) validFrom!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional({ format: 'date-time', type: String }) acceptedAt?: string;
  @ApiPropertyOptional({ format: 'date-time', type: String }) revokedAt?: string;
}
export class CreatedMandateDto extends MandateDto {
  @ApiProperty({ description: 'Give this code to the agent, once. It is not stored and cannot be shown again' }) invitationCode!: string;
}
class CreateMandate {
  @ApiProperty({ type: [String], example: ['cases:read'], description: SCOPE_HELP }) scopes!: string[];
  @ApiPropertyOptional({ format: 'date-time', description: 'Default: now' }) validFrom?: string;
  @ApiProperty({ format: 'date-time', description: 'At most 366 days after validFrom' }) expiresAt!: string;
}
class AcceptMandate {
  @ApiProperty({ description: 'The invitation code received from the principal' }) invitationCode!: string;
}
class MandateEventDto {
  @ApiProperty({ enum: ['created', 'accepted', 'revoked', 'renounced', 'acted'] }) action!: string;
  @ApiProperty({ enum: ['principal', 'agent'] }) actorRole!: string;
  @ApiProperty({ format: 'date-time' }) at!: string;
}

class ActingDto {
  @ApiProperty({ format: 'uuid' }) mandateId!: string;
  @ApiProperty({ type: [String], example: ['cases:read'] }) scopes!: string[];
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

function toDto(m: MandateRow, me: string): MandateDto {
  return {
    id: m.id,
    role: m.principal_id === me ? 'principal' : 'agent',
    status: effectiveStatus(m.status, m.expires_at),
    scopes: m.scopes,
    validFrom: m.valid_from.toISOString(),
    expiresAt: m.expires_at.toISOString(),
    createdAt: m.created_at.toISOString(),
    acceptedAt: m.accepted_at?.toISOString(),
    revokedAt: m.revoked_at?.toISOString(),
  };
}

/**
 * Mandates (P3-F5, P3-API5): a principal lets an agent act on their behalf within scopes until an expiry.
 * The agent is never chosen from a directory: the principal hands over a one-time invitation code.
 * Each action is recorded and visible to both parties (P3-AC3).
 */
@ApiTags('mandates')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid access token' })
@UseGuards(IdentityGuard)
@Controller('v1/mandates')
export class MandatesController {
  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository) {}

  @Post()
  @ApiOperation({ operationId: 'createMandate', summary: 'Propose a mandate; returns a one-time invitation code for the agent' })
  @ApiBody({ type: CreateMandate })
  @ApiCreatedResponse({ type: CreatedMandateDto })
  async create(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<CreatedMandateDto> {
    const b = (body ?? {}) as Record<string, unknown>;
    const errors = mandateProblems({ scopes: b.scopes, validFrom: b.validFrom, expiresAt: b.expiresAt });
    if (errors.length) throw new BadRequestException({ errors });
    const code = newInvitationCode();
    const me = req.identity!.personId;
    const m = await this.repo.createMandate(
      me,
      { scopes: b.scopes as string[], validFrom: b.validFrom ? new Date(String(b.validFrom)) : new Date(), expiresAt: new Date(String(b.expiresAt)) },
      code,
    );
    return { ...toDto(m, me), invitationCode: code };
  }

  @Get()
  @ApiOperation({ operationId: 'listMandates', summary: 'Mandates where you are the principal or the agent' })
  @ApiOkResponse({ type: [MandateDto] })
  async list(@Req() req: IdentifiedRequest): Promise<MandateDto[]> {
    const me = req.identity!.personId;
    return (await this.repo.listMandates(me)).map((m) => toDto(m, me));
  }

  @Post(':id\\:accept')
  @HttpCode(200)
  @ApiOperation({ operationId: 'acceptMandate', summary: 'Accept a mandate as the agent, with its invitation code' })
  @ApiBody({ type: AcceptMandate })
  @ApiOkResponse({ type: MandateDto })
  @ApiNotFoundResponse({ description: 'No such open mandate, or the code does not match (deliberately not distinguished)' })
  async accept(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<MandateDto> {
    const code = (body as { invitationCode?: unknown } | undefined)?.invitationCode;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new BadRequestException({ errors: ['invitationCode: the 43-character code from the principal is required'] });
    const me = req.identity!.personId;
    if (!(await this.repo.acceptMandate(me, id, code))) throw new NotFoundException();
    return toDto((await this.repo.getMandate(me, id))!, me);
  }

  @Post(':id\\:revoke')
  @HttpCode(200)
  @ApiOperation({ operationId: 'revokeMandate', summary: 'End a mandate: the principal revokes it, the agent renounces it' })
  @ApiOkResponse({ type: MandateDto })
  @ApiNotFoundResponse({ description: 'No such open mandate where you are a party' })
  async revoke(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<MandateDto> {
    const me = req.identity!.personId;
    if (!(await this.repo.revokeMandate(me, id))) throw new NotFoundException();
    return toDto((await this.repo.getMandate(me, id))!, me);
  }

  @Post(':id\\:act')
  @HttpCode(200)
  @ApiOperation({ operationId: 'actUnderMandate', summary: 'Start acting on behalf of the principal (P3-F6); recorded and visible to both parties' })
  @ApiOkResponse({ type: ActingDto })
  @ApiNotFoundResponse({ description: 'No active, unexpired mandate where you are the agent' })
  async act(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<ActingDto> {
    const r = await this.repo.actUnderMandate(req.identity!.personId, id);
    if (!r) throw new NotFoundException();
    return { mandateId: id, scopes: r.scopes, expiresAt: r.expiresAt.toISOString() };
  }

  @Get(':id/events')
  @ApiOperation({ operationId: 'listMandateEvents', summary: 'Every action taken on a mandate, for its principal and agent (P3-AC3)' })
  @ApiOkResponse({ type: [MandateEventDto] })
  @ApiNotFoundResponse({ description: 'No such mandate where you are a party' })
  async events(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<MandateEventDto[]> {
    const me = req.identity!.personId;
    if (!(await this.repo.getMandate(me, id))) throw new NotFoundException();
    return (await this.repo.mandateEvents(me, id)).map((e) => ({ action: e.action, actorRole: e.actorRole, at: e.at.toISOString() }));
  }
}
