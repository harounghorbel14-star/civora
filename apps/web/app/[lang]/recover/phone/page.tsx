import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/Notice';
import { recoveryLinkCookie } from '@/lib/cookies';
import { isLang } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { config, store } from '@/server/context';
import { completeContactRecovery, sendRecoveryCode } from '../actions';

/** Recovery R4, after the e-mailed link (doc phase-3/16): an SMS code to the verified number, then the reset. Public. */
export default async function RecoverByPhone({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const link = store().getRecoveryLink((await cookies()).get(recoveryLinkCookie(config(), lang).name)?.value);
  return (
    <section>
      <h1>{t.t('recover.phone.title')}</h1>
      <Notice t={t} notice={notice} />
      {!link ? (
        <p data-testid="recover-phone-expired">{t.t('recover.phone.expired')} <a href={`/${lang}/recover`}>{t.t('recover.title')}</a></p>
      ) : (
        <>
          <p>{t.t('recover.phone.intro')}</p>
          <p className="notice notice-info">{t.t('recover.phone.simulated')}</p>
          {link.phoneEnding ? (
            <>
              <p data-testid="recover-phone-sent">{t.t('recover.phone.sent', { ending: link.phoneEnding })}</p>
              <form action={completeContactRecovery} className="stack"><input type="hidden" name="lang" value={lang} />
                <label>{t.t('recover.phone.code')}
                  <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required data-testid="recover-phone-code" /></label>
                <button type="submit" data-testid="recover-phone-complete">{t.t('recover.phone.complete')}</button>
              </form>
            </>
          ) : null}
          <form action={sendRecoveryCode}><input type="hidden" name="lang" value={lang} />
            <button type="submit" className={link.phoneEnding ? 'secondary' : undefined} data-testid="recover-phone-send">{t.t(link.phoneEnding ? 'recover.phone.resend' : 'recover.phone.send')}</button></form>
        </>
      )}
    </section>
  );
}
