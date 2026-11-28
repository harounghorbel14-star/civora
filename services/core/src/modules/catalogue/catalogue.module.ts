import { Inject, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Pool, types } from 'pg';
import { readSecret } from '../../config/app-config';
import { IdentityAccessModule } from '../identity-access/public-api';
import { CatalogueAdminController, CatalogueController, CatalogueOfficesController, CatalogueReportsController, CatalogueSourcesController } from './catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { Catalogue, loadCatalogueConfig } from './catalogue.service';
import type { ServicePages } from './public-api';
import { CATALOGUE, SERVICE_PAGES } from './tokens';

/**
 * SQL dates (last verified, read on) stay 'YYYY-MM-DD' strings. node-postgres would parse them as local midnight: in a
 * cell running in Africa/Tunis (UTC+1) that becomes 23:00 the day before in UTC, and the page would show the wrong day.
 */
const DATE_OID = 1082;
export const catalogueTypes = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') => (oid === DATE_OID && format !== 'binary' ? (v: string) => v : types.getTypeParser(oid, format as 'text'))) as typeof types.getTypeParser,
};

/**
 * Bounded context: catalogue (Phase 5, Government Services Directory; taxonomy reused by Workspace; docs phase-5/00..02).
 * Rules (ADR-001): own schema only, on the pg-public cluster (CATALOGUE_DATABASE_URL; ADR-003); other modules use
 * ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  imports: [IdentityAccessModule],
  controllers: [CatalogueController, CatalogueAdminController, CatalogueSourcesController, CatalogueOfficesController, CatalogueReportsController],
  providers: [
    {
      provide: CATALOGUE,
      useFactory: (): Catalogue | null => {
        const url = readSecret(process.env, 'CATALOGUE_DATABASE_URL');
        if (!url) return null;
        return new Catalogue(new CatalogueRepository(new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000, types: catalogueTypes })), loadCatalogueConfig());
      },
    },
    {
      // For other modules (public API): null when this cell has no catalogue.
      provide: SERVICE_PAGES,
      inject: [CATALOGUE],
      useFactory: (c: Catalogue | null): ServicePages | null => (c ? { published: (slug) => c.servicePagePublished(slug) } : null),
    },
  ],
  exports: [SERVICE_PAGES],
})
export class CatalogueModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(CATALOGUE) private readonly catalogue: Catalogue | null) {}

  /** Integrity monitoring (P5-SEC3) every CATALOGUE_INTEGRITY_SECONDS (default 3600; 0 turns it off, as the tests do). */
  onApplicationBootstrap(): void {
    const seconds = Number(process.env.CATALOGUE_INTEGRITY_SECONDS ?? 3600);
    if (!this.catalogue || !Number.isFinite(seconds) || seconds <= 0) return;
    const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'catalogue-integrity', ...entry }) + '\n');
    const monitor = this.catalogue.integrity(log);
    const run = () => { void monitor.runOnce().catch(() => log({ level: 'error', msg: 'catalogue integrity run failed' })); };
    setTimeout(run, 30_000).unref();
    this.timer = setInterval(run, Math.max(60, seconds) * 1000);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.catalogue?.close();
  }
}
