import { notFound } from 'next/navigation';
import { formatDate } from '@civora/i18n';
import { isLang, LOCALES } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { Notice } from '@/components/Notice';
import { core, requireSession } from '@/server/context';
import { addAuthenticator, cancelContactChange, confirmContactChange, endSession, removeAuthenticator, removePhone, startContactChange } from '../actions';

interface SessionRow { id: string; current: boolean; startedAt: string; lastAccessAt: string; ipAddress: string | null }
interface AuthRow { id: string; kind: string; label: string | null; createdAt: string | null }
interface ContactRow { email: string | null; phone: string | null; phoneVerified: boolean }

export default async function Security({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const here = `/${lang}/security`;
  const session = await requireSession(here);
  const [sessions, auths, contactRes] = await Promise.all([core<SessionRow[]>(session, '/v1/me/sessions', here), core<AuthRow[]>(session, '/v1/me/authenticators', here),
    core<ContactRow>(session, '/v1/me/contact', here)]);
  const contact = contactRes.status === 200 ? contactRes.body : null;
  const pending = session.contactChange && Date.parse(session.contactChange.expiresAt) > Date.now() ? session.contactChange : null;
  const hidden = <input type="hidden" name="lang" value={lang} />;
  const date = (iso: string | null) => (iso ? formatDate(new Date(iso), LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  return (
    <section>
      <h1>{t.t('security.title')}</h1>
      <Notice t={t} notice={notice} />
      {notice === 'stepUp' && (
        <p><a className="button" data-testid="step-up" href={`/auth/login?${new URLSearchParams({ returnTo: `${here}?confirmed=1`, reauth: '1' })}`}>{t.t('stepUp.confirm')}</a></p>
      )}
      {contact && (
        <>
          <h2>{t.t('security.contact')}</h2>
          <p>{t.t('security.contact.why')}</p>
          <dl className="facts" data-testid="contact">
            <dt>{t.t('security.email')}</dt><dd><bdi data-testid="contact-email">{contact.email ?? '—'}</bdi></dd>
            <dt>{t.t('security.phone')}</dt><dd><bdi data-testid="contact-phone">{contact.phone ?? t.t('security.phone.none')}</bdi></dd>
          </dl>
          {pending ? (
            <form action={confirmContactChange} className="stack" data-testid="contact-confirm">{hidden}
              <p>{pending.channel === 'email' ? t.t('security.contact.codeSentEmail', { target: pending.target }) : t.t('security.contact.codeSentPhone', { target: pending.target })}</p>
              <label>{t.t('security.contact.code')}
                <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required data-testid="contact-code" /></label>
              <div className="row">
                <button type="submit" data-testid="contact-code-confirm">{t.t('security.contact.confirm')}</button>
                <button type="submit" formAction={cancelContactChange} formNoValidate className="secondary" data-testid="contact-cancel">{t.t('security.contact.cancel')}</button>
              </div>
            </form>
          ) : (
            <div className="row">
              <form action={startContactChange} className="stack">{hidden}<input type="hidden" name="channel" value="email" />
                <label>{t.t('security.contact.new.email')}<input type="email" name="value" autoComplete="email" required maxLength={254} data-testid="contact-new-email" /></label>
                <button type="submit" data-testid="contact-change-email">{t.t('security.email.change')}</button></form>
              <form action={startContactChange} className="stack">{hidden}<input type="hidden" name="channel" value="phone" />
                <label>{t.t('security.contact.new.phone')}<input type="tel" name="value" autoComplete="tel" required maxLength={20} dir="ltr" data-testid="contact-new-phone" /></label>
                <button type="submit" data-testid="contact-change-phone">{t.t('security.phone.set')}</button></form>
              {contact.phone && (
                <form action={removePhone}>{hidden}<button type="submit" className="secondary" data-testid="contact-remove-phone">{t.t('security.phone.remove')}</button></form>
              )}
            </div>
          )}
        </>
      )}
      <h2>{t.t('security.authenticators')}</h2>
      <ul className="list" data-testid="authenticators">
        {(auths.status === 200 ? auths.body : []).map((a) => (
          <li key={a.id} data-kind={a.kind}>
            <span><strong>{t.t(`security.kind.${a.kind}`)}</strong>{a.label ? ` — ${a.label}` : ''} <small>{t.t('security.added', { date: date(a.createdAt) })}</small></span>
            <form action={removeAuthenticator}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="id" value={a.id} />
              <button type="submit" className="secondary" data-testid={`remove-${a.kind}`}>{t.t('security.remove')}</button></form>
          </li>
        ))}
      </ul>
      <div className="row">
        {(['passkey', 'totp'] as const).map((kind) => (
          <form key={kind} action={addAuthenticator}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="kind" value={kind} />
            <button type="submit" data-testid={`add-${kind}`}>{t.t(`security.add.${kind}`)}</button></form>
        ))}
      </div>
      <h2>{t.t('security.sessions')}</h2>
      <ul className="list" data-testid="sessions">
        {(sessions.status === 200 ? sessions.body : []).map((s) => (
          <li key={s.id} data-current={s.current ? 'yes' : 'no'}>
            <span>
              {s.current && <strong>{t.t('security.thisDevice')} · </strong>}
              {t.t('security.session.started', { date: date(s.startedAt) })} · {t.t('security.session.lastSeen', { date: date(s.lastAccessAt) })}
              {s.ipAddress ? <> · <bdi>{t.t('security.session.address', { ip: s.ipAddress })}</bdi></> : null}
            </span>
            <form action={endSession}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="id" value={s.id} /><input type="hidden" name="current" value={s.current ? '1' : '0'} />
              <button type="submit" className="secondary" data-testid={s.current ? 'end-current' : 'end-other'}>{t.t('security.session.end')}</button></form>
          </li>
        ))}
      </ul>
    </section>
  );
}
