import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param,
  ParseUUIDPipe, Post, Req, ServiceUnavailableException, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { ChangeNotFound, type ContactDetails, ContactInUse, type ContactRecovery, ContactUnavailable, InvalidContact, NotDeliverable, RecoveryLinkNotFound,
  SameContact, TooManyChanges, WrongCode } from './contact-details';
import { IdentityGuard, type IdentifiedRequest } from './identity.guard';
import { RequireStepUp } from './step-up.guard';
import { CONTACT_DETAILS, CONTACT_RECOVERY } from './tokens';

class ContactDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: 'amina@example.invalid' }) email!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: '+21600000001', description: 'Only a verified number is shown' }) phone!: string | null;
  @ApiProperty() phoneVerified!: boolean;
}
class StartChange {
  @ApiProperty({ enum: ['email', 'phone'] }) channel!: string;
  @ApiProperty({ example: 'amina.new@example.invalid', description: 'The new address, or the number in international form (+216…)' }) value!: string;
}
class ChangeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['email', 'phone'] }) channel!: string;
  @ApiProperty({ format: 'date-time', description: 'The code sent to the new address or number works until then' }) expiresAt!: string;
}
class ConfirmChange {
  @ApiProperty({ example: '123456', description: 'The six-digit code sent to the new address or number' }) code!: string;
}
class ConfirmedDto {
  @ApiProperty({ enum: ['email', 'phone'] }) channel!: string;
  @ApiProperty() value!: string;
}
class WrongCodeDto {
  @ApiProperty({ example: 'wrong-code' }) error!: string;
  @ApiProperty({ example: 4 }) attemptsLeft!: number;
}

const correlation = (req: Request): string => String(req.headers['x-request-id'] ?? '').slice(0, 128);

function wrongCode(e: WrongCode): never {
  throw new UnprocessableEntityException({ error: 'wrong-code', attemptsLeft: Math.max(0, e.attemptsLeft), message: 'The code is not right' });
}

/**
 * The signed-in person's e-mail address and phone number (doc phase-3/16). Changes need a recent sign-in, then the
 * code sent to the new address or number (ASVS 5.0 V6.3.7: the old address is told).
 */
@ApiTags('identity')
@ApiBearerAuth()
@Controller('v1/me')
export class ContactDetailsController {
  constructor(@Inject(CONTACT_DETAILS) private readonly contacts: ContactDetails | null) {}

  private service(req: IdentifiedRequest): ContactDetails {
    if (!this.contacts || !this.contacts.configured(req.identity!.realm)) throw new ServiceUnavailableException('Contact details are not configured in this cell');
    return this.contacts;
  }

  @Get('contact')
  @UseGuards(IdentityGuard)
  @ApiUnauthorizedResponse({ description: 'No valid access token' })
  @ApiOperation({ operationId: 'getMyContact', summary: 'Your e-mail address and verified phone number' })
  @ApiOkResponse({ type: ContactDto })
  async contact(@Req() req: IdentifiedRequest): Promise<ContactDto> {
    try {
      return await this.service(req).view(req.identity!);
    } catch (e) {
      if (e instanceof ContactUnavailable) throw new ServiceUnavailableException('Contact details are not available');
      throw e;
    }
  }

  @Post('contact-changes')
  @RequireStepUp()
  @ApiOperation({ operationId: 'startContactChange', summary: 'Change your e-mail address or phone number: a code goes to the new one' })
  @ApiBody({ type: StartChange })
  @ApiCreatedResponse({ type: ChangeDto })
  @ApiConflictResponse({ description: 'That is already your address or number' })
  @ApiUnprocessableEntityResponse({ description: 'No message could be sent to that address or number' })
  @ApiTooManyRequestsResponse({ description: 'Five changes were started in the last 24 hours' })
  async start(@Req() req: IdentifiedRequest, @Body() body: unknown): Promise<ChangeDto> {
    const b = (body ?? {}) as { channel?: unknown; value?: unknown };
    try {
      return await this.service(req).start(req.identity!, b.channel, b.value, correlation(req));
    } catch (e) {
      if (e instanceof InvalidContact) throw new BadRequestException({ errors: ['channel: email or phone; value: an e-mail address, or a number in international form (+216…)'] });
      if (e instanceof SameContact) throw new ConflictException('That is already your address or number');
      if (e instanceof NotDeliverable) throw new UnprocessableEntityException('No message could be sent to that address or number');
      if (e instanceof TooManyChanges) throw new HttpException('Too many changes today; try again tomorrow', HttpStatus.TOO_MANY_REQUESTS);
      if (e instanceof ContactUnavailable) throw new ServiceUnavailableException('Contact details are not available');
      throw e;
    }
  }

  @Post('contact-changes/:id\\:confirm')
  @UseGuards(IdentityGuard)
  @ApiUnauthorizedResponse({ description: 'No valid access token' })
  @ApiOperation({ operationId: 'confirmContactChange', summary: 'Confirm with the code sent to the new address or number; the change is made and you are told' })
  @ApiBody({ type: ConfirmChange })
  @ApiOkResponse({ type: ConfirmedDto })
  @ApiNotFoundResponse({ description: 'No such open change of yours (expired, replaced, used, or out of tries)' })
  @ApiUnprocessableEntityResponse({ type: WrongCodeDto, description: 'Wrong code; attemptsLeft tries remain' })
  @ApiConflictResponse({ description: 'The address is used by another account' })
  async confirm(@Req() req: IdentifiedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<ConfirmedDto> {
    try {
      return await this.service(req).confirm(req.identity!, id, (body as { code?: unknown } | undefined)?.code, correlation(req));
    } catch (e) {
      if (e instanceof WrongCode) {
        if (e.attemptsLeft < 0) throw new BadRequestException({ errors: ['code: six digits'] });
        wrongCode(e);
      }
      if (e instanceof ChangeNotFound) throw new NotFoundException();
      if (e instanceof ContactInUse) throw new ConflictException('This address is used by another account');
      if (e instanceof ContactUnavailable) throw new ServiceUnavailableException('Contact details are not available');
      throw e;
    }
  }

  @Delete('phone')
  @HttpCode(204)
  @RequireStepUp()
  @ApiOperation({ operationId: 'removeMyPhone', summary: 'Remove your phone number (you are told by e-mail)' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiNotFoundResponse({ description: 'No phone number on your account' })
  async removePhone(@Req() req: IdentifiedRequest): Promise<void> {
    if ((await this.service(req).removePhone(req.identity!, correlation(req))) === 'none') throw new NotFoundException();
  }
}

class StartContactRecovery {
  @ApiProperty({ example: 'amina@example.invalid' }) email!: string;
  @ApiPropertyOptional({ example: 'fr-TN', description: 'Language of the e-mail when the account has none' }) locale?: string;
}
class LinkBody {
  @ApiProperty({ description: 'The token from the e-mailed link' }) token!: string;
}
class CodeSentDto {
  @ApiProperty({ example: '01', description: 'Last two digits of the number the code went to' }) phoneEnding!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
class CompleteContactRecovery {
  @ApiProperty({ description: 'The token from the e-mailed link' }) token!: string;
  @ApiProperty({ example: '123456', description: 'The code sent by SMS' }) code!: string;
}
class AcceptedDto {
  @ApiProperty({ enum: ['accepted'] }) status!: string;
}

/**
 * Recovery R4 for citizens (doc phase-3/16): the e-mailed link AND an SMS code to the verified number. Public: the
 * person cannot sign in. The first answer is the same whatever the account situation.
 */
@ApiTags('identity')
@Controller('v1/recovery/contact')
export class ContactRecoveryController {
  constructor(@Inject(CONTACT_RECOVERY) private readonly recovery: ContactRecovery | null) {}

  private service(): ContactRecovery {
    if (!this.recovery) throw new ServiceUnavailableException('Recovery by e-mail and phone is not configured in this cell');
    return this.recovery;
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({ operationId: 'startContactRecovery', summary: 'Recover with your e-mail and phone: if the address has an account with a verified phone, a link is e-mailed' })
  @ApiBody({ type: StartContactRecovery })
  @ApiAcceptedResponse({ type: AcceptedDto, description: 'The same answer whether or not the address has an account' })
  @ApiServiceUnavailableResponse({ description: 'Not configured in this cell' })
  start(@Req() req: Request, @Body() body: unknown): AcceptedDto {
    const b = (body ?? {}) as { email?: unknown; locale?: unknown };
    if (b.locale !== undefined && (typeof b.locale !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(b.locale))) throw new BadRequestException({ errors: ['locale: a locale such as ar-TN, fr-TN or en'] });
    if (!this.service().request(b.email, b.locale, correlation(req))) throw new BadRequestException({ errors: ['email: an e-mail address'] });
    return { status: 'accepted' };
  }

  @Post(':id\\:send-code')
  @ApiOperation({ operationId: 'sendContactRecoveryCode', summary: 'With the token from the e-mailed link: an SMS code goes to the verified number (3 at most)' })
  @ApiBody({ type: LinkBody })
  @ApiCreatedResponse({ type: CodeSentDto })
  @ApiNotFoundResponse({ description: 'No such open attempt with that link (expired, used, replaced, or out of codes)' })
  async sendCode(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<CodeSentDto> {
    const token = (body as { token?: unknown } | undefined)?.token;
    try {
      return await this.service().sendCode(id, typeof token === 'string' ? token : '', correlation(req));
    } catch (e) {
      if (e instanceof RecoveryLinkNotFound) throw new NotFoundException();
      if (e instanceof NotDeliverable) throw new ServiceUnavailableException('The SMS could not be sent; try again later');
      throw e;
    }
  }

  @Post(':id\\:complete')
  @HttpCode(202)
  @ApiOperation({ operationId: 'completeContactRecovery', summary: 'With the link token and the SMS code: every way to sign in is reset and a set-up link is e-mailed' })
  @ApiBody({ type: CompleteContactRecovery })
  @ApiAcceptedResponse({ type: AcceptedDto })
  @ApiNotFoundResponse({ description: 'No such open attempt with that link and a current code, or out of tries' })
  @ApiUnprocessableEntityResponse({ type: WrongCodeDto, description: 'Wrong code; attemptsLeft tries remain' })
  async complete(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown): Promise<AcceptedDto> {
    const b = (body ?? {}) as { token?: unknown; code?: unknown };
    try {
      await this.service().complete(id, typeof b.token === 'string' ? b.token : '', b.code, correlation(req));
    } catch (e) {
      if (e instanceof WrongCode) {
        if (e.attemptsLeft < 0) throw new BadRequestException({ errors: ['code: six digits'] });
        wrongCode(e);
      }
      if (e instanceof RecoveryLinkNotFound) throw new NotFoundException();
      throw e;
    }
    return { status: 'accepted' };
  }
}
