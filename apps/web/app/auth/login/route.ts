import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { pendingCookie } from '@/lib/cookies';
import { pkce, pushAuthorization, randomToken } from '@/lib/oidc';
import { langOfPath, safeReturnTo } from '@/lib/redirects';
import { config, store } from '@/server/context';

/** Keycloak actions this app may ask for (adding a way to sign in, P3-F2). */
const ACTIONS = new Set(['webauthn-register-passwordless', 'CONFIGURE_TOTP']);

/** Starts a sign-in (or a re-authentication, or a Keycloak action): PKCE, state and nonce kept on the server; the request pushed (PAR). */
export async function GET(req: NextRequest): Promise<Response> {
  const cfg = config();
  const q = req.nextUrl.searchParams;
  const returnTo = safeReturnTo(q.get('returnTo'));
  const action = q.get('action');
  const { verifier, challenge } = pkce();
  const state = randomToken();
  const nonce = randomToken();
  const pendingId = store().putPending({ state, nonce, verifier, returnTo });
  const c = pendingCookie(cfg);
  (await cookies()).set(c.name, pendingId, c.options);
  // PAR: the request goes to Keycloak from this server; the browser only carries its one-minute reference.
  return NextResponse.redirect(await pushAuthorization(cfg, {
    state, nonce, challenge, uiLocale: langOfPath(returnTo), reauth: q.get('reauth') === '1', kcAction: action && ACTIONS.has(action) ? action : undefined,
  }), 303);
}
