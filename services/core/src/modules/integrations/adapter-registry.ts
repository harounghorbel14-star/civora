/**
 * Adapter registry rules (ADR-028, docs/phase-2/11-integration-architecture.md §11.1). Every adapter declares the
 * register entry it implements and the integration class of that entry; the mode it may run in follows from the class.
 * Production also needs the register entry AUTHORIZED with an agreement reference, the cell's locked platform flag
 * integrations.production-adapters, and the tenant's recorded activation. Checked at start-up, before any call.
 */
export type AdapterMode = 'simulated' | 'sandbox' | 'production';
export type IntegrationClass = 1 | 2 | 3 | 4 | 5 | 6;

export interface AdapterRegistration {
  /** Port name, e.g. NationalEid. */
  port: string;
  /** Provider (adapter) name, e.g. simulated-oidc. */
  provider: string;
  /** Integration status register entry, e.g. I-01. */
  registerEntry: string;
  integrationClass: IntegrationClass;
}

export interface ModeEvidence {
  /** The cell's platform flag integrations.production-adapters (tenants cannot override it). */
  productionAdaptersFlag: boolean;
  /** Agreement reference of an AUTHORIZED register entry. */
  agreementRef?: string;
  /** Tenant activation record (production). */
  tenantActivationRef?: string;
  /** The owner's written test access (class 3 sandbox). */
  sandboxAccessRef?: string;
}

const MODES: Record<IntegrationClass, readonly AdapterMode[]> = {
  1: ['simulated', 'sandbox', 'production'],
  2: ['simulated', 'sandbox', 'production'],
  3: ['simulated'],
  4: ['simulated'],
  5: [],
  6: [],
};

export class AdapterModeError extends Error {}

/** Throws AdapterModeError unless the adapter may run in this mode; returns the mode otherwise. */
export function assertModeAllowed(reg: AdapterRegistration, mode: AdapterMode, evidence: ModeEvidence): AdapterMode {
  const name = `${reg.port}/${reg.provider} (${reg.registerEntry}, class ${reg.integrationClass})`;
  const allowed = MODES[reg.integrationClass].includes(mode) || (reg.integrationClass === 3 && mode === 'sandbox' && !!evidence.sandboxAccessRef);
  if (!allowed) throw new AdapterModeError(`${name} may not run in ${mode} mode`);
  if (mode === 'production') {
    if (!evidence.agreementRef) throw new AdapterModeError(`${name}: production needs the register entry AUTHORIZED with an agreement reference`);
    if (!evidence.productionAdaptersFlag) throw new AdapterModeError(`${name}: production needs the platform flag integrations.production-adapters`);
    if (!evidence.tenantActivationRef) throw new AdapterModeError(`${name}: production needs the tenant's recorded activation`);
  }
  return mode;
}
