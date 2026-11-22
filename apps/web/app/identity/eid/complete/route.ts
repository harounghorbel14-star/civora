import { NextResponse, type NextRequest } from 'next/server';
import { isLang } from '@/lib/locales';
import { config, core, currentSession, store } from '@/server/context';

/** Completes the identity link with the attempt kept in the session (POST /v1/identity/links/{id}:complete). */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await currentSession();
  const attempt = session?.eidAttempt;
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
