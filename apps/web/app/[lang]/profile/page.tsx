import { notFound } from 'next/navigation';
import { isLang, LANGS, LOCALES } from '@/lib/locales';
import { translator } from '@/lib/messages';
import { Notice } from '@/components/Notice';
import { core, requireSession } from '@/server/context';
import { savePreferences } from '../actions';

const NATIVE = { ar: 'العربية', fr: 'Français', en: 'English' } as const;

export default async function Profile({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = translator(lang);
  const { notice } = await searchParams;
  const session = await requireSession(`/${lang}/profile`);
  const me = await core<{ preferredLocale: string; accessibility: Record<string, unknown> }>(session, '/v1/me', `/${lang}/profile`);
  const a = me.status === 200 ? me.body.accessibility ?? {} : {};
  const preferred = me.status === 200 ? me.body.preferredLocale : LOCALES[lang];
  const checkbox = (name: string) => (
    <label className="check"><input type="checkbox" name={name} defaultChecked={a[name] === true} data-testid={`pref-${name}`} /> {t.t(`profile.${name}`)}</label>
  );
  return (
    <section>
      <h1>{t.t('profile.title')}</h1>
      <Notice t={t} notice={notice} />
      <form action={savePreferences} className="stack">
        <input type="hidden" name="lang" value={lang} />
        <label>{t.t('profile.language')}
          <select name="preferredLocale" defaultValue={preferred} data-testid="pref-locale">
            {LANGS.map((l) => <option key={l} value={LOCALES[l]} lang={LOCALES[l]}>{NATIVE[l]}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{t.t('profile.accessibility')}</legend>
          <label>{t.t('profile.textSize')}
            <select name="textSize" defaultValue={typeof a.textSize === 'string' ? a.textSize : 'default'} data-testid="pref-textSize">
              {['default', 'large', 'x-large'].map((v) => <option key={v} value={v}>{t.t(`profile.textSize.${v}`)}</option>)}
            </select>
          </label>
          {checkbox('highContrast')}
          {checkbox('reducedMotion')}
          {checkbox('simplifiedLanguage')}
          {checkbox('screenReaderHints')}
        </fieldset>
        <button type="submit" data-testid="pref-save">{t.t('profile.save')}</button>
      </form>
    </section>
  );
}
