import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { readSecret } from '../../config/app-config';
import { IdentityAccessModule } from '../identity-access/public-api';
import { CatalogueAdminController, CatalogueController, CatalogueSourcesController } from './catalogue.controller';
import { CatalogueRepository } from './catalogue.repository';
import { Catalogue, loadCatalogueConfig } from './catalogue.service';
import { CATALOGUE } from './tokens';

/**
 * Bounded context: catalogue (Phase 5, Government Services Directory; taxonomy reused by Workspace; docs phase-5/00..02).
 * Rules (ADR-001): own schema only, on the pg-public cluster (CATALOGUE_DATABASE_URL; ADR-003); other modules use
 * ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  imports: [IdentityAccessModule],
  controllers: [CatalogueController, CatalogueAdminController, CatalogueSourcesController],
  providers: [
    {
      provide: CATALOGUE,
      useFactory: (): Catalogue | null => {
        const url = readSecret(process.env, 'CATALOGUE_DATABASE_URL');
        if (!url) return null;
        return new Catalogue(new CatalogueRepository(new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000 })), loadCatalogueConfig());
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
