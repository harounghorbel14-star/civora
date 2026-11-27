import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { recoveryLinkCookie } from '@/lib/cookies';
import { isLang } from '@/lib/locales';
import { config, store } from '@/server/context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The e-mailed recovery link (R4, doc phase-3/16) lands here. Its attempt and token move to the server store behind a
 * path-limited cookie, and the browser goes on to a clean address: the token does not stay in the history or reach
 * another page. Nothing is checked here: the core checks the link when the code is asked for.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams;
  const raw = q.get('l') ?? 'ar';
  const lang = isLang(raw) ? raw : 'ar';
  const a = q.get('a') ?? '';
  const t = q.get('t') ?? '';
  if (!UUID.test(a) || !/^[A-Za-z0-9_-]{43}$/.test(t)) return NextResponse.redirect(new URL(`/${lang}/recover?notice=recoveryLinkExpired`, config().appOrigin), 303);
  const spec = recoveryLinkCookie(config(), lang);
  (await cookies()).set(spec.name, store().putRecoveryLink({ attemptId: a, token: t, lang }), spec.options);
  return NextResponse.redirect(new URL(`/${lang}/recover/phone`, config().appOrigin), 303);
}
