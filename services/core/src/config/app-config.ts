import { readFileSync } from 'node:fs';

/** Environment configuration, validated at start-up. Secrets are injected by the platform (ADR-012), never committed. */
export interface AppConfig {
  port: number;
  version: string;
  countryPack: string;
  databaseUrl: string | null;
  environment: 'dev' | 'staging' | 'pilot' | 'prod' | 'test';
}

/**
 * Secrets may be passed as files (Kubernetes secret volumes) instead of environment variables:
 * NAME_FILE takes precedence over NAME. Files keep secrets out of the pod spec and process listings.
 */
export function readSecret(env: NodeJS.ProcessEnv, name: string): string | null {
  const file = env[`${name}_FILE`];
  if (file) return readFileSync(file, 'utf8').trim();
  return env[name] ?? null;
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = (env.CIVORA_ENV ?? 'dev') as AppConfig['environment'];
  if (!['dev', 'staging', 'pilot', 'prod', 'test'].includes(environment)) throw new Error(`invalid CIVORA_ENV ${environment}`);
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('invalid PORT');
  return {
    port,
    version: env.APP_VERSION ?? '0.1.0-dev',
    countryPack: env.COUNTRY_PACK ?? 'tn',
    databaseUrl: readSecret(env, 'DATABASE_URL'),
    environment,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
