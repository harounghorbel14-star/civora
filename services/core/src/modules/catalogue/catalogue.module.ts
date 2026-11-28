import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool, types } from 'pg';
import { readSecret } from '../../config/app-config';
import { IdentityAccessModule } from '../identity-access/public-api';
import { CatalogueAdminController, CatalogueController, CatalogueOfficesController, CatalogueSourcesController } from './catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { Catalogue, loadCatalogueConfig } from './catalogue.service';
import { CATALOGUE } from './tokens';

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
  controllers: [CatalogueController, CatalogueAdminController, CatalogueSourcesController, CatalogueOfficesController],
  providers: [
    {
      provide: CATALOGUE,
      useFactory: (): Catalogue | null => {
        const url = readSecret(process.env, 'CATALOGUE_DATABASE_URL');
        if (!url) return null;
        return new Catalogue(new CatalogueRepository(new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000, types: catalogueTypes })), loadCatalogueConfig());
      },
    },
  ],
})
export class CatalogueModule implements OnApplicationShutdown {
  constructor(@Inject(CATALOGUE) private readonly catalogue: Catalogue | null) {}

  async onApplicationShutdown(): Promise<void> {
    await this.catalogue?.close();
  }
}
