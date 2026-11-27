import { createHash, createHmac } from 'node:crypto';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Realm } from './token-verifier';

/**
 * Notices from Keycloak's sign-in events (ASVS 5.0 V6.3.5, V6.3.7; doc phase-3/15 §7). Keycloak keeps LOGIN,
 * LOGIN_ERROR, UPDATE_CREDENTIAL and REMOVE_CREDENTIAL events for one hour (realm policy); the core reads them with the
 * provisioner's view-events role and tells the person, in their language:
 *  - second-factor-failed: the password was right, the second step failed (a failure on a selected credential of a
 *    second-factor type: the authenticator app or a security key; or the SMS step, which marks its own errors);
 *  - failed-attempts: 5 failures within an hour;
 *  - signed-in-after-failures: a successful sign-in after 3 or more failures within the hour;
 *  - credential-added: a way to sign in added or changed on Keycloak's pages from inside a sign-in (an app asked for it).
 *    Activation and recovery links set credentials outside any sign-in and send their own messages: no notice;
 *  - credential-removed: a way to sign in removed on Keycloak's own pages (removals through the core, by the admin API,
 *    raise no such event and have their own notice).
 * Each event is handled once (database), whichever replica reads it; the same kind of warning at most once a day.
 */

export const WATCHED_EVENTS = ['LOGIN', 'LOGIN_ERROR', 'UPDATE_CREDENTIAL', 'REMOVE_CREDENTIAL'] as const;
const SECOND_FACTORS = new Set(['otp', 'webauthn']);
const FAILURES = new Set(['invalid_user_credentials', 'user_temporarily_disabled']);

export interface KeycloakEvent {
  id?: string;
  time: number;
  type: string;
  error?: string;
  userId?: string;
  details?: Record<string, string>;
}

export type Kind = 'failure' | 'second-factor-failure' | 'success' | 'credential-change';
export type SignInNoticeType = 'second-factor-failed' | 'failed-attempts' | 'signed-in-after-failures' | 'credential-added' | 'credential-removed';

export interface Classified {
  kind: Kind;
  change?: 'credential-added' | 'credential-removed';
  /** Keycloak credential type when known: password, otp, webauthn, webauthn-passwordless. */
  credential?: string;
}

/** What an event means for the person; null when it is not one to count or tell. */
export async function classify(e: KeycloakEvent, batch: KeycloakEvent[], credentialType: (userId: string, credentialId: string) => Promise<string | null>): Promise<Classified | null> {
  if (!e.userId) return null;
  switch (e.type) {
    case 'LOGIN':
      return { kind: 'success' };
    case 'LOGIN_ERROR': {
      if (!e.error || !FAILURES.has(e.error)) return null;
      // The SMS step (extension civora-keycloak-sms, doc phase-3/17) has no credential; it marks its errors itself.
      if (e.details?.civora_second_factor === 'sms') return { kind: 'second-factor-failure', credential: 'sms' };
      const selected = e.details?.selected_credential_id;
      const type = selected ? await credentialType(e.userId, selected) : null;
      if (type && SECOND_FACTORS.has(type)) return { kind: 'second-factor-failure', credential: type };
      return { kind: 'failure' };
    }
    case 'UPDATE_CREDENTIAL': {
      // Inside a sign-in, Keycloak also records a LOGIN with the same code_id; activation and recovery links do not.
      const code = e.details?.code_id;
      if (!code || !batch.some((x) => x.type === 'LOGIN' && x.userId === e.userId && x.details?.code_id === code)) return null;
      return { kind: 'credential-change', change: 'credential-added', credential: e.details?.credential_type };
    }
    case 'REMOVE_CREDENTIAL':
      return { kind: 'credential-change', change: 'credential-removed', credential: e.details?.credential_type };
    default:
      return null;
  }
}

export interface WatcherDeps {
  realms: Realm[];
  /** Events of the watched types since `sinceMs`, newest first (Keycloak's order), a page at a time. */
  events(realm: Realm, sinceMs: number, first: number, max: number): Promise<KeycloakEvent[]>;
  credentialType(realm: Realm, userId: string, credentialId: string): Promise<string | null>;
  record(event: Buffer, account: Buffer, kind: Kind, atMs: number): Promise<{ notice: string | null; failures: number }>;
  notify(realm: Realm, userId: string, n: { type: SignInNoticeType; count?: number; credential?: string }): Promise<void>;
  log(entry: Record<string, unknown>): void;
  now?: () => number;
}

export interface WatcherOptions {
  /** Re-read this much before the last position (events are handled once anyway). */
  overlapMs: number;
  /** Leave events younger than this for the next round, so a change and its LOGIN are seen together. */
  settleMs: number;
  pageSize: number;
  maxPages: number;
}

const DEFAULTS: WatcherOptions = { overlapMs: 120_000, settleMs: 5_000, pageSize: 100, maxPages: 20 };

export class SignInEventWatcher {
  private readonly cursor = new Map<Realm, number>();
  private readonly opts: WatcherOptions;

  constructor(private readonly deps: WatcherDeps, private readonly key: Buffer, opts: Partial<WatcherOptions> = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  /** One round over every realm; returns the notices sent. */
  async poll(): Promise<number> {
    let sent = 0;
    for (const realm of this.deps.realms) {
      const now = (this.deps.now ?? Date.now)();
      // At start, look back ten minutes: events while the core was down are still in Keycloak (kept one hour).
      const since = (this.cursor.get(realm) ?? now - 600_000) - this.opts.overlapMs;
      const until = now - this.opts.settleMs;
      const batch: KeycloakEvent[] = [];
      for (let page = 0; page < this.opts.maxPages; page++) {
        const got = await this.deps.events(realm, since, page * this.opts.pageSize, this.opts.pageSize);
        batch.push(...got);
        if (got.length < this.opts.pageSize) break;
      }
      const types = new Map<string, string | null>();
      const typeOf = async (userId: string, id: string): Promise<string | null> => {
        const k = `${userId}\0${id}`;
        if (!types.has(k)) types.set(k, await this.deps.credentialType(realm, userId, id).catch(() => null));
        return types.get(k) ?? null;
      };
      for (const e of batch.filter((x) => x.time <= until).sort((a, b) => a.time - b.time)) {
        const c = await classify(e, batch, typeOf);
        if (!c) continue;
        const eventKey = createHash('sha256').update(`signin-event\0${realm}\0${e.id ?? `${e.time}\0${e.type}\0${e.userId}\0${e.details?.code_id ?? ''}`}`, 'utf8').digest();
        const account = createHmac('sha256', this.key).update(`signin-account\0${realm}\0${e.userId}`, 'utf8').digest();
        const r = await this.deps.record(eventKey, account, c.kind, e.time);
        const type: SignInNoticeType | null = r.notice === 'credential-change' ? c.change ?? null
          : r.notice === 'second-factor-failed' || r.notice === 'failed-attempts' || r.notice === 'signed-in-after-failures' ? r.notice : null;
        if (!type) continue;
        await this.deps.notify(realm, e.userId!, { type, count: r.failures, credential: c.credential })
          .then(() => { sent++; this.deps.log({ event: 'signin-notice', realm, type }); })
          .catch((err) => this.deps.log({ event: 'signin-notice', realm, type, outcome: 'not-sent', error: String((err as Error).message ?? err).slice(0, 200) }));
      }
      this.cursor.set(realm, Math.max(this.cursor.get(realm) ?? 0, until));
    }
    return sent;
  }
}

/** Polling interval (SIGNIN_EVENTS_POLL_SECONDS, default 60, 2..600); 0 when off (SIGNIN_EVENTS=off). */
export function loadPollSeconds(env: NodeJS.ProcessEnv = process.env): number {
  if ((env.SIGNIN_EVENTS ?? '').toLowerCase() === 'off') return 0;
  const n = Number(env.SIGNIN_EVENTS_POLL_SECONDS ?? 60);
  if (!Number.isInteger(n) || n < 2 || n > 600) throw new Error('SIGNIN_EVENTS_POLL_SECONDS must be an integer between 2 and 600');
  return n;
}

/** Runs the watcher on a timer inside the core process; one round at a time. */
export class SignInEventsService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private busy = false;

  constructor(private readonly watcher: SignInEventWatcher | null, private readonly seconds: number, private readonly log: (e: Record<string, unknown>) => void) {}

  onModuleInit(): void {
    if (!this.watcher || this.seconds <= 0) return;
    this.timer = setInterval(() => void this.round(), this.seconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async round(): Promise<void> {
    if (!this.watcher || this.busy) return;
    this.busy = true;
    try {
      await this.watcher.poll();
    } catch (e) {
      this.log({ event: 'signin-events', outcome: 'round-failed', error: String((e as Error).message ?? e).slice(0, 200) });
    } finally {
      this.busy = false;
    }
  }
}
