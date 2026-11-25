'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { recoveryCookie } from '@/lib/cookies';
import { publicCoreCall } from '@/lib/core';
import { isLang, LOCALES, type Lang } from '@/lib/locales';
import { config, correlationId, store } from '@/server/context';

/**
 * Account recovery (P3-SEC4): no session (the person cannot sign in). The attempt waits in the server store, found
 * again through a Strict, path-limited cookie when the eID sends the browser back; the attempt id never goes in a URL.
 */
export async function startRecovery(form: FormData): Promise<void> {
  const raw = form.get('lang');
  const lang: Lang = typeof raw === 'string' && isLang(raw) ? raw : 'ar';
  const r = await publicCoreCall<{ id?: unknown; authorizationUrl?: unknown }>(config(), '/v1/recovery', { locale: LOCALES[lang] }, await correlationId());
  if (r.status === 201 && typeof r.body?.id === 'string' && typeof r.body.authorizationUrl === 'string') {
    const spec = recoveryCookie(config());
    (await cookies()).set(spec.name, store().putRecovery({ attemptId: r.body.id, lang }), spec.options);
    redirect(r.body.authorizationUrl);
  }
  redirect(`/${lang}/recover?notice=${r.status === 429 ? 'recoveryTooMany' : r.status === 503 ? 'recoveryUnavailable' : 'error'}`);
}
