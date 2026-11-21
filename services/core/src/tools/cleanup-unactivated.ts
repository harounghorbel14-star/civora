/**
 * Command-line entry for the scheduled removal of accounts never activated (Phase 3 R-P3-8), e.g. a Kubernetes CronJob:
 *   node dist/src/tools/cleanup-unactivated.js
 * Environment: the realms' provisioner settings (as for the core), CLEANUP_CITIZENS_MINUTES (default 1440),
 * CLEANUP_STAFF_MINUTES (default 10080, beyond the longest invitation). Prints one JSON line per realm.
 */
import { cleanupUnactivatedAccounts } from '../modules/identity-access/public-api';

export function minutesFrom(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const v = Number(env[name] ?? fallback);
  const min = ['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev') ? 0 : 60;
  if (!Number.isInteger(v) || v < min || v > 525_600) throw new Error(`${name} must be ${min}..525600 minutes`);
  return v;
}

async function main(): Promise<void> {
  const results = await cleanupUnactivatedAccounts({
    citizens: minutesFrom(process.env, 'CLEANUP_CITIZENS_MINUTES', 1440),
    staff: minutesFrom(process.env, 'CLEANUP_STAFF_MINUTES', 10_080),
  });
  for (const r of results) process.stdout.write(JSON.stringify({ level: 'info', context: 'cleanup-unactivated', ...r }) + '\n');
}

if (require.main === module) {
  main().catch((e: unknown) => {
    process.stderr.write(JSON.stringify({ level: 'error', context: 'cleanup-unactivated', msg: e instanceof Error ? e.message : String(e) }) + '\n');
    process.exit(1);
  });
}
