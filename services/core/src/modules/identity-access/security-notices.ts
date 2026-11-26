import type { MessagingChannel } from '../integrations/public-api';
import type { AuthenticatorKind, SecurityNotice } from './account-security';
import type { ContextNotice } from './adaptive-context';
import type { SignInNoticeType } from './signin-events';
import type { AccountDirectory } from './keycloak-admin';
import type { Realm } from './token-verifier';

/**
 * Notices after a change to the ways of signing in (ASVS 5.0 V6.3.7; doc phase-3/12), in the person's language, to the
 * account's address. Sent through the messaging port (simulated e-mail in dev and test).
 */
const TEXT: Record<string, { subject: string; body: string; kinds: Record<AuthenticatorKind, string> }> = {
  ar: {
    subject: 'تمت إزالة وسيلة دخول من حسابك في CIVORA',
    body: 'يوم {date} أُزيلت من حسابك وسيلة الدخول التالية: {kind}. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا واتصل بالدعم.',
    kinds: { passkey: 'مفتاح المرور', 'security-key': 'مفتاح الأمان', totp: 'تطبيق المصادقة' },
  },
  fr: {
    subject: 'Un moyen de connexion a été retiré de votre compte CIVORA',
    body: 'Le {date}, ce moyen de connexion a été retiré de votre compte : {kind}. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.',
    kinds: { passkey: 'clé d’accès (passkey)', 'security-key': 'clé de sécurité', totp: 'application d’authentification' },
  },
  en: {
    subject: 'A way to sign in was removed from your CIVORA account',
    body: 'On {date}, this way to sign in was removed from your account: {kind}. If this was not you, recover your account at once and contact support.',
    kinds: { passkey: 'passkey', 'security-key': 'security key', totp: 'authenticator app' },
  },
};

export function securityNotices(directories: Partial<Record<Realm, AccountDirectory>>, messaging: MessagingChannel | null,
  log: (entry: Record<string, unknown>) => void): SecurityNotice {
  return async (realm, subject, event) => {
    const dir = directories[realm];
    if (!messaging || !dir?.contact) return;
    try {
      const contact = await dir.contact(subject);
      if (!contact) return;
      const lang = contact.locale && TEXT[contact.locale.split('-')[0]!] ? contact.locale.split('-')[0]! : 'ar';
      const t = TEXT[lang]!;
      const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date());
      await messaging.send({ to: contact.email, subject: t.subject, text: t.body.replace('{date}', date).replace('{kind}', t.kinds[event.kind]), purpose: `security-notice:${event.type}`, correlationId: subject });
    } catch (e) {
      log({ event: 'security-notice', type: event.type, outcome: 'not-sent', error: String((e as Error).message ?? e).slice(0, 200) });
    }
  };
}

/**
 * Notices from the adaptive controls (ASVS 5.0 V6.3.5, V8.2.4; doc phase-3/15): a sign-in on a new device or browser,
 * a sign-in after a long absence, a session ended because it was used from another device or browser.
 */
const CONTEXT_TEXT: Record<string, Record<'new-device' | 'long-absence' | 'session-ended', { subject: string; body: string }>> = {
  ar: {
    'new-device': { subject: 'دخول جديد إلى حسابك في CIVORA', body: 'يوم {date} تمّ الدخول إلى حسابك من جهاز أو متصفح لم يُستعمل من قبل: {label}. إن لم تكن أنت، أنهِ الجلسات الأخرى من صفحة الأمان واستعد حسابك فورًا.' },
    'long-absence': { subject: 'دخول إلى حسابك في CIVORA بعد غياب طويل', body: 'يوم {date} تمّ الدخول إلى حسابك ({label}) بعد أكثر من ستة أشهر دون أي دخول. إن لم تكن أنت، استعد حسابك فورًا واتصل بالدعم.' },
    'session-ended': { subject: 'أنهينا جلسة في حسابك في CIVORA', body: 'يوم {date} استُعملت إحدى جلساتك من جهاز أو متصفح آخر غير الذي بدأت منه ({label})، فأنهيناها احتياطًا. سجّل الدخول من جديد. إن تكرّر ذلك، غيّر وسائل الدخول واتصل بالدعم.' },
  },
  fr: {
    'new-device': { subject: 'Nouvelle connexion à votre compte CIVORA', body: 'Le {date}, une connexion à votre compte a eu lieu depuis un appareil ou un navigateur jamais utilisé auparavant : {label}. Si ce n’était pas vous, fermez les autres sessions depuis la page Sécurité et récupérez votre compte immédiatement.' },
    'long-absence': { subject: 'Connexion à votre compte CIVORA après une longue absence', body: 'Le {date}, une connexion à votre compte a eu lieu ({label}) après plus de six mois sans aucune connexion. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.' },
    'session-ended': { subject: 'Nous avons fermé une session de votre compte CIVORA', body: 'Le {date}, une de vos sessions a été utilisée depuis un autre appareil ou navigateur que celui où elle avait commencé ({label}) ; nous l’avons fermée par précaution. Reconnectez-vous. Si cela se reproduit, changez vos moyens de connexion et contactez l’assistance.' },
  },
  en: {
    'new-device': { subject: 'New sign-in to your CIVORA account', body: 'On {date}, your account was signed in to from a device or browser not used before: {label}. If this was not you, end the other sessions from the Security page and recover your account at once.' },
    'long-absence': { subject: 'Sign-in to your CIVORA account after a long absence', body: 'On {date}, your account was signed in to ({label}) after more than six months without any sign-in. If this was not you, recover your account at once and contact support.' },
    'session-ended': { subject: 'We ended a session of your CIVORA account', body: 'On {date}, one of your sessions was used from a different device or browser than the one it started on ({label}), so we ended it as a precaution. Sign in again. If this happens again, change your ways of signing in and contact support.' },
  },
};

export function contextNotices(directories: Partial<Record<Realm, AccountDirectory>>, messaging: MessagingChannel | null,
  log: (entry: Record<string, unknown>) => void): ContextNotice {
  return async (realm, subject, event) => {
    const dir = directories[realm];
    if (!messaging || !dir?.contact) return;
    try {
      const contact = await dir.contact(subject);
      if (!contact) return;
      const lang = contact.locale && CONTEXT_TEXT[contact.locale.split('-')[0]!] ? contact.locale.split('-')[0]! : 'ar';
      const t = CONTEXT_TEXT[lang]![event.type];
      const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date());
      await messaging.send({ to: contact.email, subject: t.subject, text: t.body.replace('{date}', date).replace('{label}', event.label), purpose: `security-notice:${event.type}`, correlationId: subject });
    } catch (e) {
      log({ event: 'security-notice', type: event.type, outcome: 'not-sent', error: String((e as Error).message ?? e).slice(0, 200) });
    }
  };
}

/**
 * Notices from Keycloak's sign-in events (ASVS 5.0 V6.3.5, V6.3.7; doc phase-3/15 §7): a right password with a failed
 * second step, repeated failures, a sign-in after failures, a way to sign in added, changed or removed on Keycloak's pages.
 */
const SIGNIN_TEXT: Record<string, { texts: Record<SignInNoticeType, { subject: string; body: string }>; kinds: Record<string, string>; anyKind: string }> = {
  ar: {
    texts: {
      'second-factor-failed': { subject: 'محاولة دخول إلى حسابك في CIVORA: كلمة السر صحيحة والخطوة الثانية فشلت', body: 'يوم {date} أُدخلت كلمة سر حسابك بشكل صحيح لكن الخطوة الثانية ({kind}) فشلت. إن لم تكن أنت، فكلمة سرك معروفة لغيرك: استعد حسابك فورًا واتصل بالدعم.' },
      'failed-attempts': { subject: 'محاولات دخول فاشلة إلى حسابك في CIVORA', body: 'يوم {date} فشلت {count} محاولات للدخول إلى حسابك. يتوقف الدخول مؤقتًا بعد المحاولات الفاشلة المتكررة. إن لم تكن أنت، لا يلزمك شيء الآن؛ وإن تكرّر ذلك، اتصل بالدعم.' },
      'signed-in-after-failures': { subject: 'دخول إلى حسابك في CIVORA بعد محاولات فاشلة', body: 'يوم {date} تمّ الدخول إلى حسابك بعد {count} محاولات فاشلة. إن لم تكن أنت، أنهِ الجلسات الأخرى من صفحة الأمان واستعد حسابك فورًا.' },
      'credential-added': { subject: 'أُضيفت أو غُيّرت وسيلة دخول في حسابك في CIVORA', body: 'يوم {date} أُضيفت أو غُيّرت وسيلة الدخول التالية في حسابك: {kind}. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا واتصل بالدعم.' },
      'credential-removed': { subject: 'تمت إزالة وسيلة دخول من حسابك في CIVORA', body: 'يوم {date} أُزيلت من حسابك وسيلة الدخول التالية: {kind}. إن لم تكن أنت من قام بذلك، استعد حسابك فورًا واتصل بالدعم.' },
    },
    kinds: { password: 'كلمة السر', otp: 'تطبيق المصادقة', webauthn: 'مفتاح الأمان', 'webauthn-passwordless': 'مفتاح المرور' },
    anyKind: 'وسيلة دخول',
  },
  fr: {
    texts: {
      'second-factor-failed': { subject: 'Tentative de connexion à votre compte CIVORA : mot de passe correct, deuxième étape échouée', body: 'Le {date}, le mot de passe de votre compte a été saisi correctement mais la deuxième étape ({kind}) a échoué. Si ce n’était pas vous, votre mot de passe est connu d’un tiers : récupérez votre compte immédiatement et contactez l’assistance.' },
      'failed-attempts': { subject: 'Tentatives de connexion échouées sur votre compte CIVORA', body: 'Le {date}, {count} tentatives de connexion à votre compte ont échoué. La connexion est suspendue un moment après des échecs répétés. Si ce n’était pas vous, rien n’est à faire pour l’instant ; si cela se reproduit, contactez l’assistance.' },
      'signed-in-after-failures': { subject: 'Connexion à votre compte CIVORA après des tentatives échouées', body: 'Le {date}, une connexion à votre compte a réussi après {count} tentatives échouées. Si ce n’était pas vous, fermez les autres sessions depuis la page Sécurité et récupérez votre compte immédiatement.' },
      'credential-added': { subject: 'Un moyen de connexion a été ajouté ou modifié sur votre compte CIVORA', body: 'Le {date}, ce moyen de connexion a été ajouté ou modifié sur votre compte : {kind}. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.' },
      'credential-removed': { subject: 'Un moyen de connexion a été retiré de votre compte CIVORA', body: 'Le {date}, ce moyen de connexion a été retiré de votre compte : {kind}. Si ce n’était pas vous, récupérez votre compte immédiatement et contactez l’assistance.' },
    },
    kinds: { password: 'mot de passe', otp: 'application d’authentification', webauthn: 'clé de sécurité', 'webauthn-passwordless': 'clé d’accès (passkey)' },
    anyKind: 'moyen de connexion',
  },
  en: {
    texts: {
      'second-factor-failed': { subject: 'Sign-in attempt on your CIVORA account: right password, second step failed', body: 'On {date}, your account\'s password was entered correctly but the second step ({kind}) failed. If this was not you, someone knows your password: recover your account at once and contact support.' },
      'failed-attempts': { subject: 'Failed attempts to sign in to your CIVORA account', body: 'On {date}, {count} attempts to sign in to your account failed. Signing in pauses for a while after repeated failures. If this was not you, nothing is needed now; if it happens again, contact support.' },
      'signed-in-after-failures': { subject: 'Sign-in to your CIVORA account after failed attempts', body: 'On {date}, your account was signed in to after {count} failed attempts. If this was not you, end the other sessions from the Security page and recover your account at once.' },
      'credential-added': { subject: 'A way to sign in was added or changed on your CIVORA account', body: 'On {date}, this way to sign in was added or changed on your account: {kind}. If this was not you, recover your account at once and contact support.' },
      'credential-removed': { subject: 'A way to sign in was removed from your CIVORA account', body: 'On {date}, this way to sign in was removed from your account: {kind}. If this was not you, recover your account at once and contact support.' },
    },
    kinds: { password: 'password', otp: 'authenticator app', webauthn: 'security key', 'webauthn-passwordless': 'passkey' },
    anyKind: 'a way to sign in',
  },
};

export type SignInNotice = (realm: Realm, userId: string, n: { type: SignInNoticeType; count?: number; credential?: string }) => Promise<void>;

/** Sends a sign-in notice to the account's address in its language; throws when it could not be sent (the caller logs). */
export function signInNotices(directories: Partial<Record<Realm, AccountDirectory>>, messaging: MessagingChannel | null): SignInNotice {
  return async (realm, userId, n) => {
    const dir = directories[realm];
    if (!messaging || !dir?.contact) return;
    const contact = await dir.contact(userId);
    if (!contact) return;
    const lang = contact.locale && SIGNIN_TEXT[contact.locale.split('-')[0]!] ? contact.locale.split('-')[0]! : 'ar';
    const t = SIGNIN_TEXT[lang]!;
    const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Tunis' }).format(new Date());
    const kind = (n.credential && t.kinds[n.credential]) || t.anyKind;
    const text = t.texts[n.type].body.replace('{date}', date).replace('{kind}', kind).replace('{count}', String(n.count ?? ''));
    await messaging.send({ to: contact.email, subject: t.texts[n.type].subject, text, purpose: `security-notice:${n.type}`, correlationId: userId });
  };
}
