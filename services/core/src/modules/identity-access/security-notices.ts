import type { MessagingChannel } from '../integrations/public-api';
import type { AuthenticatorKind, SecurityNotice } from './account-security';
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
