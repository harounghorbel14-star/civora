import { createHash, createHmac } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { Realm, VerifiedToken } from './token-verifier';

/**
 * Adaptive controls on the device and browser a session is used from (ASVS 5.0 V8.2.4, V6.3.5; doc phase-3/15).
 *
 * Each request carries a device signal, strongest first:
 *  - device-cookie: the web app (a backend-for-frontend) forwards a digest of its long-lived device cookie and the
 *    browser's User-Agent. Trusted only from forwarding clients (CONTEXT_FORWARDING_CLIENTS, default civora-web) and
 *    only on DPoP-bound tokens, whose proof shows the request comes from that app's server;
 *  - device-key: any other DPoP client (the mobile app): its key thumbprint, which never leaves the device;
 *  - browser: otherwise, the browser family of the request (weakest; staff and test clients today).
 * The database (iam.observe_session) compares the signal with the session's and with the person's known devices:
 *  - a new session on a device not seen before: a notice to the person (also after more than 180 days without any);
 *  - a session that is now used from another device or browser: the session is ended at Keycloak, the request is
 *    refused, and the person is told. A stolen session cookie or token is useless from another browser.
 * No location, address or time of day is used (doc 11 §2.3). Digests only: never a cookie, a key or an address.
 */

export type Strength = 'device-cookie' | 'device-key' | 'browser';
export type Outcome = 'same' | 'new-known' | 'new-device' | 'first-device' | 'changed-device' | 'changed-browser' | 'ended';

export interface Signal {
  /** Digest of realm, Keycloak session id and client: one record per client session. */
  session: Buffer;
  /** Keyed digest of the device (or browser family), never the raw value. */
  device: Buffer;
  strength: Strength;
  /** Coarse, human-readable: "Chrome · Linux". Shown in notices. */
  label: string;
}

export interface AdaptiveConfig {
  forwarders: Set<string>;
}

export function loadAdaptiveConfig(env: NodeJS.ProcessEnv = process.env): AdaptiveConfig {
  return { forwarders: new Set((env.CONTEXT_FORWARDING_CLIENTS ?? 'civora-web').split(',').map((s) => s.trim()).filter(Boolean)) };
}

/** Browser and system family from a User-Agent, without versions: what a person recognises, and stable across updates. */
export function browserFamily(userAgent: string | undefined): string {
  const ua = (userAgent ?? '').slice(0, 512);
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
      : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
        : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
          : /Chrome\/|CriOS\/|Chromium\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari'
              : /^okhttp\//i.test(ua) ? 'Android app'
                : /CFNetwork\//.test(ua) ? 'iOS app'
                  : 'Other';
  const system = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
        : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
          : /CrOS/.test(ua) ? 'ChromeOS'
            : /Linux/.test(ua) ? 'Linux'
              : 'Other';
  return `${browser} · ${system}`;
}

const DEVICE_HEADER = 'civora-device';
const UA_HEADER = 'civora-user-agent';
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? undefined : v);

/** The request's device signal, or null when the token names no client session (nothing to protect). */
export function resolveSignal(token: Pick<VerifiedToken, 'realm' | 'sessionId' | 'clientId' | 'jkt'>, headers: IncomingHttpHeaders,
  cfg: AdaptiveConfig, key: Buffer): Signal | null {
  if (!token.sessionId || !token.clientId) return null;
  const session = createHash('sha256').update(`session\0${token.realm}\0${token.sessionId}\0${token.clientId}`, 'utf8').digest();
  const keyed = (purpose: string, value: string): Buffer => createHmac('sha256', key).update(`${purpose}\0${value}`, 'utf8').digest();
  const forwarded = cfg.forwarders.has(token.clientId) && !!token.jkt;
  const label = browserFamily(forwarded ? one(headers[UA_HEADER]) : one(headers['user-agent']));
  const cookie = forwarded ? one(headers[DEVICE_HEADER]) : undefined;
  if (cookie && /^[A-Za-z0-9_-]{43}$/.test(cookie)) return { session, device: keyed('device-cookie', cookie), strength: 'device-cookie', label };
  if (!forwarded && token.jkt) return { session, device: keyed('device-key', token.jkt), strength: 'device-key', label };
  // A forwarding client without its device cookie is treated like a browser with no device: its family only.
  return { session, device: keyed('browser', `${token.clientId}\0${label}`), strength: 'browser', label };
}

export type ContextNotice = (realm: Realm, subject: string, event: { type: 'new-device' | 'long-absence' | 'session-ended'; label: string }) => Promise<void>;

export interface AdaptiveDeps {
  observe(personId: string, signal: Signal): Promise<{ outcome: Outcome; longAbsence: boolean }>;
  /** Ends the Keycloak session (best effort; the core refuses the session anyway). */
  endSession(realm: Realm, sessionId: string): Promise<void>;
  notice: ContextNotice;
  log(entry: Record<string, unknown>): void;
}

/** Decides per request: allow, or deny (the session was ended). Notices never delay or fail the request. */
export class AdaptiveControls {
  constructor(private readonly deps: AdaptiveDeps, private readonly cfg: AdaptiveConfig, private readonly key: Buffer) {}

  async check(identity: VerifiedToken & { personId: string }, headers: IncomingHttpHeaders): Promise<'allow' | 'deny'> {
    const signal = resolveSignal(identity, headers, this.cfg, this.key);
    if (!signal) return 'allow';
    const { outcome, longAbsence } = await this.deps.observe(identity.personId, signal);
    const tell = (type: 'new-device' | 'long-absence' | 'session-ended') =>
      void this.deps.notice(identity.realm, identity.subject, { type, label: signal.label }).catch(() => undefined);
    if (outcome === 'new-device') tell('new-device');
    else if (longAbsence) tell('long-absence');
    if (outcome === 'changed-device' || outcome === 'changed-browser') {
      this.deps.log({ event: 'adaptive-control', realm: identity.realm, outcome, strength: signal.strength, action: 'session-ended' });
      await this.deps.endSession(identity.realm, identity.sessionId!).catch((e) =>
        this.deps.log({ event: 'adaptive-control', outcome: 'end-session-failed', error: String((e as Error).message ?? e).slice(0, 200) }));
      tell('session-ended');
      return 'deny';
    }
    if (outcome === 'ended') return 'deny';
    if (outcome === 'new-device') this.deps.log({ event: 'adaptive-control', realm: identity.realm, outcome, strength: signal.strength, action: 'notice' });
    return 'allow';
  }
}
