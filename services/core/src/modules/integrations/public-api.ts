/** Public interface of the integrations module. Other modules may import ONLY from this file. */
export { IntegrationsModule } from './integrations.module';
export { MESSAGING, NATIONAL_EID } from './tokens';
export { type EidIdentity, type EidLoa, EidRejected, EidUnavailable, type NationalEid } from './ports/national-eid';
export { MessageNotSent, type MessagingChannel, type OutboundMessage } from './ports/messaging';
