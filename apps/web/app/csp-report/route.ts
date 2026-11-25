import { NextResponse, type NextRequest } from 'next/server';

/**
 * Content Security Policy violation reports (ASVS 5.0 V3.4.7), in both formats browsers send: `application/csp-report`
 * (report-uri) and `application/reports+json` (report-to). One log line per report with the directive and the
 * origins only: never a path or query string, which could carry a code, a state or personal data.
 */
const MAX_BYTES = 8 * 1024;
const origin = (u: unknown): string => {
  if (typeof u !== 'string') return '-';
  if (/^(inline|eval|wasm-eval|data|blob|self)$/.test(u)) return u;
  try { return new URL(u).origin; } catch { return '-'; }
};
const word = (v: unknown): string => (typeof v === 'string' && /^[a-z-]{1,40}$/.test(v) ? v : '-');

export async function POST(request: NextRequest): Promise<NextResponse> {
  const type = request.headers.get('content-type') ?? '';
  if (!/^application\/(csp-report|reports\+json)\b/.test(type)) return new NextResponse(null, { status: 415 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  const reports: Record<string, unknown>[] = Array.isArray(body)
    ? body.filter((r) => r && typeof r === 'object' && (r as { type?: unknown }).type === 'csp-violation').map((r) => ((r as { body?: unknown }).body ?? {}) as Record<string, unknown>)
    : [((body as { 'csp-report'?: unknown })['csp-report'] ?? {}) as Record<string, unknown>];
  for (const r of reports.slice(0, 10)) {
    const directive = word(r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive']);
    console.warn(JSON.stringify({ event: 'csp-violation', directive, blocked: origin(r['blocked-uri'] ?? r.blockedURL), page: origin(r['document-uri'] ?? r.documentURL) }));
  }
  return new NextResponse(null, { status: 204 });
}
