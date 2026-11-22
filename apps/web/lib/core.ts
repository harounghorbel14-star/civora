import type { WebConfig } from './config';
import { refreshTokens } from './oidc';
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

/** Calls civora-core with the session's access token, refreshing it first when it is about to expire. */
export async function coreCall<T = unknown>(
  cfg: WebConfig,
  store: MemorySessionStore,
  session: Session,
  path: string,
  init: { method?: string; body?: unknown; correlationId?: string } = {},
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<CoreResult<T>> {
  if (session.tokens.accessExpiresAt - REFRESH_MARGIN_MS <= now) {
    try {
      const tokens = await refreshTokens(cfg, session.tokens, fetchFn, now);
      store.update(session.id, { tokens });
      session.tokens = tokens;
    } catch {
      store.destroy(session.id);
      throw new SignedOut('refresh refused');
    }
  }
  const res = await fetchFn(cfg.coreUrl + path, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${session.tokens.accessToken}`,
      accept: 'application/json',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(init.correlationId ? { 'x-request-id': init.correlationId } : {}),
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
