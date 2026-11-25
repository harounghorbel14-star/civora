import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { CaseStatusDirectory } from '../cases/public-api';
import type { MessagingChannel } from '../integrations/public-api';

/**
 * Customer access to the status page (P3-R2): the customer gives a case reference; a one-time code goes to the contact
 * on file; with the code, the customer sees the case status. The first answer is the same whether or not the reference
 * exists (no enumeration); codes are sent in the background so the answer time does not tell either.
 */
export interface StatusChallenges {
  create(id: string, referenceDigest: Buffer, codeDigest: Buffer, deliverable: boolean): Promise<boolean>;
  verify(id: string, referenceDigest: Buffer, codeDigest: Buffer): Promise<boolean>;
}

export interface PublicStatus { reference: string; institution: string; status: string; since: string }

const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();
export const normaliseReference = (r: unknown): string | null =>
  typeof r === 'string' && /^[A-Za-z0-9-]{6,40}$/.test(r.trim()) ? r.trim().toUpperCase() : null;
export const referenceDigest = (ref: string): Buffer => sha256(`status-reference\0${ref}`);
export const codeDigest = (challengeId: string, code: string): Buffer => sha256(`status-code\0${challengeId}\0${code}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CODE_MINUTES = 10;

const TEXT: Record<string, { subject: string; body: string }> = {
  ar: { subject: 'رمز CIVORA الخاص بك', body: 'رمزك للاطلاع على حالة ملفك: {code}. تنتهي صلاحيته بعد {minutes} دقائق. لا تشاركه أبدًا: لن يطلبه منك أي عون.' },
  fr: { subject: 'Votre code CIVORA', body: 'Votre code pour consulter l’état de votre dossier : {code}. Il expire dans {minutes} minutes. Ne le communiquez jamais : aucun agent ne vous le demandera.' },
  en: { subject: 'Your CIVORA code', body: 'Your code to see the status of your case: {code}. It expires in {minutes} minutes. Never share it: no member of staff will ever ask for it.' },
};

export class StatusAccess {
  constructor(private readonly deps: {
    directory: CaseStatusDirectory;
    messaging: MessagingChannel;
    challenges: StatusChallenges;
    log: (entry: Record<string, unknown>) => void;
  }) {}

  /** Always returns a challenge id; throws only for a malformed reference (format, not existence). */
  /**
   * The code goes to the contact on file through the channel the person picks: e-mail (default) or SMS (simulated until
   * Q3-1). The person never sees or types the address or number; a case without that channel gets no code (same answer).
   */
  async start(reference: unknown, locale: unknown, correlationId: string, channel: 'email' | 'sms' = 'email'): Promise<{ challengeId: string; expiresAt: string } | null> {
    const ref = normaliseReference(reference);
    if (!ref) return null;
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const view = await this.deps.directory.find(ref);
    const to = channel === 'sms' ? view?.contactPhone : view?.contactEmail;
    const send = await this.deps.challenges.create(id, referenceDigest(ref), codeDigest(id, code), !!to);
    if (send && view && to) {
      const lang = typeof locale === 'string' && TEXT[locale.split('-')[0]!] ? locale.split('-')[0]! : 'ar';
      const t = TEXT[lang]!;
      setImmediate(() => {
        this.deps.messaging.send({
          to, subject: t.subject, text: t.body.replace('{code}', code).replace('{minutes}', String(CODE_MINUTES)),
          purpose: 'status-access', correlationId,
        }).catch(() => this.deps.log({ level: 'error', msg: 'status code not delivered', correlationId }));
      });
    }
    return { challengeId: id, expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString() };
  }

  /** The status for the right code (once); null for anything else, never saying why. */
  async verify(challengeId: unknown, reference: unknown, code: unknown): Promise<PublicStatus | null> {
    const ref = normaliseReference(reference);
    if (typeof challengeId !== 'string' || !UUID.test(challengeId) || !ref || typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
    if (!(await this.deps.challenges.verify(challengeId, referenceDigest(ref), codeDigest(challengeId, code)))) return null;
    const view = await this.deps.directory.find(ref);
    return view ? { reference: view.reference, institution: view.institution, status: view.status, since: view.since } : null;
  }
}
