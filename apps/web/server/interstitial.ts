/**
 * A tiny page that sends the browser on to a path of this app. Used after a redirect from another site (Keycloak, the
 * eID): the next request is then started by this site, so the SameSite=Strict session cookie is sent with it.
 */
export function interstitial(path: string, cookiesToSet: string[] = []): Response {
  const safe = path.replace(/[^A-Za-z0-9/_?=&.%~-]/g, '');
  const res = new Response(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>CIVORA</title></head><body><p><a href="${safe}">CIVORA</a></p></body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
  for (const c of cookiesToSet) res.headers.append('set-cookie', c);
  return res;
}

export function serializeCookie(name: string, value: string, o: { httpOnly: boolean; secure: boolean; sameSite: string; path: string; maxAge?: number }): string {
  return [`${name}=${value}`, `Path=${o.path}`, o.httpOnly ? 'HttpOnly' : '', o.secure ? 'Secure' : '', `SameSite=${o.sameSite[0]!.toUpperCase()}${o.sameSite.slice(1)}`,
    o.maxAge !== undefined ? `Max-Age=${o.maxAge}` : ''].filter(Boolean).join('; ');
}
