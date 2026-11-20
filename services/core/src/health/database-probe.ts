import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

export type ProbeResult = 'up' | 'down' | 'not-configured';

@Injectable()
export class DatabaseProbe implements OnModuleDestroy {
  private readonly pool: Pool | null;
  private readonly logger = new Logger('DatabaseProbe');
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.pool = cfg.databaseUrl ? new Pool({ connectionString: cfg.databaseUrl, max: 2, connectionTimeoutMillis: 2000, idleTimeoutMillis: 5000 }) : null;
    // An idle connection is terminated when the primary fails over (or restarts). Without a listener, pg-pool's
    // 'error' event is unhandled and the whole process exits (found by the database HA suite, 19 Nov 2026).
    // The pool drops the broken client; the next check opens a new connection through pg-router.
    this.pool?.on('error', () => this.logger.warn('idle database connection lost; the next check reconnects'));
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
