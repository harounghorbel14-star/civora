import { notFound } from 'next/navigation';
import { reportTarget } from '@/lib/directory';
import { isLang } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { ReportForm } from './ReportForm';

/**
 * "Report an error" on a procedure (P5-F4; doc phase-5/03), linked from each static service page as
 * /<lang>/services/report?code=TN-…&v=<n>&slug=<slug>. Anonymous: only the message is asked for and kept.
 */
export default async function ReportError({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const target = reportTarget(sp.code, sp.v);
  if (!target) notFound();
  const slug = typeof sp.slug === 'string' && /^[a-z0-9][a-z0-9-]{2,80}$/.test(sp.slug) ? sp.slug : null;
  const t = translator(lang);
  const keys = ['label', 'hint', 'submit', 'sent', 'invalid', 'unknown', 'busy', 'unavailable'];
  const text = Object.fromEntries(keys.map((k) => [k, t.t(`services.report.${k}`)]));
  return (
    <section>
      <h1>{t.t('services.report.title')}</h1>
      <p data-testid="report-about">{t.t('services.report.about', { code: target.code, version: target.version })}</p>
      <p>{t.t('services.report.intro')}</p>
      <ReportForm lang={lang} code={target.code} version={target.version} text={text} />
      <p><a href={slug ? `/${lang}/services/${slug}/` : `/${lang}/services/`}>{t.t('services.report.back')}</a></p>
    </section>
  );
}
