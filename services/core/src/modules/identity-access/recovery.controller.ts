import { BadRequestException, Body, Controller, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req,
  ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiCreatedResponse, ApiNotFoundResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse,
  ApiTags, ApiTooManyRequestsResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { type AccountRecovery, RecoveryBusy, RecoveryNotFound, RecoveryRejected, RecoveryUnavailable } from './account-recovery';
import { ACCOUNT_RECOVERY } from './tokens';

class StartRecovery {
  @ApiPropertyOptional({ example: 'fr-TN', description: 'Language of the eID pages' }) locale?: string;
}
class RecoveryAttemptDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['pending'] }) status!: string;
  @ApiProperty({ description: 'Send the browser here: a fresh authentication at the (simulated) national eID' }) authorizationUrl!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
class CompleteRecovery {
  @ApiProperty({ description: 'The code the eID returned to the app callback' }) code!: string;
  @ApiProperty({ description: 'The state the eID returned to the app callback' }) state!: string;
}
class RecoveryAcceptedDto {
  @ApiProperty({ enum: ['accepted'], description: 'The same answer whether or not the identity has an account' }) status!: string;
}

/**
 * Account recovery for citizens who lost every way to sign in (P3-SEC4; doc phase-3/12). Public: no token (the person
 * cannot sign in). Re-proofing at the national eID; the same answer whatever the identity's account situation.
 */
@ApiTags('identity')
@Controller('v1/recovery')
export class RecoveryController {
  constructor(@Inject(ACCOUNT_RECOVERY) private readonly recovery: AccountRecovery | null) {}

  @Post()
  @ApiOperation({ operationId: 'startRecovery', summary: 'Start recovering an account by proving your identity again at the national eID (no sign-in)' })
  @ApiBody({ type: StartRecovery, required: false })
  @ApiCreatedResponse({ type: RecoveryAttemptDto })
  @ApiTooManyRequestsResponse({ description: 'Too many recovery attempts at the moment' })
  @ApiServiceUnavailableResponse({ description: 'Recovery is not configured in this cell' })
  async start(@Body() body: unknown): Promise<RecoveryAttemptDto> {
    const locale = (body as { locale?: unknown } | undefined)?.locale;
    if (locale !== undefined && (typeof locale !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale))) {
      throw new BadRequestException({ errors: ['locale: a locale such as ar-TN, fr-TN or en'] });
    }
    try {
      return { status: 'pending', ...(await this.service().start(locale as string | undefined)) };
    } catch (e) {
      if (e instanceof RecoveryBusy) throw new HttpException('Too many recovery attempts at the moment; try again later', HttpStatus.TOO_MANY_REQUESTS);
      throw e;
    }
  }

  @Post(':id\\:complete')
  @HttpCode(202)
  @ApiOperation({ operationId: 'completeRecovery', summary: 'Complete with the code and state the eID returned; if the identity has an account, a link is e-mailed to it' })
  @ApiBody({ type: CompleteRecovery })
  @ApiAcceptedResponse({ type: RecoveryAcceptedDto })
  @ApiNotFoundResponse({ description: 'No such open attempt, or the state does not match, or it expired or was used (not distinguished)' })
  @ApiUnprocessableEntityResponse({ description: 'The eID did not confirm an identity' })
  async complete(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<RecoveryAcceptedDto> {
    const b = (body ?? {}) as { code?: unknown; state?: unknown };
    if (typeof b.code !== 'string' || !/^[A-Za-z0-9._~+/=-]{1,2048}$/.test(b.code) || typeof b.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.state)) {
      throw new BadRequestException({ errors: ['code and state: as returned by the eID to the app callback'] });
    }
    try {
      await this.service().complete(id, b.code, b.state, String(req.headers['x-request-id'] ?? ''));
    } catch (e) {
      if (e instanceof RecoveryNotFound) throw new NotFoundException();
      if (e instanceof RecoveryRejected) throw new UnprocessableEntityException('The national eID did not confirm an identity; start again');
      if (e instanceof RecoveryUnavailable) throw new ServiceUnavailableException('The national eID is unavailable; start again later');
      throw e;
    }
    return { status: 'accepted' };
  }

  private service(): AccountRecovery {
    if (!this.recovery) throw new ServiceUnavailableException('Account recovery is not configured in this cell');
    return this.recovery;
  }
}
