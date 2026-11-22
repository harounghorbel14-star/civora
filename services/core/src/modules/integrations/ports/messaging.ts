import type { AdapterMode, AdapterRegistration } from '../adapter-registry';

/**
 * Port MessagingChannel (Phase 0 §8.7; docs/phase-2/11 §11.2): e-mail and SMS to a person. Phase 3: e-mail only, to the
 * dev/test mail catcher (register entry M-02 e-mail delivery is class 3; SMS M-01 waits on Q3-1 and Q3-6).
 */
export interface OutboundMessage {
  to: string;
  subject: string;
  text: string;
  /** Why the message is sent (integration log). */
  purpose: string;
  correlationId: string;
}

export class MessageNotSent extends Error {}

export interface MessagingChannel {
  readonly registration: AdapterRegistration;
  readonly mode: AdapterMode;
  send(m: OutboundMessage): Promise<void>;
}
