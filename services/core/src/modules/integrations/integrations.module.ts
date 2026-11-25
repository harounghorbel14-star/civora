import { Module } from '@nestjs/common';
import type { LoadedPack } from '@civora/country-packs';
import { COUNTRY_PACK } from '../../country-config/country-config.module';
import { loadSimulatedEidConfig, SimulatedOidcEid } from './adapters/national-eid/simulated-oidc/simulated-oidc.adapter';
import { AdapterModeError } from './adapter-registry';
import { stdoutIntegrationLog } from './integration-log';
import { RoutingMessagingChannel, SimulatedSmsChannel } from './adapters/messaging/simulated-sms/simulated-sms.adapter';
import { loadSimulatedSmtpConfig, SimulatedSmtpChannel } from './adapters/messaging/simulated-smtp/simulated-smtp.adapter';
import type { MessagingChannel } from './ports/messaging';
import type { NationalEid } from './ports/national-eid';
import { MESSAGING, NATIONAL_EID } from './tokens';

/**
 * Bounded context: integrations (ADR-028 adapter framework). Phase 3: NationalEid and MessagingChannel ports, simulated only.
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  providers: [
    {
      // Null when no eID is configured in this cell. Any mode other than simulated stops the start-up (class 3).
      provide: NATIONAL_EID,
      inject: [COUNTRY_PACK],
      useFactory: (loaded: LoadedPack): NationalEid | null => {
        const mode = process.env.EID_MODE ?? 'simulated';
        if (mode !== 'simulated') throw new AdapterModeError(`EID_MODE=${mode}: the national eID (register entry I-01, class 3) may run in simulated mode only`);
        const cin = loaded.pack.identifiers.cin;
        if (!cin) throw new Error('the country pack declares no national identifier (identifiers.cin)');
        const cfg = loadSimulatedEidConfig(cin.syntheticPattern);
        return cfg ? new SimulatedOidcEid(cfg, stdoutIntegrationLog) : null;
      },
    },
    {
      // E-mail to a person: simulated (dev/test mail catcher) until a provider is authorised (register M-02, Q3-6).
      provide: MESSAGING,
      useFactory: (): MessagingChannel | null => {
        const cfg = loadSimulatedSmtpConfig();
        if (!cfg) return null;
        const email = new SimulatedSmtpChannel(cfg, stdoutIntegrationLog);
        // SMS (register M-01, Q3-1): simulated too, through the same mail catcher; a delivery channel, never a sign-in factor.
        return new RoutingMessagingChannel(email, process.env.MESSAGING_SMS === 'simulated' ? new SimulatedSmsChannel(email, stdoutIntegrationLog) : null);
      },
    },
  ],
  exports: [NATIONAL_EID, MESSAGING],
})
export class IntegrationsModule {}
