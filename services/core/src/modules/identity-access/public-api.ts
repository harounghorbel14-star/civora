/** Public interface of the identity-access module. Other modules and tools may import ONLY from this file. */
export { cleanupUnactivated, cleanupUnactivatedAccounts } from './cleanup-unactivated';
export { IdentityAccessModule } from './identity-access.module';
export { IdentityGuard, type Identity, type IdentifiedRequest } from './identity.guard';
export { RequireStepUp, StepUpGuard } from './step-up.guard';
export { PERSON_CONTACTS } from './tokens';
export type { PersonContacts } from './person-contacts';
