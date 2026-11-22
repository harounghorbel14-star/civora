import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { pendingCookie, sessionCookie } from '@/lib/cookies';
import { exchangeCode, verifyIdToken } from '@/lib/oidc';
import { config, store } from '@/server/context';
import { interstitial, serializeCookie } from '@/server/interstitial';

/**
 * Back from Keycloak: the pending sign-in (single use) must match the state; the code is exchanged on the server and
 * the ID token's nonce checked. A new session id is issued every time (the previous session, if any, ends).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const cfg = config();
  const jar = await cookies();
  const pc = pendingCookie(cfg);
  const sc = sessionCookie(cfg);
  const clearPending = serializeCookie(pc.name, '', { ...pc.options, maxAge: 0 });
  const pending = store().takePending(jar.get(pc.name)?.value);
  const q = req.nextUrl.searchParams;
  const lang = pending?.returnTo.split('/')[1] ?? 'ar';
  if (!pending || q.get('state') !== pending.state) return interstitial(`/${lang}?notice=signInFailed`, [clearPending]);
  const back = (notice: string) => `${pending.returnTo}${pending.returnTo.includes('?') ? '&' : '?'}notice=${notice}`;
  const code = q.get('code');
  if (!code) return interstitial(back(q.get('kc_action_status') === 'cancelled' ? 'cancelled' : 'signInFailed'), [clearPending]);
  try {
    const tokens = await exchangeCode(cfg, code, pending.verifier);
    const subject = await verifyIdToken(cfg, tokens.idToken, pending.nonce);
    store().destroy(jar.get(sc.name)?.value);
    const session = store().create(subject, tokens);
    const notice = q.get('kc_action_status') === 'success' ? 'actionDone' : pending.returnTo.includes('confirmed=1') ? 'stepUpDone' : null;
    return interstitial(notice ? back(notice) : pending.returnTo, [clearPending, serializeCookie(sc.name, session.id, sc.options)]);
  } catch {
    return interstitial(back('signInFailed'), [clearPending]);
  }
}
