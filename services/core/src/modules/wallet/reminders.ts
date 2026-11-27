import type { PersonContacts } from '../identity-access/public-api';
import type { MessagingChannel } from '../integrations/public-api';

/**
 * Expiry reminders (P4-D5) with a renewal deep-link (P4-F6; doc phase-4/06). For each wallet entry, every reminder
 * threshold of its type (days before expiry; 30 and 7 for types of other issuers) is sent once, in the person's
 * language, to the e-mail address of their citizen account. The link opens the renewal service's page in the
 * catalogue (Phase 5) when the type names one. The message names the type and the date only: no claim of the
 * credential (the cell does not hold them).
 */
export interface DueReminder {
  entryId: string;
  personId: string;
  vct: string;
  expiresAt: Date;
  threshold: number;
  renewalServiceSlug: string | null;
  display: Record<string, string> | null;
}

const TEXT: Record<'ar' | 'fr' | 'en', { subject: string; body: string; renew: string; ask: string; fallbackType: string }> = {
  ar: {
    subject: 'وثيقة في محفظتك الرقمية تنتهي صلاحيتها قريبًا',
    body: 'تنتهي صلاحية «{type}» في محفظتك الرقمية يوم {date}، أي بعد {days} يومًا.',
    renew: 'يمكنك طلب تجديدها من هنا: {link}',
    ask: 'لتجديدها، اتصل بالجهة التي أصدرتها.',
    fallbackType: 'وثيقة رقمية',
  },
  fr: {
    subject: 'Un document de votre portefeuille numérique expire bientôt',
    body: '« {type} » dans votre portefeuille numérique expire le {date}, dans {days} jours.',
    renew: 'Vous pouvez demander son renouvellement ici : {link}',
    ask: 'Pour le renouveler, contactez l\'organisme qui l\'a délivré.',
    fallbackType: 'Document numérique',
  },
  en: {
    subject: 'A document in your digital wallet expires soon',
    body: '"{type}" in your digital wallet expires on {date}, in {days} days.',
    renew: 'You can ask for its renewal here: {link}',
    ask: 'To renew it, contact the organisation that issued it.',
    fallbackType: 'Digital document',
  },
};

export class ExpiryReminders {
  constructor(private readonly d: {
    due(limit: number): Promise<DueReminder[]>;
    mark(entryId: string, threshold: number): Promise<boolean>;
    contacts: PersonContacts;
    messaging: MessagingChannel;
    /** Origin of the citizen web app (the catalogue's service pages, Phase 5). */
    appOrigin: string;
    log(entry: Record<string, unknown>): void;
    now?: () => number;
  }) {}

  /** One pass: sends what is due (at most `limit`); a failed send is retried on the next pass. */
  async runOnce(limit = 200): Promise<{ sent: number; noContact: number; failed: number }> {
    const out = { sent: 0, noContact: 0, failed: 0 };
    for (const r of await this.d.due(limit)) {
      try {
        const contact = await this.d.contacts.contactOf(r.personId);
        if (!contact) {
          // Nobody to tell: recorded as handled so it is not looked up again every hour.
          await this.d.mark(r.entryId, r.threshold);
          out.noContact++;
          continue;
        }
        const lang = (['ar', 'fr', 'en'] as const).find((l) => contact.locale.startsWith(l)) ?? 'ar';
        const t = TEXT[lang];
        const now = this.d.now ? this.d.now() : Date.now();
        const days = Math.max(1, Math.ceil((r.expiresAt.getTime() - now) / 86_400_000));
        const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Tunis' }).format(r.expiresAt);
        const type = r.display?.[lang] ?? t.fallbackType;
        const link = r.renewalServiceSlug ? `${this.d.appOrigin}/${lang}/services/${encodeURIComponent(r.renewalServiceSlug)}` : null;
        const text = `${t.body.replace('{type}', type).replace('{date}', date).replace('{days}', String(days))}\n\n${link ? t.renew.replace('{link}', link) : t.ask}`;
        await this.d.messaging.send({ to: contact.email, subject: t.subject, text, purpose: 'wallet-expiry-reminder', correlationId: r.entryId });
        await this.d.mark(r.entryId, r.threshold);
        out.sent++;
      } catch (e) {
        out.failed++;
        this.d.log({ event: 'wallet.reminder', outcome: 'not-sent', entry: r.entryId, error: String((e as Error).message ?? e).slice(0, 200) });
      }
    }
    if (out.sent || out.noContact || out.failed) this.d.log({ event: 'wallet.reminders', ...out });
    return out;
  }
}
