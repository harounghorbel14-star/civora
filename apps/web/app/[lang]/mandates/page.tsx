import { notFound } from 'next/navigation';
import { formatDate } from '@civora/i18n';
import { isLang, LOCALES } from '@/lib/locales';
import { describeScopes, translator } from '@/lib/messages';
import { Notice } from '@/components/Notice';
import { core, requireSession, store } from '@/server/context';
import { acceptMandate, actOnBehalf, createMandate, revokeMandate } from '../actions';

interface Mandate { id: string; role: 'principal' | 'agent'; status: string; scopes: string[]; expiresAt: string }
interface MandateEvent { action: string; actorRole: string; at: string }

/** Scopes offered when giving a mandate (identity and mandates themselves can never be delegated). */
const OFFERED = ['cases:read', 'cases:submit', 'documents:read', 'appointments:manage', 'payments:read', 'benefits:read'];

export default async function Mandates({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const here = `/${lang}/mandates`;
  const session = await requireSession(here);
  const flash = session.flash;
  if (flash) store().update(session.id, { flash: undefined }); // the one-time code is shown once, never put in a URL
  const list = await core<Mandate[]>(session, '/v1/mandates', here);
  const mandates = list.status === 200 ? list.body : [];
  const events = await Promise.all(mandates.map((m) => core<MandateEvent[]>(session, `/v1/mandates/${m.id}/events`, here)));
  const date = (iso: string) => formatDate(new Date(iso), LOCALES[lang]);
  const inMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return (
    <section>
      <h1>{t.t('mandates.title')}</h1>
      <Notice t={t} notice={notice} />
      <p>{t.t('mandates.intro')}</p>
      {flash && (
        <div className="notice notice-success" role="status" data-testid="mandate-code">
          <p>{t.t('mandates.code')}</p>
          <p>{t.t('mandates.id')}: <code dir="ltr" data-testid="mandate-id">{flash.mandateId}</code></p>
          <p><code dir="ltr" data-testid="mandate-invitation">{flash.mandateCode}</code></p>
        </div>
      )}
      <ul className="list" data-testid="mandates">
        {mandates.length === 0 && <li>{t.t('mandates.none')}</li>}
        {mandates.map((m, i) => (
          <li key={m.id} data-mandate={m.id} data-role={m.role} data-status={m.status} className="mandate">
            <div>
              <strong>{t.t(`mandates.role.${m.role}`)}</strong> · {t.t(`mandates.status.${m.status}`)} · <bdi dir="ltr">{m.id.slice(0, 8)}</bdi>
              <p>{describeScopes(t, m.scopes)} · {t.t('mandates.expires')} {date(m.expiresAt)}</p>
              <details>
                <summary>{t.t('mandates.history')}</summary>
                <ol data-testid="mandate-events">
                  {(events[i]?.status === 200 ? events[i]!.body : []).map((e, j) => (
                    <li key={j} data-action={e.action}>{t.t(`mandates.event.${e.action}`)} · {date(e.at)}</li>
                  ))}
                </ol>
              </details>
            </div>
            <div className="row">
              {m.role === 'agent' && m.status === 'active' && (
                <form action={actOnBehalf}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="id" value={m.id} />
                  <button type="submit" data-testid="act">{t.t('mandates.act')}</button></form>
              )}
              {(m.status === 'active' || m.status === 'proposed') && (
                <form action={revokeMandate}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="secondary" data-testid="revoke">{t.t('mandates.revoke')}</button></form>
              )}
            </div>
          </li>
        ))}
      </ul>
      <h2>{t.t('mandates.create')}</h2>
      <form action={createMandate} className="stack" data-testid="mandate-create">
        <input type="hidden" name="lang" value={lang} />
        <fieldset>
          <legend>{t.t('mandates.scopes')}</legend>
          {OFFERED.map((s) => <label key={s} className="check"><input type="checkbox" name="scope" value={s} data-scope={s} /> {describeScopes(t, [s])}</label>)}
        </fieldset>
        <label>{t.t('mandates.expires')} <input type="date" name="expires" defaultValue={inMonth} required data-testid="mandate-expires" /></label>
        <button type="submit" data-testid="mandate-submit">{t.t('mandates.create')}</button>
      </form>
      <h2>{t.t('mandates.accept')}</h2>
      <form action={acceptMandate} className="stack" data-testid="mandate-accept">
        <input type="hidden" name="lang" value={lang} />
        <label>{t.t('mandates.id')} <input name="id" dir="ltr" autoComplete="off" required data-testid="accept-id" /></label>
        <label>{t.t('mandates.invitationCode')} <input name="code" dir="ltr" autoComplete="off" required data-testid="accept-code" /></label>
        <button type="submit" data-testid="accept-submit">{t.t('mandates.accept')}</button>
      </form>
    </section>
  );
}
