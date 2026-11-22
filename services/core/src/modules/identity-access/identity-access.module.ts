import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { CASE_STATUS_DIRECTORY, CasesModule, type CaseStatusDirectory } from '../cases/public-api';
import { IntegrationsModule, MESSAGING, type MessagingChannel, NATIONAL_EID, type NationalEid } from '../integrations/public-api';
import { IdentityGuard } from './identity.guard';
import { IamRepository } from './iam.repository';
import { MandatesController } from './mandates.controller';
import { MeController } from './me.controller';
import { KeycloakAccountDirectory, KeycloakAdmin, KeycloakCitizenDirectory, KeycloakStaffDirectory, loadAdminConfig, loadInvitationConfig, loadProvisionerConfig } from './keycloak-admin';
import { InvitationsController, type InvitationsDeps, MyMembershipsController, OrgUnitsController } from './org.controller';
import { AccountSecurity, loadStepUpMaxAge } from './account-security';
import { AuthenticatorsController, SessionsController } from './account-security.controller';
import { StepUpGuard } from './step-up.guard';
import { RegistrationService } from './registration.service';
import { RegistrationsController } from './registrations.controller';
import { IdentityLinksController, type IdentityLinksDeps, loadIdentityDigestKey } from './identity-links.controller';
import { StatusAccess } from './status-access';
import { StatusAccessController } from './status-access.controller';
import { loadOidcConfig, TokenVerifier } from './token-verifier';
import { ACCOUNT_SECURITY, IAM_REPOSITORY, IDENTITY_LINKS, INVITATIONS, STATUS_ACCESS, REGISTRATION_SERVICE, STEP_UP_MAX_AGE, TOKEN_VERIFIER } from './tokens';

/**
 * Bounded context: identity-access (Phase 3: citizen and staff accounts, profile, mandates, organisation, identity links).
 * Rules (ADR-001): own schema (iam) only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  imports: [IntegrationsModule, CasesModule],
  controllers: [MeController, MandatesController, RegistrationsController, SessionsController, AuthenticatorsController, OrgUnitsController,
    MyMembershipsController, InvitationsController, IdentityLinksController, StatusAccessController],
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
    {
      // Sessions and authenticators of the signed-in person, per realm whose provisioner is configured.
      provide: ACCOUNT_SECURITY,
      inject: [IAM_REPOSITORY],
      useFactory: (repo: IamRepository | null): AccountSecurity | null => {
        if (!repo) return null;
        const directories: ConstructorParameters<typeof AccountSecurity>[0] = {};
        for (const realm of ['citizens', 'staff'] as const) {
          const cfg = loadAdminConfig(realm);
          if (cfg) directories[realm] = new KeycloakAccountDirectory(new KeycloakAdmin(cfg));
        }
        return new AccountSecurity(directories, (personId, realm, items) => repo.syncAuthenticators(personId, realm, items));
      },
    },
    {
      // Staff invitations need the staff realm's provisioner.
      provide: INVITATIONS,
      useFactory: (): InvitationsDeps | null => {
        const admin = loadAdminConfig('staff');
        if (!admin) return null;
        const cfg = loadInvitationConfig();
        return { directory: new KeycloakStaffDirectory(new KeycloakAdmin(admin), cfg), cfg };
      },
    },
    {
      // Identity links need the national eID adapter (integrations module) and the cell's digest key.
      provide: IDENTITY_LINKS,
      inject: [NATIONAL_EID],
      useFactory: (eid: NationalEid | null): IdentityLinksDeps | null => {
        const digestKey = loadIdentityDigestKey();
        return eid && digestKey ? { eid, digestKey } : null;
      },
    },
    {
      // Customer status page: needs the case directory (cases module), e-mail (integrations module) and the database.
      provide: STATUS_ACCESS,
      inject: [IAM_REPOSITORY, CASE_STATUS_DIRECTORY, MESSAGING],
      useFactory: (repo: IamRepository | null, directory: CaseStatusDirectory | null, messaging: MessagingChannel | null): StatusAccess | null =>
        repo && directory && messaging ? new StatusAccess({
          directory, messaging,
          challenges: { create: (...a) => repo.createStatusChallenge(...a), verify: (...a) => repo.verifyStatusChallenge(...a) },
          log: (entry) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'status-access', ...entry }) + '\n'),
        }) : null,
    },
    { provide: STEP_UP_MAX_AGE, useFactory: (): number => loadStepUpMaxAge() },
    IdentityGuard,
    StepUpGuard,
  ],
})
export class IdentityAccessModule implements OnApplicationShutdown {
  constructor(@Inject(IAM_REPOSITORY) private readonly repo: IamRepository | null) {}
  async onApplicationShutdown(): Promise<void> {
    await this.repo?.close();
  }
}
