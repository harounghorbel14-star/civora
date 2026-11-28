import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CIVORA_CLAIMS_CONTEXT } from '@civora/credentials';
import type { Response } from 'express';

/**
 * The JSON-LD context that gives the wallet's claim names their meaning in the W3C VC Data Model 2.0 view (P4-A3;
 * doc phase-4/08). Static and public: the same document in every cell, cacheable, readable from any origin.
 */
@ApiTags('wallet')
@Controller('v1/contexts')
export class ContextsController {
  private readonly body = JSON.stringify(CIVORA_CLAIMS_CONTEXT, null, 2);

  @Get('civora-claims-v1.jsonld')
  @ApiOperation({ summary: 'JSON-LD context of the CIVORA credential claims (schema.org terms), for the W3C VC Data Model 2.0 view' })
  context(@Res() res: Response): void {
    res.setHeader('Content-Type', 'application/ld+json');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).end(this.body);
  }
}
