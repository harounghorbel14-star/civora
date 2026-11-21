import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { IdentityGuard } from './identity.guard';
import { IamRepository } from './iam.repository';
import { MandatesController } from './mandates.controller';
import { MeController } from './me.controller';
import { loadOidcConfig, TokenVerifier } from './token-verifier';
import { IAM_REPOSITORY, TOKEN_VERIFIER } from './tokens';

/**
 * Bounded context: identity-access (Phase 3: citizen and staff accounts, profile, mandates).
 * Rules (ADR-001): own schema (iam) only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  controllers: [MeController, MandatesController],
  providers: [
    { provide: TOKEN_VERIFIER, useFactory: (): TokenVerifier => new TokenVerifier(loadOidcConfig()) },
    {
      provide: IAM_REPOSITORY,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): IamRepository | null =>
        cfg.databaseUrl ? new IamRepository(new Pool({ connectionString: cfg.databaseUrl, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000 })) : null,
    },
    IdentityGuard,
  ],
})
export class IdentityAccessModule implements OnApplicationShutdown {
  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository | null) {}
  async onApplicationShutdown(): Promise<void> {
    await this.repo?.close();
  }
}
