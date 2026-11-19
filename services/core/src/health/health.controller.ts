import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { LoadedPack } from '@civora/country-packs';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { COUNTRY_PACK } from '../country-config/country-config.module';
import { DatabaseProbe } from './database-probe';

class PackInfo {
  @ApiProperty({ example: 'tn' }) id!: string;
  @ApiProperty({ example: '0.1.0' }) version!: string;
  @ApiProperty({ example: 'synthetic-development-only' }) status!: string;
  @ApiProperty({ description: 'SHA-256 digest of the verified pack manifest' }) digest!: string;
}
class HealthChecks {
  @ApiProperty({ enum: ['up', 'down', 'not-configured'] }) database!: string;
  @ApiProperty({ enum: ['up'] }) countryPack!: string;
}
export class HealthResponse {
  @ApiProperty({ enum: ['ok', 'degraded'] }) status!: 'ok' | 'degraded';
  @ApiProperty({ example: '0.1.0' }) version!: string;
  @ApiProperty({ example: 'dev' }) environment!: string;
  @ApiProperty({ type: PackInfo }) countryPack!: PackInfo;
  @ApiProperty({ type: HealthChecks }) checks!: HealthChecks;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(COUNTRY_PACK) private readonly pack: LoadedPack,
    private readonly db: DatabaseProbe,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness and dependency health (O-API1)', description: 'Returns 200 while the process is alive. `status` is `degraded` when a configured dependency is down. Contains no personal data.' })
  @ApiOkResponse({ type: HealthResponse })
  async health(): Promise<HealthResponse> {
    return this.build();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe', description: '503 when a configured dependency is down, so the orchestrator stops routing traffic.' })
  @ApiOkResponse({ type: HealthResponse })
  @ApiServiceUnavailableResponse({ description: 'A configured dependency is down' })
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const body = await this.build();
    if (body.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }

  private async build(): Promise<HealthResponse> {
    const database = await this.db.check();
    return {
      status: database === 'down' ? 'degraded' : 'ok',
      version: this.cfg.version,
      environment: this.cfg.environment,
      countryPack: { id: this.pack.pack.packId, version: this.pack.pack.version, status: this.pack.pack.status, digest: this.pack.digest },
      checks: { database, countryPack: 'up' },
    };
  }
}
