import { BadRequestException, Body, Controller, HttpCode, Inject, NotFoundException, Param, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiBody, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { StatusAccess } from './status-access';
import { STATUS_ACCESS } from './tokens';

class StartRequest {
  @ApiProperty({ example: 'SYN-RC-1-00001', description: 'Case reference (letters, digits, dashes)' }) reference!: string;
  @ApiPropertyOptional({ example: 'fr-TN', description: 'Language of the message with the code' }) locale?: string;
}
class Challenge {
  @ApiProperty({ format: 'uuid' }) challengeId!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
class VerifyRequest {
  @ApiProperty({ example: 'SYN-RC-1-00001' }) reference!: string;
  @ApiProperty({ example: '123456', description: 'The 6-digit code sent to the contact on file' }) code!: string;
}
class PublicStatusDto {
  @ApiProperty() reference!: string;
  @ApiProperty() institution!: string;
  @ApiProperty({ enum: ['received', 'in-analysis', 'information-requested', 'decided'] }) status!: string;
  @ApiProperty({ format: 'date' }) since!: string;
}

/**
 * Customer status page (P3-R2): public, no account. The first answer is identical for every well-formed reference;
 * the code goes to the contact on file only (at most 3 per reference in 15 minutes); a code works once, for 10 minutes,
 * with 5 tries. The gateway bounds requests per client address.
 */
@ApiTags('status')
@Controller('v1/status-access')
export class StatusAccessController {
  constructor(@Inject(STATUS_ACCESS) private readonly access: StatusAccess | null) {}

  private service(): StatusAccess {
    if (!this.access) throw new ServiceUnavailableException('The status page is not available in this cell');
    return this.access;
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({ operationId: 'startStatusAccess', summary: 'Ask for a one-time code for a case (sent to the contact on file, if the case exists)' })
  @ApiBody({ type: StartRequest })
  @ApiAcceptedResponse({ type: Challenge, description: 'Always the same answer for a well-formed reference' })
  @ApiBadRequestResponse({ description: 'Malformed reference (format only)' })
  async start(@Req() req: Request, @Body() body: unknown): Promise<Challenge> {
    const b = (body ?? {}) as { reference?: unknown; locale?: unknown };
    const r = await this.service().start(b.reference, b.locale, String(req.headers['x-request-id'] ?? randomUUID()));
    if (!r) throw new BadRequestException({ errors: ['reference: 6 to 40 letters, digits or dashes'] });
    return r;
  }

  @Post(':id\\:verify')
  @HttpCode(200)
  @ApiOperation({ operationId: 'verifyStatusAccess', summary: 'Show the case status with the one-time code' })
  @ApiBody({ type: VerifyRequest })
  @ApiOkResponse({ type: PublicStatusDto })
  @ApiNotFoundResponse({ description: 'Wrong, expired, used or exhausted code, or no such case (deliberately not distinguished)' })
  async verify(@Param('id') id: string, @Body() body: unknown): Promise<PublicStatusDto> {
    const b = (body ?? {}) as { reference?: unknown; code?: unknown };
    const s = await this.service().verify(id, b.reference, b.code);
    if (!s) throw new NotFoundException();
    return s;
  }
}
