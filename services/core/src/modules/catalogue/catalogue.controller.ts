import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param, Post, Put, Query, Req,
  ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IdentityGuard, type IdentifiedRequest } from '../identity-access/public-api';
import { CatalogueError } from './catalogue.repository';
import type { Catalogue, Editor } from './catalogue.service';
import { CATALOGUE } from './tokens';

class ContentErrorDto {
  @ApiProperty({ example: 'TN-CIV-001' }) service_code!: string;
  @ApiProperty({ example: 2 }) version!: number;
  @ApiProperty({ example: 'The fee changed with the decree of …', description: '5 to 2000 characters. No name or contact is asked for or kept' }) message!: string;
}
class NewServiceDto {
  @ApiProperty({ example: 'TN-CIV-001' }) code!: string;
  @ApiProperty({ example: 'birth-certificate-extract' }) slug!: string;
  @ApiProperty({ example: 'civil-status' }) category!: string;
  @ApiProperty({ description: 'The first draft: title, summary, institution, change_note, last_verified_on, requirements[{kind, position, text, amount_tnd?, source_ids}], office_ids' }) draft!: Record<string, unknown>;
}

function rethrow(e: unknown): never {
  if (e instanceof CatalogueError) {
    if (e.kind === 'not-found') throw new NotFoundException(e.message);
    if (e.kind === 'forbidden') throw new ForbiddenException(e.message);
    if (e.kind === 'conflict') throw new HttpException(e.message, HttpStatus.CONFLICT);
    if (e.kind === 'too-many') throw new HttpException(e.message, HttpStatus.TOO_MANY_REQUESTS);
    throw new BadRequestException(e.message);
  }
  throw e;
}

const editor = (req: IdentifiedRequest): Editor => {
  const id = req.identity!;
  if (id.realm !== 'staff') throw new ForbiddenException('editing the catalogue is for staff');
  return { personId: id.personId, tenantId: id.tenantId, roles: id.roles };
};

/** P5-API1, P5-API2: published content, public. */
@ApiTags('catalogue')
@Controller()
export class CatalogueController {
  constructor(@Inject(CATALOGUE) private readonly catalogue: Catalogue | null) {}

  private c(): Catalogue {
    if (!this.catalogue) throw new ServiceUnavailableException('The services directory is not available in this cell');
    return this.catalogue;
  }

  @Get('v1/services')
  @ApiOperation({ summary: 'Published services, by category, or searched (Arabic and French normalised)' })
  async list(@Query('category') category?: string, @Query('q') q?: string): Promise<unknown> {
    // A repeated query key arrives as an array: only a single string is accepted.
    if ((q !== undefined && typeof q !== 'string') || (category !== undefined && typeof category !== 'string')) throw new BadRequestException('q and category are single values');
    try {
      if (q !== undefined) {
        if (q.length < 2 || q.length > 200) throw new BadRequestException('q: 2 to 200 characters');
        return await this.c().searchView(q);
      }
      return (await this.c().list(category)).map((s) => ({ code: s.code, slug: s.slug, category: s.category, version: s.version, title: s.title, summary: s.summary,
        institution: s.institution, last_verified_on: s.lastVerifiedOn }));
    } catch (e) { rethrow(e); }
  }

  @Get('v1/services/:code')
  @ApiOperation({ summary: 'A service page: steps, documents, conditions, fees, offices, sources, last verified, signature' })
  async get(@Param('code') code: string): Promise<unknown> {
    try {
      const p = await this.c().page(code);
      if (!p) throw new NotFoundException('no such published service');
      return p;
    } catch (e) { rethrow(e); }
  }

  @Get('v1/services/:code/versions')
  @ApiOperation({ summary: 'Change history of a service (published and superseded versions)' })
  async history(@Param('code') code: string): Promise<unknown> {
    try { return await this.c().history(code); } catch (e) { rethrow(e); }
  }

  @Get('v1/services/:code/versions/:v')
  @ApiOperation({ summary: 'A published or superseded version of a service' })
  async version(@Param('code') code: string, @Param('v') v: string): Promise<unknown> {
    if (!/^[0-9]{1,4}$/.test(v)) throw new NotFoundException();
    try {
      const p = await this.c().page(code, Number(v));
      if (!p) throw new NotFoundException('no such published version');
      return p;
    } catch (e) { rethrow(e); }
  }

  @Get('v1/services/:code/versions/:v/content')
  @ApiOperation({ summary: 'The exact signed content of a version and its detached signature (integrity check)' })
  async content(@Param('code') code: string, @Param('v') v: string): Promise<unknown> {
    if (!/^[0-9]{1,4}$/.test(v)) throw new NotFoundException();
    try {
      const c = await this.c().signedContent(code, Number(v));
      if (!c) throw new NotFoundException('no such published version');
      return { content: c.canonical, signature: c.signature, keys: '/v1/catalogue/keys' };
    } catch (e) { rethrow(e); }
  }

  @Get('v1/offices')
  @ApiOperation({ summary: 'Offices (office locator), optionally by governorate' })
  async offices(@Query('governorate') governorate?: string): Promise<unknown> {
    if (governorate !== undefined && (typeof governorate !== 'string' || governorate.length > 60)) throw new BadRequestException('governorate is a single value');
    try { return await this.c().offices(governorate); } catch (e) { rethrow(e); }
  }

  @Get('v1/catalogue/keys')
  @ApiOperation({ summary: 'The public keys that sign catalogue content (integrity checks)' })
  async keys(): Promise<unknown> {
    try { return await this.c().keys(); } catch (e) { rethrow(e); }
  }

  @Post('v1/feedback/content-errors')
  @HttpCode(201)
  @ApiOperation({ summary: 'Report an error on a service page (no personal data)' })
  @ApiBody({ type: ContentErrorDto })
  async report(@Body() body: ContentErrorDto): Promise<unknown> {
    if (typeof body?.service_code !== 'string' || !Number.isInteger(body.version) || typeof body.message !== 'string') throw new BadRequestException('service_code, version and message are required');
    try { return { id: await this.c().reportError(body.service_code, body.version, body.message) }; } catch (e) { rethrow(e); }
  }
}

class SourceDto {
  @ApiProperty({ enum: ['legal-text', 'official-page'] }) kind!: string;
  @ApiProperty() title!: string;
  @ApiProperty() publisher!: string;
  @ApiProperty({ example: 'https://…' }) url!: string;
  @ApiProperty({ required: false, description: 'Official journal (JORT) reference; required for legal texts' }) jort_reference?: string;
  @ApiProperty({ enum: ['ar', 'fr', 'en'] }) language!: string;
  @ApiProperty({ format: 'date' }) accessed_on!: string;
}

/** Editors register the sources they cite. */
@ApiTags('catalogue')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('v1/admin/sources')
export class CatalogueSourcesController {
  constructor(@Inject(CATALOGUE) private readonly catalogue: Catalogue | null) {}

  @Post()
  @ApiOperation({ summary: 'Register a source (editor): an official page or a legal text with its JORT reference' })
  @ApiBody({ type: SourceDto })
  async add(@Req() req: IdentifiedRequest, @Body() b: SourceDto): Promise<unknown> {
    if (!this.catalogue) throw new ServiceUnavailableException('The services directory is not available in this cell');
    try {
      return { id: await this.catalogue.addSource(editor(req), { kind: b?.kind, title: b?.title, publisher: b?.publisher, url: b?.url, jortReference: b?.jort_reference ?? null, language: b?.language, accessedOn: b?.accessed_on }) };
    } catch (e) { rethrow(e); }
  }
}

/** P5-API3: the editorial back office (staff with the catalogue roles; four-eyes approval). */
@ApiTags('catalogue')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('v1/admin/services')
export class CatalogueAdminController {
  constructor(@Inject(CATALOGUE) private readonly catalogue: Catalogue | null) {}

  private c(): Catalogue {
    if (!this.catalogue) throw new ServiceUnavailableException('The services directory is not available in this cell');
    return this.catalogue;
  }

  @Post()
  @ApiOperation({ summary: 'Create a service with its first draft (editor)' })
  @ApiBody({ type: NewServiceDto })
  async create(@Req() req: IdentifiedRequest, @Body() body: NewServiceDto): Promise<unknown> {
    try { return { id: await this.c().create(editor(req), body?.code, body?.slug, body?.category, body?.draft) }; } catch (e) { rethrow(e); }
  }

  @Put(':id/versions/:v')
  @ApiOperation({ summary: 'Write a draft version (editor): the next version, or an existing draft' })
  async put(@Req() req: IdentifiedRequest, @Param('id') id: string, @Param('v') v: string, @Body() draft: Record<string, unknown>): Promise<unknown> {
    if (!/^[0-9]{1,4}$/.test(v)) throw new NotFoundException();
    try { return { version: await this.c().putDraft(editor(req), id, Number(v), draft) }; } catch (e) { rethrow(e); }
  }

  /** `…/versions/{v}:submit`, `:approve`, `:request-changes`, `:publish` (Google API style custom methods, as in the spec). */
  @Post(':id/versions/:action')
  @HttpCode(200)
  @ApiOperation({ summary: 'Workflow: {v}:submit (editor), {v}:approve (approver, not the author; signs), {v}:request-changes, {v}:publish' })
  async act(@Req() req: IdentifiedRequest, @Param('id') id: string, @Param('action') action: string, @Body() body: { comment?: string }): Promise<unknown> {
    const m = /^([0-9]{1,4}):(submit|approve|request-changes|publish)$/.exec(action);
    if (!m) throw new NotFoundException();
    const v = Number(m[1]);
    const e = editor(req);
    try {
      switch (m[2]) {
        case 'submit': await this.c().submit(e, id, v); return { state: 'in-review' };
        case 'approve': return { state: 'approved', ...(await this.c().approve(e, id, v)) };
        case 'request-changes':
          if (typeof body?.comment !== 'string' || body.comment.length < 3) throw new BadRequestException('a comment is required');
          await this.c().requestChanges(e, id, v, body.comment); return { state: 'draft' };
        default: await this.c().publish(e, id, v); return { state: 'published' };
      }
    } catch (err) { rethrow(err); }
  }
}
