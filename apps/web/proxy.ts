import { NextResponse, type NextRequest } from 'next/server';

/**
 * Every page: a fresh nonce for a strict Content Security Policy (scripts and styles only with the nonce), the current
 * path for the language switcher, and a correlation id. Static security headers are in next.config.ts.
 */
export function proxy(request: NextRequest): NextResponse {
  // Resource isolation (ASVS 5.0 V3.5.8): another site may link to a page (a top-level GET navigation, e.g. the return
  // from Keycloak or the eID), nothing else: no embedding, no scripts or images, no form posts, no fetches.
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    const dest = request.headers.get('sec-fetch-dest');
    if (!(request.method === 'GET' && request.headers.get('sec-fetch-mode') === 'navigate' && (dest === null || dest === 'document'))) {
      return new NextResponse(null, { status: 403 });
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const issuer = process.env.OIDC_ISSUER ? new URL(process.env.OIDC_ISSUER).origin : '';
  const https = (process.env.APP_ORIGIN ?? '').startsWith('https:');
  const extraForm = (process.env.CSP_FORM_ACTION_EXTRA ?? '').split(/\s+/).filter((o) => /^https?:\/\/[a-z0-9.:-]+$/i.test(o)).join(' ');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    `form-action 'self' ${issuer} ${extraForm}`.trim(),
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
    // Violations are reported to this app (ASVS 5.0 V3.4.7); app/csp-report keeps the directive and origins only.
    'report-uri /csp-report',
    'report-to csp',
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  if (!requestHeaders.get('x-request-id')) requestHeaders.set('x-request-id', crypto.randomUUID());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  response.headers.set('reporting-endpoints', 'csp="/csp-report"');
  // HSTS on every response over https (ASVS 5.0 V3.4.1): two years, sub-domains, ready for the preload list.
  if (https) response.headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
  return response;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
