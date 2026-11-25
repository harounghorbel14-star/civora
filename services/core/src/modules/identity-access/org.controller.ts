import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param,
  ParseUUIDPipe, Post, Put, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { LoadedPack } from '@civora/country-packs';
import { COUNTRY_PACK } from '../../country-config/country-config.module';
import type { IamRepository, StaffContext } from './iam.repository';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import type { InvitationConfig, StaffDirectory } from './keycloak-admin';
import { keycloakLocale, packLocale } from './locale';
import { normaliseEmail } from './registration.service';
import { RequireStepUp } from './step-up.guard';
import { IAM_REPOSITORY, INVITATIONS } from './tokens';

const ROLES = ['member', 'supervisor'];

/** Postgres errors raised by the iam functions → HTTP (the functions decide; the core only translates). */
function translate(e: unknown): never {
  const code = (e as { code?: string })?.code;
  if (code === '42501') throw new ForbiddenException('Not allowed for your role in this institution');
  if (code === 'P0002') throw new NotFoundException();
  if (code === '22023' || code === '23514') throw new BadRequestException({ errors: [(e as Error).message] });
  if (code === '23505') throw new ConflictException('Already exists');
  if (code === '53400') throw new HttpException((e as Error).message, HttpStatus.TOO_MANY_REQUESTS);
  throw e as Error;
}

function staffOf(req: IdentifiedRequest): StaffContext {
  const id = req.identity!;
  if (id.realm !== 'staff' || !id.tenantId) throw new ForbiddenException('Staff of an institution only');
  return { personId: id.personId, tenantId: id.tenantId, tenantAdmin: id.roles.includes('tenant-admin') };
}

class UnitDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ enum: ['branch', 'team'] }) kind!: string;
  @ApiProperty() name!: string;
}
class CreateUnit {
  @ApiProperty({ enum: ['branch', 'team'] }) kind!: string;
  @ApiProperty({ maxLength: 120 }) name!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Required for a team: its branch' }) parentId?: string;
}
class MemberDto {
  @ApiProperty({ format: 'uuid' }) personId!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
  @ApiProperty({ format: 'date-time' }) grantedAt!: string;
}
class RoleBody {
  @ApiProperty({ enum: ROLES }) role!: string;
}
class MembershipDto {
  @ApiProperty({ format: 'uuid' }) unitId!: string;
  @ApiProperty({ enum: ['branch', 'team'] }) kind!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
}
class InvitationRequest {
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ format: 'uuid' }) unitId!: string;
  @ApiProperty({ enum: ROLES }) role!: string;
  @ApiPropertyOptional({ example: 'fr-TN' }) locale?: string;
}
class InvitationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

const role = (body: unknown): string => {
  const r = (body as { role?: unknown } | undefined)?.role;
  if (typeof r !== 'string' || !ROLES.includes(r)) throw new BadRequestException({ errors: [`role: must be one of ${ROLES.join(', ')}`] });
  return r;
};

/** Branches, teams and unit roles of an institution (P3-R3). Changes: tenant administrator, recent sign-in. */
@ApiTags('organisation')
@ApiBearerAuth()
@Controller('v1/org/units')
export class OrgUnitsController {
  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository) {}

  @Get()
  @UseGuards(IdentityGuard)
  @ApiUnauthorizedResponse({ description: 'No valid access token' })
  @ApiForbiddenResponse({ description: 'Not staff of an institution' })
  @ApiOperation({ operationId: 'listUnits', summary: 'Branches and teams of your institution' })
  @ApiOkResponse({ type: [UnitDto] })
  async list(@Req() req: IdentifiedRequest): Promise<UnitDto[]> {
    return (await this.repo.listUnits(staffOf(req))).map(({ id, parentId, kind, name }) => ({ id, parentId, kind, name }));
  }

  @Post()
  @RequireStepUp()
  @ApiForbiddenResponse({ description: 'Not the tenant administrator' })
  @ApiOperation({ operationId: 'createUnit', summary: 'Create a branch, or a team inside a branch' })
  @ApiBody({ type: CreateUnit })
  @ApiCreatedResponse({ type: UnitDto })
  async create(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<UnitDto> {
    const b = (body ?? {}) as Record<string, unknown>;
    const errors: string[] = [];
    if (b.kind !== 'branch' && b.kind !== 'team') errors.push('kind: branch or team');
    if (typeof b.name !== 'string' || b.name.trim().length < 1 || b.name.length > 120) errors.push('name: 1 to 120 characters');
    if (b.parentId !== undefined && (typeof b.parentId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.parentId))) errors.push('parentId: a unit id');
    if (b.kind === 'team' && b.parentId === undefined) errors.push('parentId: a team belongs to a branch');
    if (b.kind === 'branch' && b.parentId !== undefined) errors.push('parentId: a branch has no parent');
    if (errors.length) throw new BadRequestException({ errors });
    const id = await this.repo.createUnit(staffOf(req), b.kind as string, (b.name as string).trim(), (b.parentId as string | undefined) ?? null).catch(translate);
    return { id, parentId: (b.parentId as string | undefined) ?? null, kind: b.kind as string, name: (b.name as string).trim() };
  }

  @Get(':id/members')
  @UseGuards(IdentityGuard)
  @ApiForbiddenResponse({ description: 'Neither the tenant administrator nor a supervisor of this unit or its branch' })
  @ApiNotFoundResponse({ description: 'No such unit in your institution' })
  @ApiOperation({ operationId: 'listUnitMembers', summary: 'Members of a unit (tenant administrator, or a supervisor of the unit or its branch)' })
  @ApiOkResponse({ type: [MemberDto] })
  async members(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<MemberDto[]> {
    const rows = await this.repo.unitMembers(staffOf(req), id).catch(translate);
    return rows.map((r) => ({ personId: r.personId, role: r.role, grantedAt: r.grantedAt.toISOString() }));
  }

  @Put(':id/members/:personId')
  @HttpCode(204)
  @RequireStepUp()
  @ApiForbiddenResponse({ description: 'Not the tenant administrator' })
  @ApiNotFoundResponse({ description: 'No such unit, or not a staff member of your institution' })
  @ApiOperation({ operationId: 'setUnitRole', summary: 'Give a staff member of your institution a role in a unit' })
  @ApiBody({ type: RoleBody })
  @ApiNoContentResponse({ description: 'Set' })
  async grant(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('personId', new ParseUUIDPipe()) personId: string,
    @Body() body: unknown): Promise<void> {
    await this.repo.grantMembership(staffOf(req), personId, id, role(body)).catch(translate);
  }

  @Delete(':id/members/:personId')
  @HttpCode(204)
  @RequireStepUp()
  @ApiForbiddenResponse({ description: 'Not the tenant administrator' })
  @ApiNotFoundResponse({ description: 'No such membership' })
  @ApiOperation({ operationId: 'removeUnitRole', summary: 'Remove a staff member from a unit' })
  @ApiNoContentResponse({ description: 'Removed' })
  async revoke(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Param('personId', new ParseUUIDPipe()) personId: string): Promise<void> {
    if (!(await this.repo.revokeMembership(staffOf(req), personId, id).catch(translate))) throw new NotFoundException();
  }
}

@ApiTags('organisation')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid access token' })
@UseGuards(IdentityGuard)
@Controller('v1/me/memberships')
export class MyMembershipsController {
  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository) {}

  @Get()
  @ApiForbiddenResponse({ description: 'Not staff of an institution' })
  @ApiOperation({ operationId: 'listMyMemberships', summary: 'Your roles in the branches and teams of your institution' })
  @ApiOkResponse({ type: [MembershipDto] })
  list(@Req() req: IdentifiedRequest): Promise<MembershipDto[]> {
    return this.repo.myMemberships(staffOf(req));
  }
}

export interface InvitationsDeps {
  directory: StaffDirectory;
  cfg: InvitationConfig;
}

/**
 * Staff invitations (closing R-P3-3 for staff): the account is created with no credential; the invitation link sets
 * the security key, then the password; the intended unit role becomes a membership at the first sign-in.
 */
@ApiTags('organisation')
@ApiBearerAuth()
@Controller('v1/staff/invitations')
export class InvitationsController {
  constructor(
    @Inject(IAM_REPOSITORY) private readonly repo: IamRepository,
    @Inject(INVITATIONS) private readonly deps: InvitationsDeps | null,
    @Inject(COUNTRY_PACK) private readonly pack: LoadedPack,
  ) {}

  @Post()
  @RequireStepUp()
  @ApiForbiddenResponse({ description: 'Not the tenant administrator' })
  @ApiNotFoundResponse({ description: 'No such unit in your institution' })
  @ApiConflictResponse({ description: 'This address cannot be invited (it already has a staff account)' })
  @ApiOperation({ operationId: 'inviteStaff', summary: 'Invite a staff member into a unit of your institution (invitation link by e-mail)' })
  @ApiBody({ type: InvitationRequest })
  @ApiCreatedResponse({ type: InvitationDto })
  async invite(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<InvitationDto> {
    if (!this.deps) throw new ServiceUnavailableException('Staff invitations are not configured in this cell');
    const staff = staffOf(req);
    if (!staff.tenantAdmin) throw new ForbiddenException('Not allowed for your role in this institution');
    const b = (body ?? {}) as Record<string, unknown>;
    const email = normaliseEmail(b.email);
    const supported = this.pack.pack.locales.supported;
    const errors: string[] = [];
    if (!email) errors.push('email: a well-formed e-mail address is required');
    if (typeof b.unitId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.unitId)) errors.push('unitId: a unit id');
    if (b.locale !== undefined && (typeof b.locale !== 'string' || !supported.includes(b.locale))) errors.push(`locale: one of ${supported.join(', ')}`);
    const r = typeof b.role === 'string' && ROLES.includes(b.role) ? b.role : (errors.push(`role: one of ${ROLES.join(', ')}`), '');
    if (errors.length) throw new BadRequestException({ errors });
    // Tenant administrators are trusted staff of one institution; "cannot be invited" does not say which institution.
    if (await this.deps.directory.exists(email!)) throw new ConflictException('This address cannot be invited');
    const subject = await this.deps.directory.create(email!, staff.tenantId, keycloakLocale(packLocale(b.locale as string | undefined, supported, this.pack.pack.locales.default)));
    const expiresAt = new Date(Date.now() + this.deps.cfg.lifespanSeconds * 1000);
    let id: string;
    try {
      id = await this.repo.recordInvitation(staff, subject, b.unitId as string, r, expiresAt);
      await this.deps.directory.sendInvitation(subject);
    } catch (e) {
      await this.deps.directory.remove(subject).catch(() => undefined); // no half-created account
      if (e instanceof HttpException) throw e;
      return translate(e);
    }
    return { id, expiresAt: expiresAt.toISOString() };
  }
}
