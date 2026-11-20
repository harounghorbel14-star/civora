import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { FlagClient } from '@civora/feature-flags';
import type { LoadedPack } from '@civora/country-packs';
import { describeLocale, negotiateLocale } from '@civora/i18n';
import { COUNTRY_PACK } from '../country-config/country-config.module';
import { FLAGS } from '../flags/flags.module';

class LocaleDto {
  @ApiProperty({ example: 'ar-TN' }) code!: string;
  @ApiProperty({ example: 'ar' }) language!: string;
  @ApiProperty({ example: 'TN', nullable: true, type: String }) region!: string | null;
  @ApiProperty({ enum: ['ltr', 'rtl'] }) dir!: 'ltr' | 'rtl';
  @ApiProperty({ example: 'Arabic' }) nameEn!: string;
  @ApiProperty({ example: 'العربية' }) nativeName!: string;
  @ApiProperty({ example: 'latn', description: 'Unicode numbering system; Tunisia uses Western Arabic digits' }) numberingSystem!: string;
}
export class LocalesResponse {
  @ApiProperty({ example: 'ar-TN' }) default!: string;
  @ApiProperty({ example: 'fr-TN' }) fallback!: string;
  @ApiProperty({ example: 'ar-TN', description: 'Locale negotiated from Accept-Language' }) negotiated!: string;
  @ApiProperty({ type: [LocaleDto] }) locales!: LocaleDto[];
}

@ApiTags('meta')
@Controller('v1/meta')
export class MetaController {
  constructor(@Inject(COUNTRY_PACK) private readonly pack: LoadedPack, @Inject(FLAGS) private readonly flags: FlagClient) {}

  @Get('locales')
  @ApiOperation({ summary: 'Supported locales and text direction (O-API2)', description: 'Driven by the country pack; negotiates `Accept-Language` (RFC 9110) and returns `Content-Language`.' })
  @ApiHeader({ name: 'Accept-Language', required: false, example: 'ar-TN, fr;q=0.8' })
  @ApiOkResponse({ type: LocalesResponse })
  async locales(@Headers('accept-language') acceptLanguage: string | undefined, @Res({ passthrough: true }) res: Response): Promise<LocalesResponse> {
    const { locales } = this.pack.pack;
    const english = await this.flags.getBooleanValue('meta.locales.english', true);
    const supported = locales.supported.filter((l) => english || !l.toLowerCase().startsWith('en'));
    const negotiated = negotiateLocale(acceptLanguage, supported, locales.default);
    res.setHeader('Content-Language', negotiated);
    res.setHeader('Vary', 'Accept-Language');
    return { default: locales.default, fallback: locales.fallback, negotiated, locales: supported.map((c) => describeLocale(c, locales.numberingSystem)) };
  }
}
