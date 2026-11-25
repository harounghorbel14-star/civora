import { createHash, randomBytes } from 'node:crypto';
import { EidRejected, EidUnavailable, type MessagingChannel, type NationalEid } from '../integrations/public-api';
import type { RecoveryOutcome } from './iam.repository';
import { nationalIdDigest } from './identity-links.controller';
import type { RecoveryDirectory } from './keycloak-admin';
import { keycloakLocale } from './locale';

/**
 * Account recovery (P3-D5, P3-SEC4; doc phase-3/12). A person who has lost every way to sign in proves their identity
 * again at the national eID (simulated in Phase 3), at least at the level of their identity link and at least
 * "substantial" (ASVS 5.0 V6.4.4). If that identity is linked to an account, every way to sign in is removed, every
 * session ends, and a fresh activation link (authenticator app, then password) goes to the account's e-mail address,
 * with a notice in the person's language (V6.3.7). E-mail alone never recovers an account (V6.3.6).
 *
 * The answer is the same whatever happens after the eID (no account, level too low, limit reached, recovered), and the
 * work runs in the background, so neither the answer nor its timing says whether an account exists.
 */
export interface RecoveryDeps {
  eid: NationalEid;
  digestKey: Buffer;
  directory: RecoveryDirectory;
  messaging: MessagingChannel | null;
  attempts: {
    start(stateDigest: Buffer, nonce: string, verifier: string, ttlSeconds: number): Promise<string>;
    claim(id: string, stateDigest: Buffer): Promise<{ nonce: string; codeVerifier: string } | null>;
    finish(id: string, digest: Buffer | null, loa: string | null): Promise<RecoveryOutcome>;
  };
  log(entry: Record<string, unknown>): void;
}

export class RecoveryNotFound extends Error {}
export class RecoveryRejected extends Error {}
export class RecoveryUnavailable extends Error {}
export class RecoveryBusy extends Error {}

export const RECOVERY_ATTEMPT_SECONDS = 600;
const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();
const token = (): string => randomBytes(32).toString('base64url');

const NOTICE: Record<string, { subject: string; body: string }> = {
  ar: {
    subject: 'تمت استعادة حسابك في CIVORA',
    body: 'تمت استعادة حسابك باستعمال هويتك الرقمية الوطنية يوم {date}. أزلنا كل وسائل الدخول السابقة وأنهينا كل الجلسات، وأرسلنا إليك رابطًا لإعداد وسائل جديدة. إن لم تكن أنت من قام بذلك، اتصل بالدعم فورًا.',
  },
  fr: {
    subject: 'Votre compte CIVORA a été récupéré',
    body: 'Votre compte a été récupéré avec votre identité numérique nationale le {date}. Nous avons supprimé tous vos anciens moyens de connexion, fermé toutes vos sessions et vous avons envoyé un lien pour en créer de nouveaux. Si ce n’était pas vous, contactez immédiatement l’assistance.',
  },
  en: {
    subject: 'Your CIVORA account was recovered',
    body: 'Your account was recovered with your national digital identity on {date}. We removed all your previous ways to sign in, ended all your sessions and sent you a link to set up new ones. If this was not you, contact support at once.',
  },
};

export class AccountRecovery {
  /** Background work still running (tests wait for it). */
  readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: RecoveryDeps) {}

  async start(locale?: string): Promise<{ id: string; authorizationUrl: string; expiresAt: string }> {
    const state = token();
    const nonce = token();
    const verifier = token();
    let id: string;
    try {
      id = await this.deps.attempts.start(sha256(state), nonce, verifier, RECOVERY_ATTEMPT_SECONDS);
    } catch (e) {
      if ((e as { code?: string }).code === '53400') throw new RecoveryBusy();
      throw e;
    }
    return {
      id,
      // prompt=login at the eID (adapter default): a fresh authentication, never a reused eID session.
      authorizationUrl: this.deps.eid.authorizationUrl({
        state, nonce, codeChallenge: createHash('sha256').update(verifier).digest('base64url'), locale: locale ? keycloakLocale(locale) : undefined,
      }),
      expiresAt: new Date(Date.now() + RECOVERY_ATTEMPT_SECONDS * 1000).toISOString(),
    };
  }

  /** Resolves with the same (empty) answer for every outcome after the eID; throws only for a bad attempt or an eID problem. */
  async complete(id: string, code: string, state: string, correlationId: string): Promise<void> {
    const claimed = await this.deps.attempts.claim(id, sha256(state));
    if (!claimed) throw new RecoveryNotFound();
    let identity;
    try {
      identity = await this.deps.eid.complete({ code, codeVerifier: claimed.codeVerifier, nonce: claimed.nonce, correlationId });
    } catch (e) {
      if (e instanceof EidRejected) {
        await this.deps.attempts.finish(id, null, null);
        this.deps.log({ event: 'account-recovery', attempt: id, outcome: 'rejected' });
        throw new RecoveryRejected();
      }
      if (e instanceof EidUnavailable) throw new RecoveryUnavailable();
      throw e;
    }
    const digest = nationalIdDigest(this.deps.digestKey, identity.nationalId);
    const job = this.finish(id, digest, identity.loa).catch((e: unknown) => {
      this.deps.log({ event: 'account-recovery', attempt: id, outcome: 'error', error: String((e as Error).message ?? e).slice(0, 200) });
    });
    this.pending.add(job);
    void job.finally(() => this.pending.delete(job));
  }

  private async finish(id: string, digest: Buffer, loa: string): Promise<void> {
    const r = await this.deps.attempts.finish(id, digest, loa);
    if (r.outcome !== 'recovered' || !r.subject) {
      this.deps.log({ event: 'account-recovery', attempt: id, outcome: r.outcome });
      return;
    }
    const contact = await this.deps.directory.reset(r.subject);
    this.deps.log({ event: 'account-recovery', attempt: id, outcome: contact ? 'recovered' : 'account-unavailable' });
    if (!contact || !this.deps.messaging) return;
    const lang = contact.locale && NOTICE[contact.locale.split('-')[0]!] ? contact.locale.split('-')[0]! : 'ar';
    const t = NOTICE[lang]!;
    const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date());
    await this.deps.messaging.send({ to: contact.email, subject: t.subject, text: t.body.replace('{date}', date), purpose: 'account-recovery-notice', correlationId: id });
  }
}
