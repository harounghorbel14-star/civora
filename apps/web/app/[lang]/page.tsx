import { notFound } from 'next/navigation';
import { isLang } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { Notice } from '@/components/Notice';
import { currentSession } from '@/server/context';

export default async function Home({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const session = await currentSession();
  return (
    <section>
      <h1>{t.t('home.title')}</h1>
      <Notice t={t} notice={notice} />
      {session ? (
        <>
          <p data-testid="signed-in">{t.t('home.signedIn')}</p>
          <ul className="cards">
            {(['profile', 'security', 'identity', 'mandates'] as const).map((p) => <li key={p}><a href={`/${lang}/${p}`}>{t.t(`nav.${p}`)}</a></li>)}
          </ul>
        </>
      ) : (
        <>
          <p>{t.t('home.intro')}</p>
          <p><a className="button" href={`/auth/login?${new URLSearchParams({ returnTo: `/${lang}` })}`}>{t.t('auth.signIn')}</a></p>
        </>
      )}
    </section>
  );
}
