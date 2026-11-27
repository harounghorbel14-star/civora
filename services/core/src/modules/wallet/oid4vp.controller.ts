import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IdentityGuard, type IdentifiedRequest } from '../identity-access/public-api';
import { OAuthError } from './issuance';
import { VERIFICATION, WALLET_REPOSITORY } from './tokens';
import type { StaffCaller, Verification } from './verification';
import type { WalletRepository } from './wallet.repository';

class RequestDto {
  @ApiProperty({ example: 'verifier.civora-cell.invalid', description: 'The institution\'s registered verifier' }) client_id!: string;
  @ApiProperty({ example: 'urn:civora:tn:synthetic:residence-certificate:1' }) vct!: string;
  @ApiProperty({ example: ['address/locality'], description: 'Claim paths needed (only those the verifier is registered for)' }) claims!: string[];
}
class VerifyDto {
  @ApiProperty({ format: 'uuid' }) request_id!: string;
  @ApiProperty({ description: 'The SD-JWT VC presentation (with key binding to this verifier and the request nonce) scanned from the holder\'s QR code' }) presentation!: string;
}

async function respond(res: Response, work: () => Promise<unknown>, status = 200): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.status(status).json(await work());
  } catch (e) {
    if (!(e instanceof OAuthError)) throw e;
    res.status(e.status).json({ error: e.error, error_description: e.description });
  }
}

function staff(req: IdentifiedRequest): StaffCaller {
  const id = req.identity!;
  if (id.realm !== 'staff' || !id.tenantId) throw new OAuthError(403, 'access_denied', 'verifier pages are for institution staff');
  return { personId: id.personId, tenantId: id.tenantId };
}

/**
 * OpenID4VP 1.0 verifier (P4-D3 API, P4-API4, P4-API5; doc phase-4/05). Staff routes need a staff token of the
 * institution that registered the verifier; the wallet's routes (registry, request object, direct_post) are public and
 * protected by the request's unguessable id, nonce and state, each single use.
 */
@ApiTags('wallet')
@Controller()
export class Oid4vpController {
  constructor(@Inject(VERIFICATION) private readonly v: Verification | null, @Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository | null) {}

  private off(res: Response): boolean {
    if (this.v) return false;
    res.status(503).json({ error: 'temporarily_unavailable', error_description: 'the wallet is not configured in this cell' });
    return true;
  }

  @Get('v1/oid4vp/verifiers/:clientId')
  @ApiOperation({ summary: 'The cell\'s verifier registry (Q4-3): a registered verifier\'s names, request-signing key and what it may ask for' })
  async registry(@Param('clientId') clientId: string, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    await respond(res, () => this.v!.verifierMetadata(clientId));
  }

  @Post('v1/oid4vp/requests')
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a presentation request (QR code: client_id and request_uri only)' })
  @ApiBody({ type: RequestDto })
  async create(@Req() req: IdentifiedRequest, @Body() body: RequestDto, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    await respond(res, () => {
      if (typeof body?.client_id !== 'string' || typeof body.vct !== 'string') throw new OAuthError(400, 'invalid_request', 'client_id, vct and claims are required');
      return this.v!.createRequest(staff(req), body.client_id, body.vct, body.claims);
    }, 201);
  }

  @Get('v1/oid4vp/requests/:id/object')
  @ApiOperation({ summary: 'The signed request object (typ oauth-authz-req+jwt), for the wallet' })
  async object(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const jwt = await this.v!.requestObject(id);
      res.setHeader('Content-Type', 'application/oauth-authz-req+jwt');
      res.status(200).end(jwt);
    } catch (e) {
      if (!(e instanceof OAuthError)) throw e;
      res.status(e.status).json({ error: e.error, error_description: e.description });
    }
  }

  @Get('v1/oid4vp/requests/:id')
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The outcome for the staff member who made the request: pending, expired, rejected (reason) or accepted (the claims, once)' })
  async result(@Req() req: IdentifiedRequest, @Param('id') id: string, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    await respond(res, () => this.v!.result(staff(req), id));
  }

  @Post('v1/oid4vp/responses')
  @HttpCode(200)
  @ApiOperation({ summary: 'The wallet\'s response (response_mode direct_post: vp_token and state)' })
  async response(@Body() form: Record<string, unknown>, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    await respond(res, () => this.v!.response(form ?? {}));
  }

  @Post('v1/verify')
  @HttpCode(200)
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a presentation scanned by the verifier\'s device for one of its requests (QR presentation)' })
  @ApiBody({ type: VerifyDto })
  async verify(@Req() req: IdentifiedRequest, @Body() body: VerifyDto, @Res() res: Response): Promise<void> {
    if (this.off(res)) return;
    await respond(res, () => this.v!.verify(staff(req), String(body?.request_id ?? ''), body?.presentation));
  }

  @Get('v1/oid4vp/log')
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The presentation log of the institution\'s verifiers (claim names only), for its administrators' })
  async log(@Req() req: IdentifiedRequest, @Query('limit') limit: string | undefined, @Res() res: Response): Promise<void> {
    if (this.off(res) || !this.repo) return;
    await respond(res, async () => {
      const caller = staff(req);
      if (!req.identity!.roles.includes('tenant-admin')) throw new OAuthError(403, 'access_denied', 'for the institution\'s administrators');
      return this.repo!.presentationLog(caller.tenantId!, Number(limit) || 100);
    });
  }
}
