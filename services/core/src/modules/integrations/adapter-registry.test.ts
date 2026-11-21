import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AdapterModeError, assertModeAllowed, type AdapterRegistration } from './adapter-registry';

const reg = (integrationClass: AdapterRegistration['integrationClass']): AdapterRegistration => ({ port: 'P', provider: 'x', registerEntry: 'I-00', integrationClass });
const all = { productionAdaptersFlag: true, agreementRef: 'AGR-1', tenantActivationRef: 'ACT-1' };

describe('adapter modes by integration class (ADR-028)', () => {
  it('class 3 (not authorised): simulated only; sandbox only with written test access; never production', () => {
    assert.equal(assertModeAllowed(reg(3), 'simulated', { productionAdaptersFlag: false }), 'simulated');
    assert.throws(() => assertModeAllowed(reg(3), 'sandbox', { productionAdaptersFlag: false }), AdapterModeError);
    assert.equal(assertModeAllowed(reg(3), 'sandbox', { productionAdaptersFlag: false, sandboxAccessRef: 'letter-1' }), 'sandbox');
    assert.throws(() => assertModeAllowed(reg(3), 'production', all), AdapterModeError);
  });
  it('class 4 simulated only; classes 5 and 6 nothing', () => {
    assert.throws(() => assertModeAllowed(reg(4), 'sandbox', all), AdapterModeError);
    for (const c of [5, 6] as const) assert.throws(() => assertModeAllowed(reg(c), 'simulated', all), AdapterModeError);
  });
  it('production needs all three: agreement, platform flag, tenant activation', () => {
    assert.equal(assertModeAllowed(reg(1), 'production', all), 'production');
    assert.throws(() => assertModeAllowed(reg(1), 'production', { ...all, agreementRef: undefined }), /agreement/);
    assert.throws(() => assertModeAllowed(reg(2), 'production', { ...all, productionAdaptersFlag: false }), /integrations\.production-adapters/);
    assert.throws(() => assertModeAllowed(reg(2), 'production', { ...all, tenantActivationRef: undefined }), /activation/);
  });
});
