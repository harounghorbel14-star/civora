import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req,
  ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty,
  ApiPropertyOptional, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { type AccountSecurity, ENROL_ACTION } from './account-security';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import { RequireStepUp } from './step-up.guard';
import { ACCOUNT_SECURITY } from './tokens';

const SESSION_ID = /^[A-Za-z0-9_-]{8,128}$/;

class SessionDto {
  @ApiProperty({ description: 'Session id (opaque)', example: '-JoesOrzuMGBIpK-ezgyu2Nk' }) id!: string;
  @ApiProperty({ description: 'The session this access token belongs to' }) current!: boolean;
  @ApiProperty({ format: 'date-time' }) startedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastAccessAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Address the session was last used from (shown only to its owner)' }) ipAddress!: string | null;
  @ApiProperty({ type: [String], example: ['civora-web'] }) applications!: string[];
}
class AuthenticatorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['passkey', 'security-key', 'totp'] }) kind!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) label!: string | null;
  @ApiPropertyOptional({ format: 'date-time', type: String, nullable: true }) createdAt!: string | null;
}
class EnrolRequest {
  @ApiProperty({ enum: ['passkey', 'totp', 'security-key'], description: 'Citizens: passkey or totp. Staff: security-key' }) kind!: string;
}
class EnrolResponse {
  @ApiProperty({ enum: ['passkey', 'totp', 'security-key'] }) kind!: string;
  @ApiProperty({ example: 'webauthn-register-passwordless', description: 'Add kc_action=<this> to the authorization request; the ceremony happens at the identity provider' })
  keycloakAction!: string;
}

function service(s: AccountSecurity | null, realm: 'citizens' | 'staff'): AccountSecurity {
  if (!s || !s.configured(realm)) throw new ServiceUnavailableException('Account management is not configured in this cell');
  return s;
}

/** The signed-in person's sessions (P3-API3). Ending a session needs no step-up: it only ever protects the person. */
@ApiTags('identity')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid access token' })
@UseGuards(IdentityGuard)
@Controller('v1/me/sessions')
export class SessionsController {
  constructor(@Inject(ACCOUNT_SECURITY) private readonly security: AccountSecurity | null) {}

  @Get()
  @ApiOperation({ operationId: 'listMySessions', summary: 'Your signed-in sessions, the current one marked' })
  @ApiOkResponse({ type: [SessionDto] })
  list(@Req() req: IdentifiedRequest): Promise<SessionDto[]> {
    return service(this.security, req.identity!.realm).listSessions(req.identity!);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'endMySession', summary: 'Sign out one of your sessions (its refresh token stops working at once; access tokens expire within 5 minutes)' })
  @ApiNoContentResponse({ description: 'Ended' })
  @ApiNotFoundResponse({ description: 'No such session of yours' })
  async remove(@Req() req: IdentifiedRequest, @Param('id') id: string): Promise<void> {
    // Keycloak 26 session ids are base64url strings, not UUIDs.
    if (!SESSION_ID.test(id)) throw new BadRequestException({ errors: ['id: not a session id'] });
    if ((await service(this.security, req.identity!.realm).removeSession(req.identity!, id)) === 'not-found') throw new NotFoundException();
  }
}

/** The signed-in person's authenticators (P3-API4, P3-F2 device management); changes need a recent sign-in (P3-A4). */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('v1/me/authenticators')
export class AuthenticatorsController {
  constructor(@Inject(ACCOUNT_SECURITY) private readonly security: AccountSecurity | null) {}

  @Get()
  @UseGuards(IdentityGuard)
  @ApiUnauthorizedResponse({ description: 'No valid access token' })
  @ApiOperation({ operationId: 'listMyAuthenticators', summary: 'Your passkeys, security keys and authenticator apps (never the password)' })
  @ApiOkResponse({ type: [AuthenticatorDto] })
  list(@Req() req: IdentifiedRequest): Promise<AuthenticatorDto[]> {
    return service(this.security, req.identity!.realm).listAuthenticators(req.identity!.personId, req.identity!);
  }

  @Post()
  @RequireStepUp()
  @ApiOperation({ operationId: 'startAuthenticatorEnrolment', summary: 'Start adding an authenticator: returns the identity-provider action the app runs' })
  @ApiBody({ type: EnrolRequest })
  @ApiCreatedResponse({ type: EnrolResponse })
  enrol(@Req() req: IdentifiedRequest, @Body() body: unknown): EnrolResponse {
    service(this.security, req.identity!.realm);
    const kind = (body as { kind?: unknown } | undefined)?.kind;
    const action = typeof kind === 'string' ? ENROL_ACTION[req.identity!.realm][kind as keyof (typeof ENROL_ACTION)['citizens']] : undefined;
    if (!action) throw new BadRequestException({ errors: [`kind: must be one of ${Object.keys(ENROL_ACTION[req.identity!.realm]).join(', ')}`] });
    return { kind: kind as string, keycloakAction: action };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireStepUp()
  @ApiOperation({ operationId: 'removeMyAuthenticator', summary: 'Remove one of your authenticators; refused if you could no longer sign in' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiNotFoundResponse({ description: 'No such authenticator of yours' })
  @ApiConflictResponse({ description: 'It is your last way to sign in (add another first)' })
  async remove(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    const r = await service(this.security, req.identity!.realm).removeAuthenticator(req.identity!.personId, req.identity!, id);
    if (r === 'not-found') throw new NotFoundException();
    if (r === 'last-way-to-sign-in') throw new ConflictException('This is your last way to sign in: add another authenticator first');
  }
}
