import { type AdapterMode, type AdapterRegistration, assertModeAllowed } from '../../../adapter-registry';
import type { IntegrationLogger } from '../../../integration-log';
import { MessageNotSent, type MessagingChannel, type OutboundMessage } from '../../../ports/messaging';

/**
 * SMS to a person, SIMULATED (register entry M-01, class 3; ADR-028): no SMS provider is chosen (Q3-1, pilot gate PG-6).
 * Only synthetic numbers (+2160 followed by 7 digits: no Tunisian number starts with 0 after the country code) are
 * accepted; each message goes to the dev/test mail catcher as `sms.<digits>@sms.civora-cell.invalid`, so tests can read
 * it. One integration-log line per message, without the number or the text. Never a sign-in factor (doc phase-3/12).
 */
export const SIMULATED_SMS: AdapterRegistration = { port: 'MessagingChannel', provider: 'simulated-sms', registerEntry: 'M-01', integrationClass: 3 };

export const SYNTHETIC_PHONE = /^\+2160\d{7}$/;
const MAX_TEXT = 320; // two SMS segments

/** Where the simulated SMS lands in the mail catcher (tests read it there). */
export const simulatedSmsMailbox = (phone: string): string => `sms.${phone.replace(/\D/g, '')}@sms.civora-cell.invalid`;

export class SimulatedSmsChannel implements MessagingChannel {
  readonly registration = SIMULATED_SMS;
  readonly mode: AdapterMode = assertModeAllowed(SIMULATED_SMS, 'simulated', { productionAdaptersFlag: false });

  /** `carrier` delivers to the mail catcher (the simulated e-mail channel). */
  constructor(private readonly carrier: MessagingChannel, private readonly log: IntegrationLogger) {}

  async send(m: OutboundMessage): Promise<void> {
    const started = Date.now();
    let outcome: 'ok' | 'rejected' | 'unavailable' = 'ok';
    try {
      if (!SYNTHETIC_PHONE.test(m.to)) { outcome = 'rejected'; throw new MessageNotSent('only synthetic numbers (+2160xxxxxxx) in simulated mode'); }
      if (m.text.length > MAX_TEXT) { outcome = 'rejected'; throw new MessageNotSent('an SMS holds at most 320 characters'); }
      await this.carrier.send({ ...m, to: simulatedSmsMailbox(m.to), subject: 'SMS', purpose: `${m.purpose} (simulated SMS)` });
    } catch (e) {
      if (outcome === 'ok') outcome = 'unavailable';
      throw e instanceof MessageNotSent ? e : new MessageNotSent('simulated SMS not delivered');
    } finally {
      this.log({ correlationId: m.correlationId, port: SIMULATED_SMS.port, provider: SIMULATED_SMS.provider, mode: this.mode, operation: 'send',
        purpose: m.purpose, legalBasisRef: 'none: simulated channel, synthetic recipients only', outcome, latencyMs: Date.now() - started });
    }
  }
}

/** E-mail or SMS by the shape of the address: a person's channel choice, one port (MessagingChannel). */
export class RoutingMessagingChannel implements MessagingChannel {
  readonly registration: AdapterRegistration;
  readonly mode: AdapterMode;

  constructor(private readonly email: MessagingChannel, private readonly sms: MessagingChannel | null) {
    this.registration = email.registration;
    this.mode = email.mode;
  }

  send(m: OutboundMessage): Promise<void> {
    if (m.to.startsWith('+')) {
      if (!this.sms) return Promise.reject(new MessageNotSent('no SMS channel in this cell'));
      return this.sms.send(m);
    }
    return this.email.send(m);
  }
}
