import { notFound } from 'next/navigation';
import { isLang } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { StatusForm } from './StatusForm';

/** Customer status page (P3-R2): public, no account; a one-time code to the contact on file. */
export default async function Status({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const keys = ['reference', 'send', 'sent', 'code', 'show', 'wrong', 'result', 'again', 'unavailable', 'invalid'];
  const text = Object.fromEntries(keys.map((k) => [k, t.t(`status.${k}`)]));
  text.error = t.t('error.generic');
  const states = Object.fromEntries(['received', 'in-analysis', 'information-requested', 'decided'].map((s) => [s, t.t(`status.state.${s}`)]));
  return (
    <section>
      <h1>{t.t('status.title')}</h1>
      <p>{t.t('status.intro')}</p>
      <StatusForm lang={lang} text={text} states={states} />
    </section>
  );
}
