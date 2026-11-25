import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';

/**
 * CIVORA's authorisation policies (ADR-006: Cedar, evaluated in process). Policies and schema live in ../policies,
 * versioned and reviewed in Git; they are validated in strict mode before any decision. A decision is deny unless a
 * permit applies and no forbid does (Cedar semantics); evaluation errors count as deny.
 */
export const MANDATE_DOMAINS = ['cases', 'documents', 'appointments', 'payments', 'benefits'] as const;
export const MANDATE_LEVELS = ['read', 'submit', 'manage'] as const;
export const NEVER_DELEGATED = ['identity:manage', 'mandates:manage'] as const;
export const MANDATE_ACTIONS: string[] = [...MANDATE_DOMAINS.flatMap((d) => MANDATE_LEVELS.map((l) => `${d}:${l}`)), ...NEVER_DELEGATED];

export interface Uid { type: string; id: string }
export interface EntityJson { uid: Uid; attrs: Record<string, unknown>; parents: Uid[] }
export interface Decision { allowed: boolean; policies: string[]; errors: string[] }
export interface MandateFacts { id: string; principal: string; agent: string; scopes: string[]; active: boolean }

const POLICY_DIR = join(__dirname, '..', 'policies');
const ref = (type: string, id: string) => ({ __entity: { type, id } });

export class PolicyEngine {
  private constructor(private readonly id: string, readonly cedarVersion: string) {}

  /** Loads, validates (strict) and pre-parses the policies; throws if anything does not validate. */
  static load(dir: string = POLICY_DIR, overrides: { policies?: string; schema?: string } = {}): PolicyEngine {
    const policies = overrides.policies ?? ['platform.cedar', 'mandates.cedar'].map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    const schema = overrides.schema ?? readFileSync(join(dir, 'civora.cedarschema'), 'utf8');
    const v = cedar.validate({ schema, policies: { staticPolicies: policies }, validationSettings: { mode: 'strict' } });
    if (v.type !== 'success') throw new Error(`policies do not parse: ${JSON.stringify(v.errors).slice(0, 500)}`);
    if (v.validationErrors.length) throw new Error(`policies fail strict validation: ${JSON.stringify(v.validationErrors).slice(0, 500)}`);
    const id = `civora-${Math.random().toString(36).slice(2)}`;
    const p1 = cedar.preparsePolicySet(id, { staticPolicies: policies });
    const p2 = cedar.preparseSchema(id, schema);
    if (p1.type !== 'success' || p2.type !== 'success') throw new Error('policies or schema do not pre-parse');
    return new PolicyEngine(id, cedar.getCedarVersion());
  }

  decide(req: { principal: Uid; action: string; resource: Uid; context: Record<string, unknown>; entities: EntityJson[] }): Decision {
    const a = cedar.statefulIsAuthorized({
      principal: req.principal, action: { type: 'Action', id: req.action }, resource: req.resource,
      context: req.context, entities: req.entities, preparsedPolicySetId: this.id, preparsedSchemaName: this.id, validateRequest: true,
    } as unknown as cedar.StatefulAuthorizationCall);
    if (a.type !== 'success') return { allowed: false, policies: [], errors: a.errors.map((e) => e.message) };
    return {
      allowed: a.response.decision === 'allow',
      policies: a.response.diagnostics.reason,
      errors: a.response.diagnostics.errors.map((e) => JSON.stringify(e.error)),
    };
  }

  /**
   * May `actor` perform `action` on a record of `owner` (in the action's domain), possibly acting under `mandate`?
   * The caller supplies the mandate's facts as the database holds them now (status and validity give `active`).
   */
  mandateDecision(input: { actor: string; action: string; owner: string; recordDomain?: string; mandate?: MandateFacts }): Decision {
    if (!MANDATE_ACTIONS.includes(input.action)) return { allowed: false, policies: [], errors: [`unknown action ${input.action}`] };
    const domain = input.recordDomain ?? input.action.split(':')[0]!;
    const people = new Set([input.actor, input.owner, ...(input.mandate ? [input.mandate.principal, input.mandate.agent] : [])]);
    const entities: EntityJson[] = [...people].map((p) => ({ uid: { type: 'Person', id: p }, attrs: {}, parents: [] }));
    entities.push({ uid: { type: 'PersonalRecord', id: 'record' }, attrs: { owner: ref('Person', input.owner), domain }, parents: [] });
    if (input.mandate) {
      const m = input.mandate;
      entities.push({ uid: { type: 'Mandate', id: m.id }, attrs: { principal: ref('Person', m.principal), agent: ref('Person', m.agent), scopes: m.scopes, active: m.active }, parents: [] });
    }
    return this.decide({
      principal: { type: 'Person', id: input.actor }, action: input.action, resource: { type: 'PersonalRecord', id: 'record' },
      context: input.mandate ? { actingUnder: ref('Mandate', input.mandate.id) } : {}, entities,
    });
  }
}
