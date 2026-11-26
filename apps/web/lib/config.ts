import { readFileSync } from 'node:fs';

/**
 * Settings of the citizen web app (backend-for-frontend), from the environment. The browser never sees tokens: the
 * server exchanges the code, keeps the tokens in its session store and calls civora-core with them.
 */
export interface WebConfig {
  /** Public origin of this app as the browser sees it, e.g. https://app.civora.example */
  appOrigin: string;
  /** Issuer of the citizens realm as the browser and the tokens see it. */
  issuer: string;
  /** Where this server reaches Keycloak (token, keys, logout), when not at the issuer's origin. */
  issuerInternal: string;
  /** Confidential client: private_key_jwt, PAR required, DPoP-bound tokens (the realm's civora-web client). */
  clientId: string;
  /** This app's private signing key (PKCS #8 PEM, EC P-256), from OIDC_CLIENT_KEY_FILE; its public half is on the client. */
  clientKeyPem: string;
  /** Key id of that key in the client's key set (OIDC_CLIENT_KEY_ID). */
  clientKeyId: string;
  /** civora-core as this server reaches it. */
  coreUrl: string;
  /** Cookies marked Secure (https, or localhost, which browsers treat as a secure context). */
  secureCookies: boolean;
  /** __Host- prefix on cookie names (https only). */
  hostPrefix: boolean;
  sessionIdleSeconds: number;
  sessionMaxSeconds: number;
}

const devOrTest = (env: NodeJS.ProcessEnv): boolean => ['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev');
const isLocal = (u: URL): boolean => u.hostname === 'localhost' || u.hostname === '127.0.0.1';

function intIn(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const v = Number(env[name] ?? fallback);
  if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${name} must be an integer ${min}..${max}`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WebConfig {
  const keyFile = env.OIDC_CLIENT_KEY_FILE;
  if (!keyFile) throw new Error('OIDC_CLIENT_KEY_FILE is not set (the client signs its requests with private_key_jwt)');
  const clientKeyPem = readFileSync(keyFile, 'utf8');
  if (!/-----BEGIN PRIVATE KEY-----/.test(clientKeyPem)) throw new Error('OIDC_CLIENT_KEY_FILE: a PKCS #8 PEM private key');
  const need = (name: string): string => {
    const v = env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v.replace(/\/$/, '');
  };
  const appOrigin = need('APP_ORIGIN');
  const issuer = need('OIDC_ISSUER');
  const coreUrl = need('CORE_URL');
  const app = new URL(appOrigin);
  if (app.origin !== appOrigin) throw new Error('APP_ORIGIN must be an origin (scheme, host, optional port), no path');
  for (const [name, value] of [['APP_ORIGIN', appOrigin], ['OIDC_ISSUER', issuer]] as const) {
    const u = new URL(value);
    if (u.protocol !== 'https:' && !(devOrTest(env) && isLocal(u))) throw new Error(`${name} must use https (http only for localhost in dev and test)`);
  }
  const idle = intIn(env, 'SESSION_IDLE_SECONDS', 1800, 60, 7200);
  return {
    appOrigin,
    issuer,
    issuerInternal: env.OIDC_INTERNAL_URL ? env.OIDC_INTERNAL_URL.replace(/\/$/, '') + new URL(issuer).pathname : issuer,
    clientId: env.OIDC_CLIENT_ID ?? 'civora-web',
    clientKeyPem,
    clientKeyId: env.OIDC_CLIENT_KEY_ID ?? 'civora-web-1',
    coreUrl,
    secureCookies: app.protocol === 'https:' || isLocal(app),
    hostPrefix: app.protocol === 'https:',
    sessionIdleSeconds: idle,
    sessionMaxSeconds: intIn(env, 'SESSION_MAX_SECONDS', 28_800, idle, 86_400),
  };
}
