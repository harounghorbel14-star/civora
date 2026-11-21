import { createHash } from 'node:crypto';
import type { CitizenDirectory } from './keycloak-admin';

/**
 * Citizen registration without account enumeration (Phase 3 doc 03 §6, R-P3-1).
 * - The HTTP answer is decided before anything is looked up: the same 202 for a new, a pending or an existing address.
 * - The work runs after the answer (no timing difference), at most one activation e-mail per address per interval.
 * - New address: account created WITHOUT any credential, activation link e-mailed (second factor, then password).
 *   Pending address (no credential yet): the link is sent again. Activated address: nothing is sent.
 * - Logs never contain the address: only the first 8 hex characters of its digest.
 */
export const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export const emailDigest = (email: string): Buffer => createHash('sha256').update(email, 'utf8').digest();

export type RegistrationOutcome = 'created' | 'resent' | 'already-active' | 'rate-limited' | 'failed';

export interface RegistrationDeps {
  directory: CitizenDirectory;
  /** Records a send and says whether one is allowed now (database function iam.registration_permit). */
  permit: (digest: Buffer) => Promise<boolean>;
  log: (entry: Record<string, unknown>) => void;
}

export class RegistrationService {
  constructor(private readonly deps: RegistrationDeps) {}

  /** Starts the work and returns at once; the promise is only for tests and shutdown. */
  submit(email: string, keycloakLocale: string): Promise<RegistrationOutcome> {
    return new Promise((resolve) => setImmediate(() => void this.process(email, keycloakLocale).then(resolve)));
  }

  async process(email: string, keycloakLocale: string): Promise<RegistrationOutcome> {
    const digest = emailDigest(email);
    const ref = digest.toString('hex').slice(0, 8);
    let outcome: RegistrationOutcome;
    try {
      if (!(await this.deps.permit(digest))) outcome = 'rate-limited';
      else {
        const user = await this.deps.directory.findByEmail(email);
        if (!user) {
          await this.deps.directory.sendActivation(await this.deps.directory.create(email, keycloakLocale));
          outcome = 'created';
        } else if (!user.hasCredentials) {
          await this.deps.directory.sendActivation(user.id);
          outcome = 'resent';
        } else outcome = 'already-active';
      }
    } catch (e) {
      outcome = 'failed';
      this.deps.log({ level: 'error', msg: 'registration processing failed', ref, error: e instanceof Error ? e.message : String(e) });
    }
    if (outcome !== 'failed') this.deps.log({ level: 'info', msg: 'registration processed', ref, outcome });
    return outcome;
  }
}
