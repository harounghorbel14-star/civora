import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { MessageNotSent, type MessagingChannel } from '../integrations/public-api';
import type { ContactDirectory, ContactRecord, RecoveryDirectory } from './keycloak-admin';
import { normaliseEmail } from './registration.service';
import type { Realm, VerifiedToken } from './token-verifier';

/**
 * The account's e-mail address and phone number (decisions of 27 Nov 2026; doc phase-3/16).
 *
 * - Neither can be changed on Keycloak's pages (user profile: administrators only; realm checker). The core changes
 *   them, after a recent sign-in, once the code sent to the NEW address or number is typed back (10 minutes, 5 tries,
 *   5 changes a day). The old address is told of an e-mail change, the account's address of a phone change or removal
 *   (ASVS 5.0 V6.3.7).
 * - Recovery R4 (citizens): the e-mailed link AND a code sent by SMS to the verified number; both are needed, the link
 *   first (no SMS is ever sent to someone who only knows the address). The answer to the first step is the same
 *   whatever the account situation, and the work runs in the background (no enumeration, no timing).
 */

export const CODE_MINUTES = 10;
export const RECOVERY_LINK_MINUTES = 30;
/** E.164, as Keycloak's user profile also checks. The simulated SMS channel accepts only synthetic numbers. */
export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export const normalisePhone = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const p = input.replace(/[\s().-]/g, '').replace(/^00/, '+');
  return PHONE_PATTERN.test(p) ? p : null;
};
/** What a notice may say about an address: its first letter and its domain. */
export const maskEmail = (e: string): string => `${e.slice(0, 1)}•••@${e.split('@')[1] ?? ''}`;
/** What a notice or a page may say about a number: its last two digits. */
export const phoneEnding = (p: string): string => p.slice(-2);

const sha256 = (s: string): Buffer => createHash('sha256').update(s, 'utf8').digest();
const sixDigits = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
const langOf = (...locales: (string | null | undefined)[]): Lang => {
  for (const l of locales) {
    const base = (l ?? '').split('-')[0];
    if (base === 'ar' || base === 'fr' || base === 'en') return base;
  }
  return 'ar';
};
const dateIn = (lang: Lang): string =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date());
const fill = (s: string, v: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

export type Lang = 'ar' | 'fr' | 'en';
type Text = { subject: string; body: string };

/** Messages in Arabic, French and English. SMS texts stay within one 70-character Unicode segment where possible. */
export const TEXT: Record<Lang, {
  emailCode: Text; smsCode: string; emailChangedOld: Text; emailChangedNew: Text; phoneAdded: Text; phoneRemoved: Text;
  recoveryLink: Text; recoveryNoPhone: Text; recoverySms: string; recoveredNotice: Text; recoveredSms: string;
}> = {
  ar: {
    emailCode: { subject: 'رمز تأكيد عنوانك في CIVORA', body: 'رمزك لتأكيد هذا العنوان لحسابك في CIVORA: {code}. تنتهي صلاحيته بعد {minutes} دقائق. إن لم تطلبه، تجاهل هذه الرسالة.' },
    smsCode: 'CIVORA: رمز تأكيد رقمك {code} (صالح {minutes} دقائق). لا تشاركه.',
    emailChangedOld: { subject: 'تغيّر عنوان البريد الإلكتروني لحسابك في CIVORA', body: 'يوم {date} تغيّر عنوان البريد الإلكتروني لحسابك إلى {masked}. لن تصل رسائل الحساب إلى هذا العنوان بعد الآن. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا بهويتك الرقمية الوطنية واتصل بالدعم.' },
    emailChangedNew: { subject: 'هذا العنوان صار عنوان حسابك في CIVORA', body: 'يوم {date} صار هذا العنوان عنوان البريد الإلكتروني لحسابك في CIVORA. ستصلك عليه رسائل الحساب والتنبيهات الأمنية.' },
    phoneAdded: { subject: 'أُضيف أو غُيّر رقم الهاتف في حسابك في CIVORA', body: 'يوم {date} صار رقم الهاتف المنتهي بـ {ending} رقم حسابك. يُستعمل لاستعادة الحساب ولتلقي الرسائل. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا واتصل بالدعم.' },
    phoneRemoved: { subject: 'أُزيل رقم الهاتف من حسابك في CIVORA', body: 'يوم {date} أُزيل رقم الهاتف المنتهي بـ {ending} من حسابك. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا واتصل بالدعم.' },
    recoveryLink: { subject: 'استعادة حسابك في CIVORA', body: 'طلب أحدهم استعادة حسابك في CIVORA. إن كنت أنت، افتح هذا الرابط خلال {minutes} دقيقة، ثم أدخل الرمز الذي سنرسله إلى هاتفك المنتهي بـ {ending}:\n{link}\nإن لم تكن أنت، تجاهل هذه الرسالة: لن يتغيّر شيء.' },
    recoveryNoPhone: { subject: 'استعادة حسابك في CIVORA', body: 'طلب أحدهم استعادة حسابك في CIVORA بالبريد الإلكتروني والهاتف، لكن لا يوجد في حسابك رقم هاتف مؤكَّد. استعد حسابك بهويتك الرقمية الوطنية أو لدى شبّاك بوثيقة هويتك. إن لم تكن أنت، تجاهل هذه الرسالة.' },
    recoverySms: 'CIVORA: رمز استعادة حسابك {code} (صالح {minutes} دقائق). لا تشاركه.',
    recoveredNotice: { subject: 'تمت استعادة حسابك في CIVORA', body: 'تمت استعادة حسابك يوم {date} برابط البريد الإلكتروني ورمز أُرسل إلى هاتفك. أزلنا كل وسائل الدخول السابقة وأنهينا كل الجلسات، وأرسلنا إليك رابطًا لإعداد وسائل جديدة. إن لم تكن أنت من قام بذلك، اتصل بالدعم فورًا.' },
    recoveredSms: 'CIVORA: تمت استعادة حسابك. إن لم تكن أنت، اتصل بالدعم فورًا.',
  },
  fr: {
    emailCode: { subject: 'Code de confirmation de votre adresse CIVORA', body: 'Votre code pour confirmer cette adresse pour votre compte CIVORA : {code}. Il expire dans {minutes} minutes. Si vous ne l’avez pas demandé, ignorez ce message.' },
    smsCode: 'CIVORA : code de confirmation de votre numéro {code} ({minutes} min). Ne le partagez pas.',
    emailChangedOld: { subject: 'L’adresse e-mail de votre compte CIVORA a changé', body: 'Le {date}, l’adresse e-mail de votre compte est devenue {masked}. Les messages du compte n’arriveront plus à cette adresse. Si ce n’était pas vous, récupérez votre compte immédiatement avec votre identité numérique nationale et contactez l’assistance.' },
    emailChangedNew: { subject: 'Cette adresse est désormais celle de votre compte CIVORA', body: 'Le {date}, cette adresse est devenue l’adresse e-mail de votre compte CIVORA. Vous y recevrez les messages du compte et les alertes de sécurité.' },
    phoneAdded: { subject: 'Un numéro de téléphone a été ajouté ou modifié sur votre compte CIVORA', body: 'Le {date}, le numéro se terminant par {ending} est devenu celui de votre compte. Il sert à récupérer le compte et à recevoir des messages. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.' },
    phoneRemoved: { subject: 'Le numéro de téléphone a été retiré de votre compte CIVORA', body: 'Le {date}, le numéro se terminant par {ending} a été retiré de votre compte. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.' },
    recoveryLink: { subject: 'Récupération de votre compte CIVORA', body: 'Quelqu’un a demandé à récupérer votre compte CIVORA. Si c’est vous, ouvrez ce lien dans les {minutes} minutes, puis saisissez le code que nous enverrons à votre téléphone se terminant par {ending} :\n{link}\nSi ce n’est pas vous, ignorez ce message : rien ne changera.' },
    recoveryNoPhone: { subject: 'Récupération de votre compte CIVORA', body: 'Quelqu’un a demandé à récupérer votre compte CIVORA par e-mail et téléphone, mais votre compte n’a pas de numéro de téléphone confirmé. Récupérez votre compte avec votre identité numérique nationale ou à un guichet avec votre pièce d’identité. Si ce n’est pas vous, ignorez ce message.' },
    recoverySms: 'CIVORA : code de récupération de votre compte {code} ({minutes} min). Ne le partagez pas.',
    recoveredNotice: { subject: 'Votre compte CIVORA a été récupéré', body: 'Votre compte a été récupéré le {date} avec le lien envoyé par e-mail et un code envoyé à votre téléphone. Nous avons supprimé tous vos anciens moyens de connexion, fermé toutes vos sessions et vous avons envoyé un lien pour en créer de nouveaux. Si ce n’était pas vous, contactez immédiatement l’assistance.' },
    recoveredSms: 'CIVORA : votre compte a été récupéré. Si ce n’était pas vous, contactez l’assistance.',
  },
  en: {
    emailCode: { subject: 'Code to confirm your CIVORA address', body: 'Your code to confirm this address for your CIVORA account: {code}. It expires in {minutes} minutes. If you did not ask for it, ignore this message.' },
    smsCode: 'CIVORA: code to confirm your number {code} ({minutes} min). Do not share it.',
    emailChangedOld: { subject: 'The e-mail address of your CIVORA account changed', body: 'On {date}, the e-mail address of your account became {masked}. Account messages will no longer come to this address. If this was not you, recover your account at once with your national digital identity and contact support.' },
    emailChangedNew: { subject: 'This is now the address of your CIVORA account', body: 'On {date}, this address became the e-mail address of your CIVORA account. Account messages and security alerts will come here.' },
    phoneAdded: { subject: 'A phone number was added or changed on your CIVORA account', body: 'On {date}, the number ending in {ending} became your account\'s number. It is used to recover the account and to receive messages. If this was not you, recover your account at once and contact support.' },
    phoneRemoved: { subject: 'The phone number was removed from your CIVORA account', body: 'On {date}, the number ending in {ending} was removed from your account. If this was not you, recover your account at once and contact support.' },
    recoveryLink: { subject: 'Recovering your CIVORA account', body: 'Someone asked to recover your CIVORA account. If it was you, open this link within {minutes} minutes, then type the code we will send to your phone ending in {ending}:\n{link}\nIf it was not you, ignore this message: nothing will change.' },
    recoveryNoPhone: { subject: 'Recovering your CIVORA account', body: 'Someone asked to recover your CIVORA account by e-mail and phone, but your account has no confirmed phone number. Recover your account with your national digital identity, or at a counter with your identity document. If it was not you, ignore this message.' },
    recoverySms: 'CIVORA: code to recover your account {code} ({minutes} min). Do not share it.',
    recoveredNotice: { subject: 'Your CIVORA account was recovered', body: 'Your account was recovered on {date} with the e-mailed link and a code sent to your phone. We removed all your previous ways to sign in, ended all your sessions and sent you a link to set up new ones. If this was not you, contact support at once.' },
    recoveredSms: 'CIVORA: your account was recovered. If this was not you, contact support at once.',
  },
};

// ------------------------------------------------------------------------------------------------ contact changes

export type Channel = 'email' | 'phone';

export class InvalidContact extends Error {}
export class SameContact extends Error {}
export class TooManyChanges extends Error {}
export class NotDeliverable extends Error {}
export class ChangeNotFound extends Error {}
export class WrongCode extends Error {
  constructor(readonly attemptsLeft: number) { super('wrong code'); }
}
export class ContactInUse extends Error {}
export class ContactUnavailable extends Error {}

export interface ContactChanges {
  start(id: string, account: Buffer, channel: Channel, target: string, codeDigest: Buffer, minutes: number): Promise<boolean>;
  confirm(id: string, account: Buffer, codeDigest: Buffer): Promise<{ outcome: 'confirmed' | 'wrong-code' | 'not-found'; channel: Channel | null; target: string | null; attemptsLeft: number }>;
}

export interface ContactView {
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
}

export class ContactDetails {
  constructor(private readonly deps: {
    directories: Partial<Record<Realm, ContactDirectory>>;
    messaging: MessagingChannel | null;
    changes: ContactChanges;
    digestKey: Buffer;
    log: (entry: Record<string, unknown>) => void;
  }) {}

  configured(realm: Realm): boolean {
    return !!this.deps.directories[realm] && !!this.deps.messaging;
  }

  private dir(realm: Realm): ContactDirectory {
    const d = this.deps.directories[realm];
    if (!d) throw new ContactUnavailable();
    return d;
  }

  private account(token: Pick<VerifiedToken, 'realm' | 'subject'>): Buffer {
    return createHmac('sha256', this.deps.digestKey).update(`contact-account\0${token.realm}\0${token.subject}`, 'utf8').digest();
  }

  static codeDigest(id: string, code: string): Buffer {
    return sha256(`contact-code\0${id}\0${code}`);
  }

  private async me(token: VerifiedToken): Promise<ContactRecord> {
    const r = await this.dir(token.realm).get(token.subject);
    if (!r) throw new ContactUnavailable();
    return r;
  }

  async view(token: VerifiedToken): Promise<ContactView> {
    const r = await this.me(token);
    return { email: r.email, phone: r.phoneVerified ? r.phone : null, phoneVerified: r.phoneVerified };
  }

  /** Sends a code to the new address or number; the change waits for it (the caller checked a recent sign-in). */
  async start(token: VerifiedToken, channel: unknown, value: unknown, correlationId: string): Promise<{ id: string; channel: Channel; expiresAt: string }> {
    if (channel !== 'email' && channel !== 'phone') throw new InvalidContact();
    const target = channel === 'email' ? normaliseEmail(value) : normalisePhone(value);
    if (!target) throw new InvalidContact();
    if (!this.deps.messaging) throw new ContactUnavailable();
    const me = await this.me(token);
    if (channel === 'email' ? (me.email ?? '').toLowerCase() === target : me.phoneVerified && me.phone === target) throw new SameContact();
    const id = randomUUID();
    const code = sixDigits();
    if (!(await this.deps.changes.start(id, this.account(token), channel, target, ContactDetails.codeDigest(id, code), CODE_MINUTES))) throw new TooManyChanges();
    const t = TEXT[langOf(me.locale)];
    try {
      await this.deps.messaging.send(channel === 'email'
        ? { to: target, subject: t.emailCode.subject, text: fill(t.emailCode.body, { code, minutes: String(CODE_MINUTES) }), purpose: 'contact-change-code', correlationId }
        : { to: target, subject: 'SMS', text: fill(t.smsCode, { code, minutes: String(CODE_MINUTES) }), purpose: 'contact-change-code', correlationId });
    } catch (e) {
      if (e instanceof MessageNotSent) throw new NotDeliverable();
      throw e;
    }
    this.deps.log({ event: 'contact-change', channel, outcome: 'code-sent', correlationId });
    return { id, channel, expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString() };
  }

  /** Applies the change once the code is right, then tells the person (old address for an e-mail change). */
  async confirm(token: VerifiedToken, id: string, code: unknown, correlationId: string): Promise<{ channel: Channel; value: string }> {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw new WrongCode(-1);
    const r = await this.deps.changes.confirm(id, this.account(token), ContactDetails.codeDigest(id, code.trim()));
    if (r.outcome === 'wrong-code') throw new WrongCode(r.attemptsLeft);
    if (r.outcome !== 'confirmed' || !r.channel || !r.target) throw new ChangeNotFound();
    const dir = this.dir(token.realm);
    const before = { ...(await this.me(token)) };
    const t = TEXT[langOf(before.locale)];
    const date = dateIn(langOf(before.locale));
    if (r.channel === 'email') {
      const other = await dir.findByEmail(r.target);
      if (other && other.id !== token.subject) throw new ContactInUse();
      if ((await dir.setEmail(token.subject, r.target)) === 'in-use') throw new ContactInUse();
      if (before.email) await this.notify({ to: before.email, ...this.text(t.emailChangedOld, { date, masked: maskEmail(r.target) }), purpose: 'security-notice:email-changed', correlationId });
      await this.notify({ to: r.target, ...this.text(t.emailChangedNew, { date }), purpose: 'security-notice:email-changed', correlationId });
    } else {
      await dir.setPhone(token.subject, r.target);
      if (before.email) await this.notify({ to: before.email, ...this.text(t.phoneAdded, { date, ending: phoneEnding(r.target) }), purpose: 'security-notice:phone-changed', correlationId });
    }
    this.deps.log({ event: 'contact-change', channel: r.channel, outcome: 'confirmed', correlationId });
    return { channel: r.channel, value: r.target };
  }

  /** Removes the phone number (the caller checked a recent sign-in); tells the account's address. */
  async removePhone(token: VerifiedToken, correlationId: string): Promise<'removed' | 'none'> {
    const before = { ...(await this.me(token)) };
    if (!before.phone) return 'none';
    await this.dir(token.realm).setPhone(token.subject, null);
    const lang = langOf(before.locale);
    if (before.email) await this.notify({ to: before.email, ...this.text(TEXT[lang].phoneRemoved, { date: dateIn(lang), ending: phoneEnding(before.phone) }), purpose: 'security-notice:phone-removed', correlationId });
    this.deps.log({ event: 'contact-change', channel: 'phone', outcome: 'removed', correlationId });
    return 'removed';
  }

  private text(t: Text, v: Record<string, string>): { subject: string; text: string } {
    return { subject: t.subject, text: fill(t.body, v) };
  }

  /** A notice never undoes the change it reports; a failure is logged. */
  private async notify(m: { to: string; subject: string; text: string; purpose: string; correlationId: string }): Promise<void> {
    await this.deps.messaging?.send(m).catch((e: unknown) =>
      this.deps.log({ event: 'security-notice', type: m.purpose, outcome: 'not-sent', error: String((e as Error).message ?? e).slice(0, 200) }));
  }
}

// ------------------------------------------------------------------------------------------------ recovery R4

export interface ContactRecoveryAttempts {
  start(id: string, emailDigest: Buffer, account: Buffer, subject: string, phone: string | null, lang: Lang, linkDigest: Buffer, minutes: number): Promise<boolean>;
  code(id: string, linkDigest: Buffer, codeDigest: Buffer): Promise<{ phone: string; lang: Lang; codeExpiresAt: Date } | null>;
  complete(id: string, linkDigest: Buffer, codeDigest: Buffer): Promise<{ outcome: 'recovered' | 'wrong-code' | 'not-found'; subject: string | null; attemptsLeft: number }>;
}

export class RecoveryLinkNotFound extends Error {}

export interface ContactRecoveryDeps {
  directory: ContactDirectory;
  reset: RecoveryDirectory;
  messaging: MessagingChannel;
  attempts: ContactRecoveryAttempts;
  digestKey: Buffer;
  /** The web app's public origin; the link opens its recovery page. */
  appOrigin: string;
  log(entry: Record<string, unknown>): void;
}

/**
 * Where the recovery link opens: the web app's public origin (RECOVERY_LINK_ORIGIN; by default the origin of
 * ACTIVATION_REDIRECT_URI). https outside dev and test.
 */
export function loadRecoveryLinkOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.RECOVERY_LINK_ORIGIN ?? new URL(env.ACTIVATION_REDIRECT_URI ?? 'https://app.civora-cell.invalid/activated').origin;
  const u = new URL(raw);
  if (u.protocol !== 'https:' && !['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('RECOVERY_LINK_ORIGIN must use https outside dev and test');
  if (u.pathname !== '/' || u.search || u.hash) throw new Error('RECOVERY_LINK_ORIGIN must be an origin (scheme, host, port)');
  return u.origin;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export class ContactRecovery {
  /** Background work still running (tests wait for it). */
  readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: ContactRecoveryDeps) {}

  static linkDigest(id: string, token: string): Buffer {
    return sha256(`recovery-link\0${id}\0${token}`);
  }

  static codeDigest(id: string, code: string): Buffer {
    return sha256(`recovery-code\0${id}\0${code}`);
  }

  /** Step 1: always the same answer; if the address belongs to a citizen account, the link (or advice) is e-mailed. */
  request(email: unknown, locale: unknown, correlationId: string): boolean {
    const address = normaliseEmail(email);
    if (!address) return false;
    const job = this.send(address, typeof locale === 'string' ? locale : null, correlationId).catch((e: unknown) => {
      this.deps.log({ event: 'contact-recovery', outcome: 'error', error: String((e as Error).message ?? e).slice(0, 200), correlationId });
    });
    this.pending.add(job);
    void job.finally(() => this.pending.delete(job));
    return true;
  }

  private async send(address: string, locale: string | null, correlationId: string): Promise<void> {
    const account = await this.deps.directory.findByEmail(address);
    if (!account || !account.enabled || !account.email) {
      this.deps.log({ event: 'contact-recovery', outcome: 'no-account', correlationId });
      return;
    }
    const lang = langOf(account.locale, locale);
    const t = TEXT[lang];
    const emailDigest = createHmac('sha256', this.deps.digestKey).update(`recovery-email\0${address}`, 'utf8').digest();
    const accountDigest = createHmac('sha256', this.deps.digestKey).update(`contact-account\0citizens\0${account.id}`, 'utf8').digest();
    const id = randomUUID();
    const token = randomBytes(32).toString('base64url');
    const phone = account.phoneVerified && account.phone ? account.phone : null;
    // Without a verified number: advice instead of a link, limited like a link (the same function counts it).
    if (!(await this.deps.attempts.start(id, emailDigest, accountDigest, account.id, phone, lang, ContactRecovery.linkDigest(id, token), RECOVERY_LINK_MINUTES))) {
      this.deps.log({ event: 'contact-recovery', outcome: 'limited', correlationId });
      return;
    }
    if (!phone) {
      await this.deps.messaging.send({ to: account.email, subject: t.recoveryNoPhone.subject, text: t.recoveryNoPhone.body, purpose: 'account-recovery-advice', correlationId });
      this.deps.log({ event: 'contact-recovery', outcome: 'no-phone', correlationId });
      return;
    }
    const link = `${this.deps.appOrigin}/recover-link?${new URLSearchParams({ a: id, t: token, l: lang })}`;
    await this.deps.messaging.send({
      to: account.email, subject: t.recoveryLink.subject,
      text: fill(t.recoveryLink.body, { minutes: String(RECOVERY_LINK_MINUTES), ending: phoneEnding(phone), link }),
      purpose: 'account-recovery-link', correlationId,
    });
    this.deps.log({ event: 'contact-recovery', outcome: 'link-sent', correlationId });
  }

  /** Step 2: the link was followed; an SMS code goes to the verified number (at most 3 per link). */
  async sendCode(id: string, token: string, correlationId: string): Promise<{ phoneEnding: string; expiresAt: string }> {
    if (!UUID.test(id) || !LINK_TOKEN.test(token)) throw new RecoveryLinkNotFound();
    const code = sixDigits();
    const r = await this.deps.attempts.code(id, ContactRecovery.linkDigest(id, token), ContactRecovery.codeDigest(id, code));
    if (!r) throw new RecoveryLinkNotFound();
    try {
      await this.deps.messaging.send({ to: r.phone, subject: 'SMS', text: fill(TEXT[r.lang].recoverySms, { code, minutes: String(CODE_MINUTES) }), purpose: 'account-recovery-code', correlationId });
    } catch (e) {
      if (e instanceof MessageNotSent) throw new NotDeliverable();
      throw e;
    }
    this.deps.log({ event: 'contact-recovery', outcome: 'code-sent', correlationId });
    return { phoneEnding: phoneEnding(r.phone), expiresAt: r.codeExpiresAt.toISOString() };
  }

  /** Step 3: link and code; the account's ways to sign in are reset and an activation link e-mailed (as after eID recovery). */
  async complete(id: string, token: string, code: unknown, correlationId: string): Promise<void> {
    if (!UUID.test(id) || !LINK_TOKEN.test(token)) throw new RecoveryLinkNotFound();
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) throw new WrongCode(-1);
    const r = await this.deps.attempts.complete(id, ContactRecovery.linkDigest(id, token), ContactRecovery.codeDigest(id, code.trim()));
    if (r.outcome === 'not-found' || (r.outcome === 'recovered' && !r.subject)) throw new RecoveryLinkNotFound();
    if (r.outcome === 'wrong-code') throw new WrongCode(r.attemptsLeft);
    const before = await this.deps.directory.get(r.subject!);
    const contact = await this.deps.reset.reset(r.subject!);
    this.deps.log({ event: 'contact-recovery', outcome: contact ? 'recovered' : 'account-unavailable', correlationId });
    if (!contact) return;
    const lang = langOf(contact.locale);
    const t = TEXT[lang];
    await this.deps.messaging.send({ to: contact.email, subject: t.recoveredNotice.subject, text: fill(t.recoveredNotice.body, { date: dateIn(lang) }), purpose: 'account-recovery-notice', correlationId })
      .catch(() => this.deps.log({ event: 'security-notice', type: 'account-recovery-notice', outcome: 'not-sent', correlationId }));
    if (before?.phone && before.phoneVerified) {
      await this.deps.messaging.send({ to: before.phone, subject: 'SMS', text: t.recoveredSms, purpose: 'account-recovery-notice', correlationId })
        .catch(() => this.deps.log({ event: 'security-notice', type: 'account-recovery-notice', outcome: 'not-sent', correlationId }));
    }
  }
}
