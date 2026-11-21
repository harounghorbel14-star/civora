import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { IdentityGuard } from './identity.guard';
import { IamRepository } from './iam.repository';
import { MandatesController } from './mandates.controller';
import { MeController } from './me.controller';
import { KeycloakCitizenDirectory, loadProvisionerConfig } from './keycloak-admin';
import { RegistrationService } from './registration.service';
import { RegistrationsController } from './registrations.controller';
import { loadOidcConfig, TokenVerifier } from './token-verifier';
import { IAM_REPOSITORY, REGISTRATION_SERVICE, TOKEN_VERIFIER } from './tokens';

/**
 * Bounded context: identity-access (Phase 3: citizen and staff accounts, profile, mandates).
 * Rules (ADR-001): own schema (iam) only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  controllers: [MeController, MandatesController, RegistrationsController],
  providers: [
    { provide: TOKEN_VERIFIER, useFactory: (): TokenVerifier => new TokenVerifier(loadOidcConfig()) },
    {
      provide: IAM_REPOSITORY,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): IamRepository | null =>
        cfg.databaseUrl ? new IamRepository(new Pool({ connectionString: cfg.databaseUrl, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000 })) : null,
    },
    {
      // Citizen registration: needs the database (send limits) and the provisioner client of the citizens realm.
      provide: REGISTRATION_SERVICE,
      inject: [IAM_REPOSITORY],
      useFactory: (repo: IamRepository | null): RegistrationService | null => {
        const cfg = loadProvisionerConfig();
        if (!cfg || !repo) return null;
        return new RegistrationService({
          directory: new KeycloakCitizenDirectory(cfg),
          permit: (digest) => repo.registrationPermit(digest, cfg.resendIntervalMinutes),
          log: (entry) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'registration', ...entry }) + '\n'),
        });
      },
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
