import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

export type ProbeResult = 'up' | 'down' | 'not-configured';

@Injectable()
export class DatabaseProbe implements OnModuleDestroy {
  private readonly pool: Pool | null;
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.pool = cfg.databaseUrl ? new Pool({ connectionString: cfg.databaseUrl, max: 2, connectionTimeoutMillis: 2000, idleTimeoutMillis: 5000 }) : null;
  }
  async check(): Promise<ProbeResult> {
    if (!this.pool) return 'not-configured';
    try {
      await this.pool.query('select 1');
      return 'up';
    } catch {
      return 'down';
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
