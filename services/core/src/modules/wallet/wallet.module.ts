import { Inject, Module, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { IdentityAccessModule, PERSON_CONTACTS, type PersonContacts } from '../identity-access/public-api';
import { CatalogueModule, SERVICE_PAGES, type ServicePages } from '../catalogue/public-api';
import { IntegrationsModule, MESSAGING, type MessagingChannel } from '../integrations/public-api';
import { ExpiryReminders } from './reminders';
import { DemoClaimSource } from './demo-source';
import { Issuance } from './issuance';
import { CredentialOffersController, Oid4vciController, StatusListsController, WalletWellKnownController } from './oid4vci.controller';
import { WalletEntriesController } from './wallet-entries.controller';
import { HolderRevocationController, OfficerRevocationController } from './revocation.controller';
import { Oid4vpController } from './oid4vp.controller';
import { Verification } from './verification';
import { IssuerSigners, loadOfficerTenant, loadWalletConfig } from './wallet.config';
import { WalletRepository } from './wallet.repository';
import { ISSUANCE, OFFICER_TENANT, REMINDERS, VERIFICATION, WALLET_REPOSITORY } from './tokens';

/**
 * Bounded context: wallet (Phase 4: verifiable credentials; docs phase-4/00..03).
 * Rules (ADR-001): own schema (wallet) only; other modules use ./public-api.ts or domain events; no cross-module database
 * access. The person comes from identity-access's guard (public API) only.
 */
@Module({
  imports: [IdentityAccessModule, IntegrationsModule, CatalogueModule],
  controllers: [WalletWellKnownController, CredentialOffersController, Oid4vciController, StatusListsController, WalletEntriesController, Oid4vpController,
    HolderRevocationController, OfficerRevocationController],
  providers: [
    { provide: OFFICER_TENANT, useFactory: (): string | null => loadOfficerTenant() },
    {
      provide: WALLET_REPOSITORY,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): WalletRepository | null =>
        cfg.databaseUrl ? new WalletRepository(new Pool({ connectionString: cfg.databaseUrl, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000 })) : null,
    },
    {
      // The issuer endpoints: on only with WALLET_PUBLIC_URL and the HSM module configured (wallet.config.ts).
      provide: ISSUANCE,
      inject: [WALLET_REPOSITORY],
      useFactory: (repo: WalletRepository | null): Issuance | null => {
        const cfg = loadWalletConfig();
        if (!cfg || !repo) return null;
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'wallet', ...entry }) + '\n');
        return new Issuance({ cfg, repo, signers: new IssuerSigners(cfg), source: new DemoClaimSource(), log });
      },
    },
    {
      // The verifier (OpenID4VP): same configuration and key store; only this cell's issuers are trusted for now.
      provide: VERIFICATION,
      inject: [WALLET_REPOSITORY, ISSUANCE],
      useFactory: (repo: WalletRepository | null, issuance: Issuance | null): Verification | null => {
        const cfg = loadWalletConfig();
        if (!cfg || !repo || !issuance) return null;
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'wallet', ...entry }) + '\n');
        return new Verification({ cfg, repo, signers: new IssuerSigners(cfg), issuance, log });
      },
    },
    {
      // Expiry reminders (P4-D5): need the database, the messaging port and the person-contact lookup of identity-access.
      provide: REMINDERS,
      inject: [WALLET_REPOSITORY, PERSON_CONTACTS, MESSAGING, SERVICE_PAGES],
      useFactory: (repo: WalletRepository | null, contacts: PersonContacts | null, messaging: MessagingChannel | null, pages: ServicePages | null): ExpiryReminders | null => {
        if (!repo || !contacts || !messaging) return null;
        const log = (entry: Record<string, unknown>) => process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), service: 'civora-core', context: 'wallet', ...entry }) + '\n');
        return new ExpiryReminders({ due: (n) => repo.dueReminders(n), mark: (e, t) => repo.markReminded(e, t), contacts, messaging, appOrigin: loadAppOrigin(), log,
          servicePage: pages ? (slug) => pages.published(slug) : async () => false });
      },
    },
  ],
})
export class WalletModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(WALLET_REPOSITORY) private readonly repo: WalletRepository | null, @Inject(REMINDERS) private readonly reminders: ExpiryReminders | null) {}

  /** Reminders every WALLET_REMINDER_SECONDS (default 3600; 0 turns them off, as the tests do). */
  onApplicationBootstrap(): void {
    const seconds = Number(process.env.WALLET_REMINDER_SECONDS ?? 3600);
    if (!this.reminders || !Number.isFinite(seconds) || seconds <= 0) return;
    this.timer = setInterval(() => { void this.reminders!.runOnce().catch(() => undefined); }, Math.max(60, seconds) * 1000);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.repo?.close();
  }
}

/** The citizen web app's origin, for renewal links (WALLET_APP_ORIGIN, else RECOVERY_LINK_ORIGIN, else the placeholder domain). */
function loadAppOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const u = new URL(env.WALLET_APP_ORIGIN ?? env.RECOVERY_LINK_ORIGIN ?? 'https://app.civora-cell.invalid');
  if (u.protocol !== 'https:' && !['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('WALLET_APP_ORIGIN must use https outside dev and test');
  return u.origin;
}
