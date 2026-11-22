import { notFound } from 'next/navigation';
import { formatDate } from '@civora/i18n';
import { isLang, LOCALES } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { Notice } from '@/components/Notice';
import { core, requireSession } from '@/server/context';
import { startEidLink } from '../actions';

interface Claim { type: string; source: string; loa: string; verifiedAt: string }

export default async function Identity({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const here = `/${lang}/identity`;
  const session = await requireSession(here);
  const r = await core<Claim[]>(session, '/v1/identity/links', here);
  const link = (r.status === 200 ? r.body : []).find((c) => c.type === 'national-id-link');
  return (
    <section>
      <h1>{t.t('identity.title')}</h1>
      <Notice t={t} notice={notice} />
      {notice === 'stepUp' && (
        <p><a className="button" data-testid="step-up" href={`/auth/login?${new URLSearchParams({ returnTo: `${here}?confirmed=1`, reauth: '1' })}`}>{t.t('stepUp.confirm')}</a></p>
      )}
      <p>{t.t('identity.intro')}</p>
      <p className="notice notice-info">{t.t('identity.simulated')}</p>
      <p data-testid="identity-state" data-linked={link ? 'yes' : 'no'}>
        {link ? t.t('identity.linked', { loa: link.loa, date: formatDate(new Date(link.verifiedAt), LOCALES[lang]) }) : t.t('identity.none')}
      </p>
      <form action={startEidLink}><input type="hidden" name="lang" value={lang} />
        <button type="submit" data-testid="eid-link">{t.t('identity.link')}</button></form>
    </section>
  );
}
