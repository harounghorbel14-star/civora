import { InMemoryProvider, OpenFeature, type Client, type EvaluationContext } from '@openfeature/server-sdk';

export type FlagClient = Client;

export type FlagValue = boolean | string | number;

/** Flags whose name starts with one of these prefixes can never be enabled by a tenant override (ADR-021). */
export const PLATFORM_LOCKED_PREFIXES = ['integrations.production-adapters', 'platform.'] as const;

export interface FlagSources {
  /** Country-pack defaults (ADR-017). */
  packDefaults: Record<string, FlagValue>;
  /** Per-tenant overrides keyed by tenant id. */
  tenantOverrides?: Record<string, Record<string, FlagValue>>;
}

type InMemoryConfig = ConstructorParameters<typeof InMemoryProvider>[0];

function isLocked(flag: string): boolean {
  return PLATFORM_LOCKED_PREFIXES.some((p) => flag.startsWith(p));
}

/** Build the OpenFeature in-memory configuration: one variant per tenant override plus the pack default. */
export function buildFlagConfiguration(sources: FlagSources): InMemoryConfig {
  const config: Record<string, unknown> = {};
  for (const [flag, def] of Object.entries(sources.packDefaults)) {
    const variants: Record<string, FlagValue> = { default: def };
    const overrides: Record<string, string> = {};
    for (const [tenant, flags] of Object.entries(sources.tenantOverrides ?? {})) {
      const v = flags[flag];
      if (v === undefined || isLocked(flag)) continue;
      if (typeof v !== typeof def) throw new TypeError(`override for ${flag} in tenant ${tenant} has the wrong type`);
      variants[`tenant:${tenant}`] = v;
      overrides[tenant] = `tenant:${tenant}`;
    }
    config[flag] = {
      variants,
      defaultVariant: 'default',
      disabled: false,
      contextEvaluator: (ctx: EvaluationContext) => {
        const t = typeof ctx.tenantId === 'string' ? ctx.tenantId : undefined;
        return (t && overrides[t]) || 'default';
      },
    };
  }
  for (const [tenant, flags] of Object.entries(sources.tenantOverrides ?? {})) {
    for (const flag of Object.keys(flags)) {
      if (!(flag in sources.packDefaults)) throw new Error(`tenant ${tenant} overrides unknown flag ${flag} (flags must be declared in the country pack)`);
    }
  }
  return config as InMemoryConfig;
}

/** Register the provider and return a client. Call once at service start-up. */
export async function initFlags(sources: FlagSources, domain = 'civora'): Promise<Client> {
  await OpenFeature.setProviderAndWait(domain, new InMemoryProvider(buildFlagConfiguration(sources)));
  return OpenFeature.getClient(domain);
}
