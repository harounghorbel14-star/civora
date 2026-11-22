import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadConfig, type WebConfig } from '@/lib/config';
import { sessionCookie } from '@/lib/cookies';
import { coreCall, SignedOut, type CoreResult } from '@/lib/core';
import { type Lang } from '@/lib/locales';
import { sessionStore, type MemorySessionStore, type Session } from '@/lib/session';

/** Server-only helpers shared by pages, server actions and route handlers. */
let cached: WebConfig | undefined;
export const config = (): WebConfig => (cached ??= loadConfig());
export const store = (): MemorySessionStore => sessionStore(config().sessionIdleSeconds, config().sessionMaxSeconds);

export async function currentSession(): Promise<Session | null> {
  return store().get((await cookies()).get(sessionCookie(config()).name)?.value);
}

export const loginUrl = (returnTo: string, extra: Record<string, string> = {}): string =>
  `/auth/login?${new URLSearchParams({ returnTo, ...extra })}`;

/** The session, or a redirect to sign in that comes back to this page. */
export async function requireSession(returnTo: string): Promise<Session> {
  const s = await currentSession();
  if (!s) redirect(loginUrl(returnTo));
  return s;
}

export async function correlationId(): Promise<string> {
  return (await headers()).get('x-request-id') ?? randomUUID();
}

/** Calls the core for the signed-in person; a session the core no longer accepts goes back to sign-in. */
export async function core<T = unknown>(session: Session, path: string, returnTo: string, init: { method?: string; body?: unknown } = {}): Promise<CoreResult<T>> {
  try {
    return await coreCall<T>(config(), store(), session, path, { ...init, correlationId: await correlationId() });
  } catch (e) {
    if (e instanceof SignedOut) redirect(loginUrl(returnTo));
    throw e;
  }
}

export function stepUpPage(lang: Lang, page: string): string {
  return `/${lang}/${page}?notice=stepUp`;
}
