import { notFound } from 'next/navigation';
import { Notice } from '@/components/Notice';
import { isLang } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { startContactRecovery, startRecovery } from './actions';

/** Account recovery by re-proofing at the national eID (P3-SEC4; doc phase-3/12). Public: no sign-in possible. */
export default async function Recover({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  return (
    <section>
      <h1>{t.t('recover.title')}</h1>
      <Notice t={t} notice={notice} />
      <p>{t.t('recover.intro')}</p>
      <p className="notice notice-info" data-testid="recover-simulated">{t.t('recover.simulated')}</p>
      <form action={startRecovery}><input type="hidden" name="lang" value={lang} />
        <button type="submit" data-testid="recover-start">{t.t('recover.start')}</button></form>
      <h2>{t.t('recover.contact.title')}</h2>
      <p>{t.t('recover.contact.intro')}</p>
      <form action={startContactRecovery} className="stack"><input type="hidden" name="lang" value={lang} />
        <label>{t.t('recover.contact.email')}<input type="email" name="email" autoComplete="email" required maxLength={254} data-testid="recover-contact-email" /></label>
        <button type="submit" data-testid="recover-contact-start">{t.t('recover.contact.start')}</button></form>
      <h2>{t.t('recover.counter.title')}</h2>
      <p data-testid="recover-assisted">{t.t('recover.noEid')}</p>
    </section>
  );
}
