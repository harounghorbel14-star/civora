import type { IamRepository } from './iam.repository';

/**
 * How other modules reach a person (public API; ADR-001): the e-mail address and language of the person's citizen
 * account, read from Keycloak at the moment of sending and never copied. Used for the wallet's expiry reminders
 * (Phase 4, P4-D5). Returns null when the person has no active citizen account or no address.
 */
export interface PersonContacts {
  contactOf(personId: string): Promise<{ email: string; locale: string } | null>;
}

export class DirectoryPersonContacts implements PersonContacts {
  constructor(
    private readonly accounts: Pick<IamRepository, 'citizenAccount'>,
    private readonly directory: { contact?(userId: string): Promise<{ email: string; locale: string | null } | null> },
  ) {}

  async contactOf(personId: string): Promise<{ email: string; locale: string } | null> {
    const account = await this.accounts.citizenAccount(personId);
    if (!account || !this.directory.contact) return null;
    const c = await this.directory.contact(account.subject);
    return c ? { email: c.email, locale: c.locale ?? account.preferredLocale } : null;
  }
}
