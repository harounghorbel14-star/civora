import { KeycloakAdmin, loadAdminConfig } from './keycloak-admin';
import type { Realm } from './token-verifier';

/**
 * Removal of accounts never activated (Phase 3 R-P3-8): created by a registration (citizens) or an invitation
 * (staff), e-mail never verified, no credential at all, older than the limit. Such an account cannot sign in;
 * removing it frees the address. Run on a schedule by tools/cleanup-unactivated (one instance at a time).
 */
interface AdminLike {
  json<T>(method: string, path: string): Promise<T>;
  call(method: string, path: string): Promise<unknown>;
}

interface UserRep {
  id: string;
  createdTimestamp?: number;
  emailVerified?: boolean;
}

export async function cleanupUnactivated(admin: AdminLike, olderThanMinutes: number, now = Date.now()): Promise<{ scanned: number; removed: number }> {
  const cutoff = now - olderThanMinutes * 60_000;
  let scanned = 0;
  const candidates: string[] = [];
  for (let first = 0; first < 10_000; first += 100) {
    const page = await admin.json<UserRep[]>('GET', `/users?briefRepresentation=true&emailVerified=false&first=${first}&max=100`);
    scanned += page.length;
    for (const u of page) {
      if (u.emailVerified === false && typeof u.createdTimestamp === 'number' && u.createdTimestamp < cutoff) candidates.push(u.id);
    }
    if (page.length < 100) break;
  }
  let removed = 0;
  for (const id of candidates) {
    // Never remove an account that has any credential (it was activated, or is being activated right now).
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
