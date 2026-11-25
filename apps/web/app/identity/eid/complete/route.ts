import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { recoveryCookie } from '@/lib/cookies';
import { publicCoreCall } from '@/lib/core';
import { isLang } from '@/lib/locales';
import { config, core, correlationId, currentSession, store } from '@/server/context';

/** Completes an account recovery (P3-SEC4) kept in the server store: the same notice whatever the core found. */
async function completeRecovery(req: NextRequest): Promise<Response | null> {
  const jar = await cookies();
  const spec = recoveryCookie(config());
  const pending = store().takeRecovery(jar.get(spec.name)?.value);
  if (!jar.get(spec.name)) return null;
  jar.delete({ name: spec.name, path: spec.options.path });
  const lang = pending && isLang(pending.lang) ? pending.lang : 'ar';
  const to = (notice: string) => NextResponse.redirect(new URL(`/${lang}/recover?notice=${notice}`, config().appOrigin), 303);
  const q = req.nextUrl.searchParams;
  if (!pending || q.get('error')) return to('recoveryRejected');
  const r = await publicCoreCall(config(), `/v1/recovery/${encodeURIComponent(pending.attemptId)}:complete`, { code: q.get('code'), state: q.get('state') }, await correlationId());
  if (r.status === 202) return to('recoveryRequested');
  if (r.status === 503) return to('recoveryUnavailable');
  return to('recoveryRejected');
}

/** Completes the identity link with the attempt kept in the session (POST /v1/identity/links/{id}:complete). */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await currentSession();
  const attempt = session?.eidAttempt;
  // An identity link needs a session with its attempt; without one, this may be an account recovery.
  if (!attempt) {
    const recovered = await completeRecovery(req);
    if (recovered) return recovered;
  }
  const lang = attempt && isLang(attempt.lang) ? attempt.lang : 'ar';
  const to = (notice: string) => NextResponse.redirect(new URL(`/${lang}/identity?notice=${notice}`, config().appOrigin), 303);
  if (!session || !attempt) return to('eidRejected');
  store().update(session.id, { eidAttempt: undefined });
  const q = req.nextUrl.searchParams;
  if (q.get('error')) return to('eidRejected');
  const r = await core(session, `/v1/identity/links/${encodeURIComponent(attempt.id)}:complete`, `/${lang}/identity`, { method: 'POST', body: { code: q.get('code'), state: q.get('state') } });
  if (r.status === 200) return to('eidLinked');
  if (r.status === 409) return to('eidConflict');
  if (r.status === 503) return to('eidUnavailable');
  return to('eidRejected');
}
