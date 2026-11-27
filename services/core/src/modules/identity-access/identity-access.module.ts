import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { PolicyEngine } from '@civora/policies';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { CASE_STATUS_DIRECTORY, CasesModule, type CaseStatusDirectory } from '../cases/public-api';
import { IntegrationsModule, MESSAGING, type MessagingChannel, NATIONAL_EID, type NationalEid } from '../integrations/public-api';
import { IdentityGuard } from './identity.guard';
import { IamRepository } from './iam.repository';
import { MandatesController } from './mandates.controller';
import { MeController } from './me.controller';
import { KeycloakAccountDirectory, KeycloakAdmin, KeycloakCitizenDirectory, KeycloakContactDirectory, KeycloakRecoveryDirectory, KeycloakStaffDirectory, loadAdminConfig, loadInvitationConfig, loadProvisionerConfig } from './keycloak-admin';
import { InvitationsController, type InvitationsDeps, MyMembershipsController, OrgUnitsController } from './org.controller';
import { AccountSecurity, loadStepUpMaxAge } from './account-security';
import { AuthenticatorsController, SessionsController } from './account-security.controller';
import { StepUpGuard } from './step-up.guard';
import { RegistrationService } from './registration.service';
import { RegistrationsController } from './registrations.controller';
import { IdentityLinksController, type IdentityLinksDeps, loadIdentityDigestKey } from './identity-links.controller';
import { StatusAccess } from './status-access';
import { AccountRecovery } from './account-recovery';
import { contextNotices, securityNotices, signInNotices } from './security-notices';
import { loadPollSeconds, SignInEventsService, SignInEventWatcher } from './signin-events';
import { AdaptiveControls, loadAdaptiveConfig } from './adaptive-context';
import { RecoveryController } from './recovery.controller';
import { ContactDetails, ContactRecovery, loadRecoveryLinkOrigin } from './contact-details';
import { ContactDetailsController, ContactRecoveryController } from './contact-details.controller';
import { StatusAccessController } from './status-access.controller';
import { loadOidcConfig, TokenVerifier } from './token-verifier';
import { ACCOUNT_RECOVERY, ACCOUNT_SECURITY, CONTACT_DETAILS, CONTACT_RECOVERY, ADAPTIVE_CONTROLS, SIGNIN_EVENTS, IAM_REPOSITORY, IDENTITY_LINKS, INVITATIONS, POLICY_ENGINE, STATUS_ACCESS, REGISTRATION_SERVICE, STEP_UP_MAX_AGE, TOKEN_VERIFIER } from './tokens';

/**
 * Bounded context: identity-access (Phase 3: citizen and staff accounts, profile, mandates, organisation, identity links).
 * Rules (ADR-001): own schema (iam) only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  imports: [IntegrationsModule, CasesModule],
  controllers: [MeController, MandatesController, RegistrationsController, SessionsController, AuthenticatorsController, OrgUnitsController,
    MyMembershipsController, InvitationsController, IdentityLinksController, StatusAccessController, RecoveryController, ContactDetailsController,
    ContactRecoveryController],
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
      inject: [IAM_REPOSITORY, MESSAGING],
      useFactory: (repo: IamRepository | null, messaging: MessagingChannel | null): AccountSecurity | null => {
        if (!repo) return null;
        const directories: ConstructorParameters<typeof AccountSecurity>[0] = {};
        for (const realm of ['citizens', 'staff'] as const) {
          const cfg = loadAdminConfig(realm);
          if (cfg) directories[realm] = new KeycloakAccountDirectory(new KeycloakAdmin(cfg));
        }
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'account-security', ...entry }) + '\n');
        return new AccountSecurity(directories, (personId, realm, items) => repo.syncAuthenticators(personId, realm, items), securityNotices(directories, messaging, log));
      },
    },
    {
      // Adaptive controls (G3, doc phase-3/15): need the database and the cell's digest key; Keycloak (to end a session)
      // and the messaging port (notices) when configured.
      provide: ADAPTIVE_CONTROLS,
      inject: [IAM_REPOSITORY, MESSAGING],
      useFactory: (repo: IamRepository | null, messaging: MessagingChannel | null): AdaptiveControls | null => {
        const key = loadIdentityDigestKey();
        if (!repo || !key) return null;
        const directories: Parameters<typeof contextNotices>[0] = {};
        for (const realm of ['citizens', 'staff'] as const) {
          const cfg = loadAdminConfig(realm);
          if (cfg) directories[realm] = new KeycloakAccountDirectory(new KeycloakAdmin(cfg));
        }
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'adaptive-controls', ...entry }) + '\n');
        return new AdaptiveControls({
          observe: (personId, signal) => repo.observeSession(personId, signal),
          endSession: async (realm, sessionId) => { await directories[realm]?.deleteSession(sessionId); },
          notice: contextNotices(directories, messaging, log),
          log,
        }, loadAdaptiveConfig(), key);
      },
    },
    {
      // Sign-in event notices (rest of G1, doc phase-3/15 §7): the database, the cell's digest key, the messaging port and
      // at least one realm whose provisioner can read events. Off otherwise (and with SIGNIN_EVENTS=off).
      provide: SIGNIN_EVENTS,
      inject: [IAM_REPOSITORY, MESSAGING],
      useFactory: (repo: IamRepository | null, messaging: MessagingChannel | null): SignInEventsService => {
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'signin-events', ...entry }) + '\n');
        const seconds = loadPollSeconds();
        const key = loadIdentityDigestKey();
        const directories: Partial<Record<'citizens' | 'staff', KeycloakAccountDirectory>> = {};
        for (const realm of ['citizens', 'staff'] as const) {
          const cfg = loadAdminConfig(realm);
          if (cfg) directories[realm] = new KeycloakAccountDirectory(new KeycloakAdmin(cfg));
        }
        const realms = (['citizens', 'staff'] as const).filter((r) => directories[r]);
        if (!repo || !key || !messaging || !realms.length || !seconds) return new SignInEventsService(null, 0, log);
        const watcher = new SignInEventWatcher({
          realms: [...realms],
          events: (realm, since, first, max) => directories[realm]!.events(since, first, max),
          credentialType: async (realm, userId, id) => (await directories[realm]!.listCredentials(userId)).find((c) => c.id === id)?.type ?? null,
          record: (event, account, kind, at) => repo.recordSignInEvent(event, account, kind, at),
          notify: signInNotices(directories, messaging),
          log,
        }, key);
        return new SignInEventsService(watcher, seconds, log);
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
    {
      // Account recovery (P3-SEC4): the eID adapter, the digest key, the citizens provisioner and e-mail for the notice.
      provide: ACCOUNT_RECOVERY,
      inject: [IAM_REPOSITORY, NATIONAL_EID, MESSAGING],
      useFactory: (repo: IamRepository | null, eid: NationalEid | null, messaging: MessagingChannel | null): AccountRecovery | null => {
        const digestKey = loadIdentityDigestKey();
        const cfg = loadProvisionerConfig();
        if (!repo || !eid || !digestKey || !cfg) return null;
        return new AccountRecovery({
          eid, digestKey, messaging, directory: new KeycloakRecoveryDirectory(cfg),
          attempts: { start: (...a) => repo.startRecovery(...a), claim: (...a) => repo.claimRecovery(...a), finish: (...a) => repo.finishRecovery(...a) },
          log: (entry) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'account-recovery', ...entry }) + '\n'),
        });
      },
    },
    {
      // Contact details (doc phase-3/16): the database, the cell's digest key, the messaging port and each realm's provisioner.
      provide: CONTACT_DETAILS,
      inject: [IAM_REPOSITORY, MESSAGING],
      useFactory: (repo: IamRepository | null, messaging: MessagingChannel | null): ContactDetails | null => {
        const digestKey = loadIdentityDigestKey();
        if (!repo || !digestKey) return null;
        const directories: ConstructorParameters<typeof ContactDetails>[0]['directories'] = {};
        for (const realm of ['citizens', 'staff'] as const) {
          const cfg = loadAdminConfig(realm);
          if (cfg) directories[realm] = new KeycloakContactDirectory(new KeycloakAdmin(cfg));
        }
        return new ContactDetails({
          directories, messaging, digestKey,
          changes: { start: (...a) => repo.startContactChange(...a), confirm: (...a) => repo.confirmContactChange(...a) },
          log: (entry) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'contact-details', ...entry }) + '\n'),
        });
      },
    },
    {
      // Recovery R4 (doc phase-3/16): the citizens provisioner, the digest key, the messaging port (e-mail and SMS).
      provide: CONTACT_RECOVERY,
      inject: [IAM_REPOSITORY, MESSAGING],
      useFactory: (repo: IamRepository | null, messaging: MessagingChannel | null): ContactRecovery | null => {
        const digestKey = loadIdentityDigestKey();
        const cfg = loadProvisionerConfig();
        if (!repo || !digestKey || !cfg || !messaging) return null;
        return new ContactRecovery({
          directory: new KeycloakContactDirectory(new KeycloakAdmin(cfg)), reset: new KeycloakRecoveryDirectory(cfg), messaging, digestKey,
          appOrigin: loadRecoveryLinkOrigin(),
          attempts: { start: (...a) => repo.startContactRecovery(...a), code: (...a) => repo.contactRecoveryCode(...a), complete: (...a) => repo.completeContactRecovery(...a) },
          log: (entry) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'contact-recovery', ...entry }) + '\n'),
        });
      },
    },
    // Cedar policies (ADR-006), validated in strict mode at start-up: invalid policies stop the core (fail closed).
    { provide: POLICY_ENGINE, useFactory: (): PolicyEngine => PolicyEngine.load() },
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
