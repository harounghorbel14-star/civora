import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Inject, NotFoundException, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IdentityGuard, type IdentifiedRequest } from '../identity-access/public-api';
import { WALLET_REPOSITORY } from './tokens';
import type { NewWalletEntry, WalletEntry, WalletRepository } from './wallet.repository';

class StatusRefDto {
  @ApiProperty({ example: 'https://wallet.civora-cell.invalid/v1/status-lists/1' }) uri!: string;
  @ApiProperty({ example: 4711 }) idx!: number;
}
class BackupDto {
  @ApiProperty({ description: 'AES-256-GCM on the device: 12-byte IV, ciphertext, 16-byte tag; base64url. The cell never has the key' }) ciphertext!: string;
  @ApiProperty({ description: 'Identifier of the backup key (base64url SHA-256, 43 characters), so the device knows which key opens it' }) key_id!: string;
}
class NewEntryDto {
  @ApiProperty({ example: 'urn:civora:tn:synthetic:residence-certificate:1' }) vct!: string;
  @ApiProperty({ example: 'https://wallet.civora-cell.invalid/issuers/demo-civil-registry' }) issuer!: string;
  @ApiProperty({ format: 'date-time' }) issued_at!: string;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
  @ApiPropertyOptional({ type: StatusRefDto }) status?: StatusRefDto;
  @ApiPropertyOptional({ type: BackupDto }) backup?: BackupDto;
}
class EntryDto extends NewEntryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
}

const isDate = (s: unknown): s is string => typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s));
const b64u = /^[A-Za-z0-9_-]+$/;

function validate(b: unknown): NewWalletEntry {
  const e = (b ?? {}) as Record<string, unknown>;
  const bad = (m: string): never => { throw new BadRequestException(m); };
  if (typeof e.vct !== 'string' || e.vct.length < 3 || e.vct.length > 200) bad('vct is required');
  if (typeof e.issuer !== 'string' || !/^https:\/\/[^\s]{3,300}$/.test(e.issuer)) bad('issuer must be an https URL');
  if (!isDate(e.issued_at) || !isDate(e.expires_at) || Date.parse(e.expires_at as string) <= Date.parse(e.issued_at as string)) bad('issued_at and expires_at are dates, expiry after issuance');
  let statusUri: string | null = null;
  let statusIdx: number | null = null;
  if (e.status !== undefined) {
    const s = e.status as Record<string, unknown>;
    if (typeof s?.uri !== 'string' || !/^https:\/\/[^\s]{3,300}$/.test(s.uri) || !Number.isInteger(s.idx) || (s.idx as number) < 0) bad('status needs an https uri and an index');
    statusUri = s.uri as string;
    statusIdx = s.idx as number;
  }
  let backupCiphertext: Buffer | null = null;
  let backupKeyId: string | null = null;
  if (e.backup !== undefined) {
    const k = e.backup as Record<string, unknown>;
    if (typeof k?.ciphertext !== 'string' || !b64u.test(k.ciphertext) || k.ciphertext.length > 87_400) bad('backup.ciphertext is base64url');
    if (typeof k.key_id !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(k.key_id)) bad('backup.key_id is 43 base64url characters');
    backupCiphertext = Buffer.from(k.ciphertext as string, 'base64url');
    if (backupCiphertext.length < 29 || backupCiphertext.length > 65_536) bad('backup.ciphertext: 29 to 65536 bytes');
    backupKeyId = k.key_id as string;
  }
  return { vct: e.vct as string, issuerUrl: e.issuer as string, issuedAt: new Date(e.issued_at as string), expiresAt: new Date(e.expires_at as string), statusUri, statusIdx, backupCiphertext, backupKeyId };
}

const view = (e: WalletEntry): EntryDto => ({
  id: e.id, vct: e.vct, issuer: e.issuerUrl, issued_at: e.issuedAt.toISOString(), expires_at: e.expiresAt.toISOString(),
  ...(e.statusUri !== null ? { status: { uri: e.statusUri, idx: e.statusIdx! } } : {}),
  ...(e.backupCiphertext ? { backup: { ciphertext: e.backupCiphertext.toString('base64url'), key_id: e.backupKeyId! } } : {}),
  created_at: e.createdAt.toISOString(),
});

/**
 * P4-API3: the signed-in person's wallet entries (P4-DB3). The device keeps the credentials; the cell keeps, for each,
 * what it needs to list it and remind before expiry, and optionally a backup encrypted on the device with a key the
 * cell never sees. Row-level security limits every query to the person in the token.
 */
@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller('v1/wallet/credentials')
export class WalletEntriesController {
  constructor(@Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository | null) {}

  private r(): WalletRepository {
    if (!this.repo) throw new ServiceUnavailableException('The wallet is not available in this cell');
    return this.repo;
  }

  @Get()
  @ApiOperation({ summary: 'The signed-in person\'s wallet entries (metadata and encrypted backups)' })
  @ApiOkResponse({ type: [EntryDto] })
  async list(@Req() req: IdentifiedRequest): Promise<EntryDto[]> {
    return (await this.r().listEntries(req.identity!.personId)).map(view);
  }

  @Post()
  @ApiOperation({ summary: 'Record a credential held on the device (metadata, optional encrypted backup); at most 200' })
  @ApiBody({ type: NewEntryDto })
  @ApiCreatedResponse({ type: EntryDto })
  async add(@Req() req: IdentifiedRequest, @Body() body: NewEntryDto): Promise<EntryDto> {
    const r = await this.r().addEntry(req.identity!.personId, validate(body));
    if (r === 'too-many') throw new HttpException('At most 200 wallet entries', HttpStatus.TOO_MANY_REQUESTS);
    return view(r);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a wallet entry (and its backup)' })
  @ApiNoContentResponse()
  async remove(@Req() req: IdentifiedRequest, @Param('id') id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new NotFoundException();
    if (!(await this.r().deleteEntry(req.identity!.personId, id))) throw new NotFoundException();
  }
}
