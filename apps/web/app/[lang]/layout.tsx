import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { dirOf, isLang, LANGS, LOCALES, type Lang } from '@/lib/locales';
import { describeScopes, translator } from '@/lib/messages';
import { formatDate } from '@civora/i18n';
import { core, currentSession } from '@/server/context';
import { signOut, stopActing } from './actions';
import './globals.css';

const NATIVE: Record<Lang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };

export const dynamic = 'force-dynamic';

export default async function LangLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const h = await headers();
  const path = h.get('x-pathname') ?? `/${lang}`;
  const rest = path.split('/').slice(2).join('/');
  const session = await currentSession();
  let a11y: Record<string, unknown> = {};
  if (session) {
    const me = await core<{ accessibility?: Record<string, unknown> }>(session, '/v1/me', path).catch(() => null);
    a11y = me?.status === 200 ? me.body.accessibility ?? {} : {};
  }
  const nav: [string, string][] = session
    ? [['', 'nav.home'], ['profile', 'nav.profile'], ['security', 'nav.security'], ['identity', 'nav.identity'], ['mandates', 'nav.mandates'], ['status', 'nav.status'], ['services/search', 'nav.services']]
    : [['', 'nav.home'], ['status', 'nav.status'], ['services/search', 'nav.services']];
  return (
    <html lang={LOCALES[lang]} dir={dirOf(lang)}
      data-text-size={typeof a11y.textSize === 'string' ? a11y.textSize : 'default'}
      data-contrast={a11y.highContrast === true ? 'high' : 'normal'}
      data-motion={a11y.reducedMotion === true ? 'reduced' : 'normal'}
      data-simplified={a11y.simplifiedLanguage === true ? 'yes' : 'no'}>
      <body>
        <a className="skip" href="#main">{t.t('nav.skip')}</a>
        <header className="top">
          <div className="brand"><a href={`/${lang}`}>{t.t('app.name')}</a><span className="tagline">{t.t('app.tagline')}</span></div>
          <nav aria-label={t.t('app.name')}>
            <ul>{nav.map(([href, key]) => <li key={key}><a href={`/${lang}${href ? `/${href}` : ''}`} aria-current={path === `/${lang}${href ? `/${href}` : ''}` ? 'page' : undefined}>{t.t(key)}</a></li>)}</ul>
          </nav>
          <div className="account">
            <nav aria-label={t.t('nav.language')} className="langs">
              {LANGS.map((l) => <a key={l} href={`/${l}${rest ? `/${rest}` : ''}`} lang={LOCALES[l]} hrefLang={LOCALES[l]} aria-current={l === lang ? 'true' : undefined} data-lang={l}>{NATIVE[l]}</a>)}
            </nav>
            {session
              ? <form action={signOut}><input type="hidden" name="lang" value={lang} /><button type="submit" className="link" data-testid="sign-out">{t.t('auth.signOut')}</button></form>
              : <><a className="button" href={`/auth/login?${new URLSearchParams({ returnTo: path })}`} data-testid="sign-in">{t.t('auth.signIn')}</a>
                <a href={`/${lang}/recover`} data-testid="recover-link">{t.t('recover.link')}</a></>}
          </div>
        </header>
        {session?.acting && (
          <div className="acting" role="status" data-testid="acting-banner">
            <p>{t.t('acting.banner', { id: session.acting.mandateId.slice(0, 8), scopes: describeScopes(t, session.acting.scopes), date: formatDate(new Date(session.acting.expiresAt), LOCALES[lang]) })}</p>
            <form action={stopActing}><input type="hidden" name="lang" value={lang} /><button type="submit" className="secondary" data-testid="stop-acting">{t.t('acting.stop')}</button></form>
          </div>
        )}
        <main id="main" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
