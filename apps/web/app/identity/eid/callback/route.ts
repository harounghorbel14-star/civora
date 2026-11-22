import type { NextRequest } from 'next/server';
import { interstitial } from '@/server/interstitial';

/** The eID sends the browser back here (another site): continue on this site so the session cookie is sent. */
export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams;
  const code = q.get('code') ?? '';
  const state = q.get('state') ?? '';
  const ok = /^[A-Za-z0-9._~+/=-]{1,2048}$/.test(code) && /^[A-Za-z0-9_-]{43}$/.test(state);
  return interstitial(ok ? `/identity/eid/complete?${new URLSearchParams({ code, state })}` : '/identity/eid/complete?error=1');
}
