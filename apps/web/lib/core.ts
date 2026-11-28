import { createHash } from 'node:crypto';
import type { WebConfig } from './config';
import { dpopProof, refreshTokens } from './oidc';
import type { MemorySessionStore, Session } from './session';

/** The core wants a recent sign-in for this action (RFC 9470): re-authenticate, then repeat it. */
export class StepUpRequired extends Error {}
/** The session cannot call the core any more (refresh refused, token rejected): sign in again. */
export class SignedOut extends Error {}

export interface CoreResult<T = unknown> {
  status: number;
  body: T;
}

const REFRESH_MARGIN_MS = 30_000;

/** The browser this call is made for (adaptive controls, doc phase-3/15): its device id (cookie) and User-Agent. */
export interface BrowserContext {
  deviceId: string | null;
  userAgent: string | null;
}

/** Headers that tell the core which browser the call is for: the device id's digest (never the id) and the User-Agent. */
export function contextHeaders(b: BrowserContext | undefined): Record<string, string> {
  if (!b) return {};
  const ua = (b.userAgent ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, 512);
  return {
    ...(b.deviceId ? { 'civora-device': createHash('sha256').update(b.deviceId, 'ascii').digest('base64url') } : {}),
    ...(ua ? { 'civora-user-agent': ua } : {}),
  };
}

/** Calls civora-core with the session's DPoP-bound access token, refreshing it first when it is about to expire. */
export async function coreCall<T = unknown>(
  cfg: WebConfig,
  store: MemorySessionStore,
  session: Session,
  path: string,
  init: { method?: string; body?: unknown; correlationId?: string; browser?: BrowserContext } = {},
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<CoreResult<T>> {
  if (session.tokens.accessExpiresAt - REFRESH_MARGIN_MS <= now) {
    try {
      const tokens = await refreshTokens(cfg, session.tokens, session.dpop, fetchFn, now);
      store.update(session.id, { tokens });
      session.tokens = tokens;
    } catch {
      store.destroy(session.id);
      throw new SignedOut('refresh refused');
    }
  }
  // DPoP (RFC 9449): the token is bound to the session's key; every call carries a fresh proof for this method and URL.
  const method = init.method ?? 'GET';
  const proof = await dpopProof(session.dpop, method, cfg.coreUrl + path, session.tokens.accessToken);
  const res = await fetchFn(cfg.coreUrl + path, {
    method,
    headers: {
      authorization: `DPoP ${session.tokens.accessToken}`,
      dpop: proof,
      accept: 'application/json',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.correlationId ? { 'x-request-id': init.correlationId } : {}),
      ...contextHeaders(init.browser),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (res.status === 401) {
    if (/insufficient_user_authentication/.test(res.headers.get('www-authenticate') ?? '')) throw new StepUpRequired();
    store.destroy(session.id);
    throw new SignedOut('token refused');
  }
  const text = await res.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  return { status: res.status, body: body as T };
}

/** Public endpoints of the core (no session), e.g. the customer status page. */
/** A public GET on civora-core (no session): the services directory's search (doc phase-5/03). */
export async function publicCoreGet<T = unknown>(cfg: WebConfig, path: string, correlationId?: string, fetchFn: typeof fetch = fetch): Promise<CoreResult<T>> {
  const res = await fetchFn(cfg.coreUrl + path, {
    headers: { accept: 'application/json', ...(correlationId ? { 'x-request-id': correlationId } : {}) },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
  return { status: res.status, body: parsed as T };
}

export async function publicCoreCall<T = unknown>(cfg: WebConfig, path: string, body: unknown, correlationId?: string, fetchFn: typeof fetch = fetch): Promise<CoreResult<T>> {
  const res = await fetchFn(cfg.coreUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(correlationId ? { 'x-request-id': correlationId } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
  return { status: res.status, body: parsed as T };
}
