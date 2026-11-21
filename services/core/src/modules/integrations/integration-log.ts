import type { AdapterMode } from './adapter-registry';

/**
 * Integration log (docs/phase-2/11 §11.2): one line per adapter call with the correlation id, adapter, purpose,
 * legal-basis reference, outcome and latency. Never payloads, identifiers of the person, codes or tokens.
 */
export interface IntegrationCall {
  correlationId: string;
  port: string;
  provider: string;
  mode: AdapterMode;
  operation: string;
  purpose: string;
  legalBasisRef: string;
  outcome: 'ok' | 'rejected' | 'unavailable';
  latencyMs: number;
}

export type IntegrationLogger = (call: IntegrationCall) => void;

export const stdoutIntegrationLog: IntegrationLogger = (call) =>
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level: 'info', service: 'civora-core', context: 'integration', ...call }) + '\n');
