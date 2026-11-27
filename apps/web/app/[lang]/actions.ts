'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect as navigate } from 'next/navigation';
import { sessionCookie } from '@/lib/cookies';
import { StepUpRequired, type CoreResult } from '@/lib/core';
import { isLang, LOCALES, type Lang } from '@/lib/locales';
import { endKeycloakSession } from '@/lib/oidc';
import type { Session } from '@/lib/session';
import { config, core, currentSession, loginUrl, store } from '@/server/context';

/**
 * Server actions: invoked only by POST from this site (Next.js compares Origin with Host), with the session cookie
 * (SameSite=Strict). Every result goes back as a redirect with a notice from the allow-list (post/redirect/get).
 */
/** Every result re-renders the whole page, layout included (language, accessibility, the acting banner, the header). */
function redirect(url: string): never {
  revalidatePath('/', 'layout');
  navigate(url);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const str = (f: FormData, k: string): string => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');
const langOf = (f: FormData): Lang => (isLang(str(f, 'lang')) ? (str(f, 'lang') as Lang) : 'ar');
const to = (lang: Lang, page: string, notice?: string): string => `/${lang}${page ? `/${page}` : ''}${notice ? `?notice=${notice}` : ''}`;

async function signedIn(lang: Lang, page: string): Promise<Session> {
  const s = await currentSession();
  if (!s) redirect(loginUrl(to(lang, page)));
  return s;
}

/** The core's answer, or 'stepUp' when it wants a recent sign-in first. */
async function call(s: Session, lang: Lang, page: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<CoreResult<Record<string, unknown>> | 'stepUp'> {
  try {
    return await core<Record<string, unknown>>(s, path, to(lang, page), init);
  } catch (e) {
    if (e instanceof StepUpRequired) return 'stepUp';
    throw e;
  }
}

export async function signOut(form: FormData): Promise<void> {
  const lang = langOf(form);
  const jar = await cookies();
  const c = sessionCookie(config());
  const s = store().destroy(jar.get(c.name)?.value);
  if (s) await endKeycloakSession(config(), s.tokens);
  jar.delete({ name: c.name, path: '/' });
  redirect(to(lang, '', 'signedOut'));
}

export async function savePreferences(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'profile');
  const chosen = str(form, 'preferredLocale');
  const newLang = (Object.entries(LOCALES).find(([, v]) => v === chosen)?.[0] ?? lang) as Lang;
  const textSize = str(form, 'textSize');
  const accessibility = {
    textSize: ['default', 'large', 'x-large'].includes(textSize) ? textSize : 'default',
    highContrast: form.get('highContrast') === 'on',
    reducedMotion: form.get('reducedMotion') === 'on',
    simplifiedLanguage: form.get('simplifiedLanguage') === 'on',
    screenReaderHints: form.get('screenReaderHints') === 'on',
  };
  const r = await call(s, lang, 'profile', '/v1/me', { method: 'PATCH', body: { preferredLocale: LOCALES[newLang], accessibility } });
  redirect(r !== 'stepUp' && r.status === 204 ? to(newLang, 'profile', 'saved') : to(lang, 'profile', 'invalid'));
}

export async function endSession(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const id = str(form, 'id');
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) redirect(to(lang, 'security', 'error'));
  const r = await call(s, lang, 'security', `/v1/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  if (r.status === 204 && form.get('current') === '1') {
    store().destroy(s.id);
    (await cookies()).delete({ name: sessionCookie(config()).name, path: '/' });
    redirect(to(lang, '', 'signedOut'));
  }
  redirect(to(lang, 'security', r.status === 204 ? 'sessionEnded' : 'error'));
}

export async function addAuthenticator(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const kind = str(form, 'kind');
  if (!['passkey', 'totp'].includes(kind)) redirect(to(lang, 'security', 'error'));
  const r = await call(s, lang, 'security', '/v1/me/authenticators', { method: 'POST', body: { kind } });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  const action = r.status === 201 ? r.body.keycloakAction : null;
  redirect(typeof action === 'string' ? loginUrl(to(lang, 'security'), { action }) : to(lang, 'security', 'error'));
}

export async function removeAuthenticator(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const id = str(form, 'id');
  if (!UUID.test(id)) redirect(to(lang, 'security', 'error'));
  const r = await call(s, lang, 'security', `/v1/me/authenticators/${id}`, { method: 'DELETE' });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  redirect(to(lang, 'security', r.status === 204 ? 'removed' : r.status === 409 ? 'lastWay' : 'error'));
}

export async function startEidLink(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'identity');
  const r = await call(s, lang, 'identity', '/v1/identity/links', { method: 'POST', body: { locale: LOCALES[lang] } });
  if (r === 'stepUp') redirect(to(lang, 'identity', 'stepUp'));
  if (r.status === 201 && typeof r.body.id === 'string' && typeof r.body.authorizationUrl === 'string') {
    store().update(s.id, { eidAttempt: { id: r.body.id, lang } });
    redirect(r.body.authorizationUrl);
  }
  redirect(to(lang, 'identity', r.status === 429 ? 'eidTooMany' : r.status === 503 ? 'eidUnavailable' : 'error'));
}

export async function createMandate(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'mandates');
  const scopes = form.getAll('scope').filter((v): v is string => typeof v === 'string');
  const day = str(form, 'expires');
  if (!scopes.length || !/^\d{4}-\d{2}-\d{2}$/.test(day)) redirect(to(lang, 'mandates', 'invalid'));
  const r = await call(s, lang, 'mandates', '/v1/mandates', { method: 'POST', body: { scopes, expiresAt: `${day}T23:59:59.000Z` } });
  if (r !== 'stepUp' && r.status === 201 && typeof r.body.id === 'string' && typeof r.body.invitationCode === 'string') {
    store().update(s.id, { flash: { mandateId: r.body.id, mandateCode: r.body.invitationCode } });
    redirect(to(lang, 'mandates'));
  }
  redirect(to(lang, 'mandates', 'invalid'));
}

export async function acceptMandate(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'mandates');
  const id = str(form, 'id').trim();
  const code = str(form, 'code').trim();
  if (!UUID.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(code)) redirect(to(lang, 'mandates', 'mandateNotFound'));
  const r = await call(s, lang, 'mandates', `/v1/mandates/${id}:accept`, { method: 'POST', body: { invitationCode: code } });
  redirect(to(lang, 'mandates', r !== 'stepUp' && r.status === 200 ? 'mandateAccepted' : 'mandateNotFound'));
}

export async function revokeMandate(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'mandates');
  const id = str(form, 'id');
  if (!UUID.test(id)) redirect(to(lang, 'mandates', 'error'));
  const r = await call(s, lang, 'mandates', `/v1/mandates/${id}:revoke`, { method: 'POST' });
  if (r !== 'stepUp' && r.status === 200 && s.acting?.mandateId === id) store().update(s.id, { acting: undefined });
  redirect(to(lang, 'mandates', r !== 'stepUp' && r.status === 200 ? 'mandateRevoked' : 'error'));
}

/** "Acting on behalf of" (P3-F6): the core checks the mandate and records it, visible to the principal. */
export async function actOnBehalf(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'mandates');
  const id = str(form, 'id');
  if (!UUID.test(id)) redirect(to(lang, 'mandates', 'actingUnavailable'));
  const r = await call(s, lang, 'mandates', `/v1/mandates/${id}:act`, { method: 'POST' });
  if (r !== 'stepUp' && r.status === 200 && Array.isArray(r.body.scopes) && typeof r.body.expiresAt === 'string') {
    store().update(s.id, { acting: { mandateId: id, scopes: r.body.scopes as string[], expiresAt: r.body.expiresAt } });
    redirect(to(lang, '', 'actingStarted'));
  }
  redirect(to(lang, 'mandates', 'actingUnavailable'));
}

export async function stopActing(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, '');
  store().update(s.id, { acting: undefined });
  redirect(to(lang, 'mandates', 'actingStopped'));
}

/** Contact details (doc phase-3/16): a code goes to the new address or number; the change waits for it in the session. */
export async function startContactChange(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const channel = str(form, 'channel');
  const value = str(form, 'value').trim();
  if (!['email', 'phone'].includes(channel) || !value || value.length > 254) redirect(to(lang, 'security', 'invalid'));
  const r = await call(s, lang, 'security', '/v1/me/contact-changes', { method: 'POST', body: { channel, value } });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  if (r.status === 201 && typeof r.body.id === 'string' && typeof r.body.expiresAt === 'string') {
    store().update(s.id, { contactChange: { id: r.body.id, channel: channel as 'email' | 'phone', target: value, expiresAt: r.body.expiresAt } });
    redirect(to(lang, 'security', 'codeSent'));
  }
  redirect(to(lang, 'security', ({ 400: 'invalid', 409: 'sameContact', 422: 'notDeliverable', 429: 'tooManyChanges' } as Record<number, string>)[r.status] ?? 'error'));
}

export async function confirmContactChange(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const pending = s.contactChange;
  const code = str(form, 'code').trim();
  if (!pending) redirect(to(lang, 'security', 'codeExpired'));
  if (!/^\d{6}$/.test(code)) redirect(to(lang, 'security', 'wrongCode'));
  const r = await call(s, lang, 'security', `/v1/me/contact-changes/${pending.id}:confirm`, { method: 'POST', body: { code } });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  if (r.status === 422) redirect(to(lang, 'security', 'wrongCode'));
  store().update(s.id, { contactChange: undefined });
  if (r.status === 200) redirect(to(lang, 'security', pending.channel === 'email' ? 'emailChanged' : 'phoneVerified'));
  redirect(to(lang, 'security', r.status === 404 ? 'codeExpired' : r.status === 409 ? 'contactInUse' : 'error'));
}

export async function cancelContactChange(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  store().update(s.id, { contactChange: undefined });
  redirect(to(lang, 'security'));
}

export async function removePhone(form: FormData): Promise<void> {
  const lang = langOf(form);
  const s = await signedIn(lang, 'security');
  const r = await call(s, lang, 'security', '/v1/me/phone', { method: 'DELETE' });
  if (r === 'stepUp') redirect(to(lang, 'security', 'stepUp'));
  redirect(to(lang, 'security', r.status === 204 ? 'phoneRemoved' : 'error'));
}
