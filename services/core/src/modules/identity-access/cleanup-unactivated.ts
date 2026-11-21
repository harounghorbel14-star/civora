import { KeycloakAdmin, loadAdminConfig } from './keycloak-admin';
import type { Realm } from './token-verifier';

/**
 * Removal of accounts never activated (Phase 3 R-P3-8): created by a registration (citizens) or an invitation
 * (staff), e-mail never verified, no credential at all, older than the limit. Such an account cannot sign in;
 * removing it frees the address. Run on a schedule by tools/cleanup-unactivated (one instance at a time).
 * Never a service account (Keycloak's client users: no e-mail, no credential, never verified; removing one breaks the
 * client, found by the realms test on 21 Nov 2026), never an account without an e-mail address.
 */
interface AdminLike {
  json<T>(method: string, path: string): Promise<T>;
  call(method: string, path: string): Promise<unknown>;
}

interface UserRep {
  id: string;
  username?: string;
  email?: string;
  createdTimestamp?: number;
  emailVerified?: boolean;
  serviceAccountClientId?: string;
}

const SERVICE_ACCOUNT_PREFIX = 'service-account-'; // Keycloak's fixed prefix for a client's service-account user

/** Only accounts that registration or an invitation creates: an e-mail address, never a service account. */
const mayBeUnactivatedPerson = (u: UserRep): boolean =>
  typeof u.email === 'string' && u.email.includes('@') && !u.serviceAccountClientId && !(u.username ?? '').startsWith(SERVICE_ACCOUNT_PREFIX);

export async function cleanupUnactivated(admin: AdminLike, olderThanMinutes: number, now = Date.now()): Promise<{ scanned: number; removed: number }> {
  const cutoff = now - olderThanMinutes * 60_000;
  let scanned = 0;
  const candidates: string[] = [];
  for (let first = 0; first < 10_000; first += 100) {
    const page = await admin.json<UserRep[]>('GET', `/users?briefRepresentation=true&emailVerified=false&first=${first}&max=100`);
    scanned += page.length;
    for (const u of page) {
      if (u.emailVerified === false && typeof u.createdTimestamp === 'number' && u.createdTimestamp < cutoff && mayBeUnactivatedPerson(u)) candidates.push(u.id);
    }
    if (page.length < 100) break;
  }
  let removed = 0;
  for (const id of candidates) {
    // The full record again (the brief listing may omit the service-account link), then the credentials: never remove
    // an account that has any (it was activated, or is being activated right now).
    const full = await admin.json<UserRep>('GET', `/users/${encodeURIComponent(id)}`);
    if (!mayBeUnactivatedPerson(full) || full.emailVerified !== false) continue;
    if ((await admin.json<unknown[]>('GET', `/users/${encodeURIComponent(id)}/credentials`)).length > 0) continue;
    await admin.call('DELETE', `/users/${encodeURIComponent(id)}`);
    removed++;
  }
  return { scanned, removed };
}

export function minutesFrom(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const v = Number(env[name] ?? fallback);
  const min = ['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev') ? 0 : 60;
  if (!Number.isInteger(v) || v < min || v > 525_600) throw new Error(`${name} must be ${min}..525600 minutes`);
  return v;
}

/** Runs the cleanup in every realm whose provisioner is configured; one result per realm. */
export async function cleanupUnactivatedAccounts(limits: Record<Realm, number>, env: NodeJS.ProcessEnv = process.env):
  Promise<{ realm: Realm; configured: boolean; olderThanMinutes: number; scanned?: number; removed?: number }[]> {
  const out = [];
  for (const realm of ['citizens', 'staff'] as const) {
    const cfg = loadAdminConfig(realm, env);
    if (!cfg) { out.push({ realm, configured: false, olderThanMinutes: limits[realm] }); continue; }
    out.push({ realm, configured: true, olderThanMinutes: limits[realm], ...(await cleanupUnactivated(new KeycloakAdmin(cfg), limits[realm])) });
  }
  return out;
}
