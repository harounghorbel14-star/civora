import { randomBytes } from 'node:crypto';

/**
 * Server-side sessions of the backend-for-frontend. The browser holds only an opaque, random session id in an
 * HttpOnly cookie; tokens never leave the server. A new id is issued at every sign-in (no session fixation).
 * This store keeps sessions in the process memory: one replica only. A shared store (the cell's Valkey) is required
 * before running more than one replica (pilot gate, doc phase-3/08).
 */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  /** Epoch ms. */
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export interface ActingContext {
  mandateId: string;
  scopes: string[];
  expiresAt: string;
}

export interface Session {
  id: string;
  subject: string;
  tokens: Tokens;
  createdAt: number;
  lastSeenAt: number;
  absoluteExpiresAt: number;
  /** "Acting on behalf of" (P3-F6), chosen by the agent; checked again by the core on every use. */
  acting?: ActingContext;
  /** An identity-link attempt waiting for the eID's answer. */
  eidAttempt?: { id: string; lang: string };
  /** Shown once on the next page, then removed (e.g. a mandate's one-time code: never in a URL). */
  flash?: { mandateId: string; mandateCode: string };
}

export interface PendingLogin {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
}

export const newId = (): string => randomBytes(32).toString('base64url');
const PENDING_MS = 10 * 60_000;
/** Pending sign-ins kept at most (a flood of /auth/login cannot exhaust memory; the oldest go first). */
const MAX_PENDING = 10_000;

export class MemorySessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly pending = new Map<string, PendingLogin>();

  constructor(private readonly opts: { idleMs: number; maxMs: number; now?: () => number; maxPending?: number }) {}

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  create(subject: string, tokens: Tokens): Session {
    const t = this.now();
    // Oldest first (insertion order): drop the sessions past their absolute limit at the head of the map.
    for (const [k, v] of this.sessions) {
      if (t > v.absoluteExpiresAt || t > v.tokens.refreshExpiresAt) this.sessions.delete(k);
      else break;
    }
    const s: Session = { id: newId(), subject, tokens, createdAt: t, lastSeenAt: t, absoluteExpiresAt: t + this.opts.maxMs };
    this.sessions.set(s.id, s);
    return s;
  }

  /** The session, if it exists and is neither idle too long nor past its absolute limit; touches it. */
  get(id: string | undefined): Session | null {
    if (!id) return null;
    const s = this.sessions.get(id);
    if (!s) return null;
    const t = this.now();
    if (t - s.lastSeenAt > this.opts.idleMs || t > s.absoluteExpiresAt || t > s.tokens.refreshExpiresAt) {
      this.sessions.delete(id);
      return null;
    }
    s.lastSeenAt = t;
    return s;
  }

  update(id: string, patch: Partial<Omit<Session, 'id' | 'createdAt' | 'absoluteExpiresAt'>>): void {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, patch);
  }

  destroy(id: string | undefined): Session | null {
    if (!id) return null;
    const s = this.sessions.get(id) ?? null;
    this.sessions.delete(id);
    return s;
  }

  putPending(p: Omit<PendingLogin, 'createdAt'>): string {
    const t = this.now();
    const cap = this.opts.maxPending ?? MAX_PENDING;
    // Oldest first: drop expired entries and, under a flood, the oldest beyond the cap. Stops at the first entry kept,
    // so the cost does not grow with the number of pending sign-ins.
    for (const [k, v] of this.pending) {
      if (t - v.createdAt > PENDING_MS || this.pending.size >= cap) this.pending.delete(k);
      else break;
    }
    const id = newId();
    this.pending.set(id, { ...p, createdAt: t });
    return id;
  }

  /** Single use: the pending login is removed whether or not it is still valid. */
  takePending(id: string | undefined): PendingLogin | null {
    if (!id) return null;
    const p = this.pending.get(id) ?? null;
    this.pending.delete(id);
    return p && this.now() - p.createdAt <= PENDING_MS ? p : null;
  }

  get size(): number {
    return this.sessions.size;
  }

  get pendingSize(): number {
    return this.pending.size;
  }
}

/** One store per server process, shared by route handlers, server components and server actions (separate bundles). */
export function sessionStore(idleSeconds: number, maxSeconds: number): MemorySessionStore {
  const g = globalThis as unknown as { __civoraSessions?: MemorySessionStore };
  g.__civoraSessions ??= new MemorySessionStore({ idleMs: idleSeconds * 1000, maxMs: maxSeconds * 1000 });
  return g.__civoraSessions;
}
