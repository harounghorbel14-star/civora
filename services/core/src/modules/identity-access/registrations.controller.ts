import { BadRequestException, Body, Controller, HttpCode, Inject, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiBody, ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { LoadedPack } from '@civora/country-packs';
import { COUNTRY_PACK } from '../../country-config/country-config.module';
import { keycloakLocale, packLocale } from './locale';
import { normaliseEmail, type RegistrationService } from './registration.service';
import { REGISTRATION_SERVICE } from './tokens';

class RegistrationRequest {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'citizen.synthetic@example.invalid' }) email!: string;
  @ApiPropertyOptional({ example: 'ar-TN', description: 'Language of the activation e-mail and pages; one of the country pack locales' }) locale?: string;
}
class RegistrationAccepted {
  @ApiProperty({ enum: ['accepted'] }) status!: 'accepted';
}

/**
 * Citizen self-registration (P3-A1) without account enumeration: one answer for every well-formed address, sent
 * before anything is looked up. Keycloak's own registration page is off (it says "Email already exists").
 */
@ApiTags('identity')
@Controller('v1/registrations')
export class RegistrationsController {
  constructor(
    @Inject(REGISTRATION_SERVICE) private readonly service: RegistrationService | null,
    @Inject(COUNTRY_PACK) private readonly pack: LoadedPack,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    operationId: 'register',
    summary: 'Ask for a citizen account; an activation link is e-mailed if the address can be used',
    description: 'The answer is the same whether the address is new, pending or already registered. Rate limited per address and per client.',
  })
  @ApiBody({ type: RegistrationRequest })
  @ApiAcceptedResponse({ type: RegistrationAccepted })
  @ApiBadRequestResponse({ description: 'Not a well-formed e-mail address, or an unsupported locale' })
  @ApiServiceUnavailableResponse({ description: 'Registration is not configured in this cell' })
  register(@Body() body: unknown): RegistrationAccepted {
    if (!this.service) throw new ServiceUnavailableException('Registration is not configured in this cell');
    const b = (body ?? {}) as Record<string, unknown>;
    const errors: string[] = [];
    const email = normaliseEmail(b.email);
    if (!email) errors.push('email: a well-formed e-mail address is required');
    const supported = this.pack.pack.locales.supported;
    if (b.locale !== undefined && (typeof b.locale !== 'string' || !supported.includes(b.locale))) errors.push(`locale: must be one of ${supported.join(', ')}`);
    for (const k of Object.keys(b)) if (!['email', 'locale'].includes(k)) errors.push('body: only email and locale are accepted');
    if (errors.length) throw new BadRequestException({ errors: [...new Set(errors)] });
    const locale = packLocale(b.locale as string | undefined, supported, this.pack.pack.locales.default);
    void this.service.submit(email!, keycloakLocale(locale));
    return { status: 'accepted' };
  }
}
