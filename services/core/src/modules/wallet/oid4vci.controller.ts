import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdentityGuard, type IdentifiedRequest } from '../identity-access/public-api';
import { type Issuance, OAuthError } from './issuance';
import { ISSUANCE } from './tokens';

class OfferRequest {
  @ApiProperty({ example: 'residence-certificate-1', description: 'credential_configuration_id from the issuer metadata' }) credential_configuration_id!: string;
}
class OfferResponse {
  @ApiProperty({ description: 'OpenID4VCI credential offer (by value). Holds the pre-authorised code; no personal data' }) credential_offer!: Record<string, unknown>;
  @ApiProperty({ example: 'openid-credential-offer://?credential_offer=…', description: 'The offer as a URI, for the QR code (P4-F1)' }) offer_uri!: string;
  @ApiProperty({ example: '493027', description: 'Transaction code to type into the wallet; shown once, never in the QR code' }) tx_code!: string;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
}

/** Sends an OAuth-style error (RFC 6749 §5.2, OpenID4VCI §8.3.1.2) or the result, never cached. */
async function respond(res: Response, work: () => Promise<unknown>, status = 200): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = await work();
    res.status(status).json(body);
  } catch (e) {
    if (!(e instanceof OAuthError)) throw e;
    if (e.status === 401) res.setHeader('WWW-Authenticate', `DPoP algs="ES256", error="${e.error}"`);
    res.status(e.status).json({ error: e.error, error_description: e.description });
  }
}

function unavailable(res: Response): void {
  res.status(503).json({ error: 'temporarily_unavailable', error_description: 'the wallet is not configured in this cell' });
}

/** Issuer metadata (OpenID4VCI 1.0 §12.2.2 and RFC 8414 §3, path-based well-known URIs). */
@ApiTags('wallet')
@Controller('.well-known')
export class WalletWellKnownController {
  constructor(@Inject(ISSUANCE) private readonly issuance: Issuance | null) {}

  @Get('openid-credential-issuer/issuers/:slug')
  @ApiOperation({ summary: 'Credential issuer metadata of a demo issuer (OpenID4VCI 1.0)' })
  async issuer(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.issuerMetadata(slug));
  }

  @Get('jwt-vc-issuer/issuers/:slug')
  @ApiOperation({ summary: 'JWT VC issuer metadata of a demo issuer (SD-JWT VC): its public signing keys' })
  async jwtVcIssuer(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.jwtVcIssuerMetadata(slug));
  }

  @Get('oauth-authorization-server/issuers/:slug')
  @ApiOperation({ summary: 'Authorization server metadata of a demo issuer (RFC 8414): token endpoint, pre-authorised code grant, DPoP' })
  async as(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.authorizationServerMetadata(slug));
  }
}

/** P4-API1: a credential offer for the signed-in person. */
@ApiTags('wallet')
@Controller('v1/issuers')
export class CredentialOffersController {
  constructor(@Inject(ISSUANCE) private readonly issuance: Issuance | null) {}

  @Post(':slug/credential-offers')
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Offer a credential of this demo issuer to the signed-in person (pre-authorised code and transaction code)' })
  @ApiBody({ type: OfferRequest })
  @ApiOkResponse({ type: OfferResponse })
  async create(@Param('slug') slug: string, @Body() body: OfferRequest, @Req() req: IdentifiedRequest, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, async () => {
      if (typeof body?.credential_configuration_id !== 'string') throw new OAuthError(400, 'invalid_request', 'credential_configuration_id is required');
      const o = await this.issuance!.createOffer(slug, body.credential_configuration_id, req.identity!.personId);
      return { credential_offer: o.credentialOffer, offer_uri: o.offerUri, tx_code: o.txCode, expires_at: o.expiresAt.toISOString() };
    }, 201);
  }
}

/** P4-API2 and the nonce endpoint. Called by the wallet app, without a user token: the code, then the DPoP key, authorise. */
@ApiTags('wallet')
@Controller('v1/oid4vci')
export class Oid4vciController {
  constructor(@Inject(ISSUANCE) private readonly issuance: Issuance | null) {}

  @Post('token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Token endpoint: pre-authorised code and transaction code for a DPoP-bound access token' })
  async token(@Body() form: Record<string, unknown>, @Headers('dpop') dpop: string | undefined, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.token(form ?? {}, dpop));
  }

  @Post('nonce')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nonce endpoint: a fresh c_nonce for the key proof (single use, 5 minutes)' })
  async nonce(@Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.nonce());
  }

  @Post('credential')
  @HttpCode(200)
  @ApiOperation({ summary: 'Credential endpoint: an SD-JWT VC bound to the key of the proof, signed in the HSM' })
  async credential(@Headers('authorization') authorization: string | undefined, @Headers('dpop') dpop: string | undefined,
    @Body() body: Record<string, unknown>, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    await respond(res, () => this.issuance!.credential(authorization, dpop, body ?? {}));
  }
}

/** P4-API6: status lists (draft-ietf-oauth-status-list), public, signed by the issuer. */
@ApiTags('wallet')
@Controller('v1/status-lists')
export class StatusListsController {
  constructor(@Inject(ISSUANCE) private readonly issuance: Issuance | null) {}

  @Get(':id')
  @ApiOperation({ summary: 'A status list token (application/statuslist+jwt)' })
  async get(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (!this.issuance) return unavailable(res);
    // Only a list number is accepted, and the number itself (not the request's text) is used from here on.
    const n = /^[0-9]{1,15}$/.test(String(id)) ? Number.parseInt(String(id), 10) : NaN;
    if (!Number.isSafeInteger(n)) {
      res.status(404).json({ error: 'not_found', error_description: 'no such status list' });
      return;
    }
    const token = await this.issuance.statusList(String(n));
    if (!token) {
      res.status(404).json({ error: 'not_found', error_description: 'no such status list' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/statuslist+jwt');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).end(token);   // end, not send: the media type is exactly application/statuslist+jwt (no charset)
  }
}
