'use server';

import { formatDate } from '@civora/i18n';
import { publicCoreCall } from '@/lib/core';
import { isLang, LOCALES } from '@/lib/locales';
import { config, correlationId } from '@/server/context';

/** The page's state: kept in the page (useActionState), never in a URL. */
export type StatusState =
  | { step: 'reference'; error?: 'invalid' | 'unavailable' | 'error' }
  | { step: 'code'; reference: string; challengeId: string; error?: 'wrong' }
  | { step: 'status'; reference: string; institution: string; status: string; since: string };

const REF = /^[A-Za-z0-9-]{6,40}$/;
const UUID = /^[0-9a-f-]{36}$/;

export async function statusStep(prev: StatusState, form: FormData): Promise<StatusState> {
  const lang = isLang(form.get('lang')) ? (form.get('lang') as keyof typeof LOCALES) : 'ar';
  const cid = await correlationId();
  if (form.get('step') === 'code' && prev.step === 'code') {
    const code = String(form.get('code') ?? '').trim();
    if (!/^\d{6}$/.test(code) || !UUID.test(prev.challengeId)) return { ...prev, error: 'wrong' };
    const r = await publicCoreCall<{ reference: string; institution: string; status: string; since: string }>(config(),
      `/v1/status-access/${prev.challengeId}:verify`, { reference: prev.reference, code }, cid);
    if (r.status !== 200) return { ...prev, error: 'wrong' };
    const since = /^\d{4}-\d{2}-\d{2}$/.test(r.body.since) ? formatDate(new Date(`${r.body.since}T12:00:00Z`), LOCALES[lang], { dateStyle: 'long' }) : r.body.since;
    return { step: 'status', reference: r.body.reference, institution: r.body.institution, status: r.body.status, since };
  }
  const reference = String(form.get('reference') ?? '').trim();
  if (!REF.test(reference)) return { step: 'reference', error: 'invalid' };
  const r = await publicCoreCall<{ challengeId: string }>(config(), '/v1/status-access', { reference, locale: LOCALES[lang] }, cid);
  if (r.status === 202 && UUID.test(r.body.challengeId)) return { step: 'code', reference, challengeId: r.body.challengeId };
  return { step: 'reference', error: r.status === 503 ? 'unavailable' : r.status === 400 ? 'invalid' : 'error' };
}
