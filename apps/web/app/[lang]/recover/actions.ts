'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { recoveryCookie, recoveryLinkCookie } from '@/lib/cookies';
import { publicCoreCall } from '@/lib/core';
import { isLang, LOCALES, type Lang } from '@/lib/locales';
import { config, correlationId, store } from '@/server/context';

const langOf = (form: FormData): Lang => {
  const raw = form.get('lang');
  return typeof raw === 'string' && isLang(raw) ? raw : 'ar';
};

/**
 * Account recovery (P3-SEC4): no session (the person cannot sign in). The attempt waits in the server store, found
 * again through a Strict, path-limited cookie when the eID sends the browser back; the attempt id never goes in a URL.
 */
export async function startRecovery(form: FormData): Promise<void> {
  const lang = langOf(form);
  const r = await publicCoreCall<{ id?: unknown; authorizationUrl?: unknown }>(config(), '/v1/recovery', { locale: LOCALES[lang] }, await correlationId());
  if (r.status === 201 && typeof r.body?.id === 'string' && typeof r.body.authorizationUrl === 'string') {
    const spec = recoveryCookie(config());
    (await cookies()).set(spec.name, store().putRecovery({ attemptId: r.body.id, lang }), spec.options);
    redirect(r.body.authorizationUrl);
  }
  redirect(`/${lang}/recover?notice=${r.status === 429 ? 'recoveryTooMany' : r.status === 503 ? 'recoveryUnavailable' : 'error'}`);
}

/** Recovery R4, step 1 (doc phase-3/16): the same notice whether or not the address has an account. */
export async function startContactRecovery(form: FormData): Promise<void> {
  const lang = langOf(form);
  const email = typeof form.get('email') === 'string' ? (form.get('email') as string).trim() : '';
  if (!email || email.length > 254) redirect(`/${lang}/recover?notice=invalid`);
  const r = await publicCoreCall(config(), '/v1/recovery/contact', { email, locale: LOCALES[lang] }, await correlationId());
  redirect(`/${lang}/recover?notice=${r.status === 202 ? 'recoveryLinkSent' : r.status === 400 ? 'invalid' : r.status === 503 ? 'recoveryUnavailable' : 'error'}`);
}

async function link(lang: Lang) {
  const spec = recoveryLinkCookie(config(), lang);
  const jar = await cookies();
  const id = jar.get(spec.name)?.value;
  return { id, link: store().getRecoveryLink(id), jar, spec };
}

/** Step 2: the link was followed (its attempt is in the server store); an SMS code goes to the verified number. */
export async function sendRecoveryCode(form: FormData): Promise<void> {
  const lang = langOf(form);
  const { id, link: l } = await link(lang);
  if (!id || !l) redirect(`/${lang}/recover?notice=recoveryLinkExpired`);
  const r = await publicCoreCall<{ phoneEnding?: unknown }>(config(), `/v1/recovery/contact/${l.attemptId}:send-code`, { token: l.token }, await correlationId());
  if ((r.status === 200 || r.status === 201) && typeof r.body?.phoneEnding === 'string') {
    store().updateRecoveryLink(id, { phoneEnding: r.body.phoneEnding });
    redirect(`/${lang}/recover/phone?notice=recoveryCodeSent`);
  }
  redirect(r.status === 404 ? `/${lang}/recover?notice=recoveryLinkExpired` : `/${lang}/recover/phone?notice=${r.status === 503 ? 'recoveryUnavailable' : 'error'}`);
}

/** Step 3: link and SMS code; the account is reset and a set-up link e-mailed (as after an eID recovery). */
export async function completeContactRecovery(form: FormData): Promise<void> {
  const lang = langOf(form);
  const { id, link: l, jar, spec } = await link(lang);
  if (!id || !l) redirect(`/${lang}/recover?notice=recoveryLinkExpired`);
  const code = typeof form.get('code') === 'string' ? (form.get('code') as string).trim() : '';
  if (!/^\d{6}$/.test(code)) redirect(`/${lang}/recover/phone?notice=wrongCode`);
  const r = await publicCoreCall(config(), `/v1/recovery/contact/${l.attemptId}:complete`, { token: l.token, code }, await correlationId());
  if (r.status === 422) redirect(`/${lang}/recover/phone?notice=wrongCode`);
  store().dropRecoveryLink(id);
  jar.delete({ name: spec.name, path: spec.options.path });
  redirect(`/${lang}/recover?notice=${r.status === 202 ? 'recoveryRequested' : r.status === 404 ? 'recoveryLinkExpired' : 'error'}`);
}
