import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { accessibilityProblems, effectiveStatus, mandateProblems } from './mandate-rules';

const now = new Date('2026-11-21T10:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe('mandate rules (P3-F5, P3-T4)', () => {
  it('accepts allowed scopes and a duration within a year', () => {
    assert.deepEqual(mandateProblems({ scopes: ['cases:read', 'payments:submit'], expiresAt: days(30) }, now), []);
  });
  it('refuses identity and mandate management as scopes (no delegation of delegation)', () => {
    assert.equal(mandateProblems({ scopes: ['mandates:manage'], expiresAt: days(1) }, now).length, 1);
    assert.equal(mandateProblems({ scopes: ['identity:manage'], expiresAt: days(1) }, now).length, 1);
  });
  it('refuses malformed, duplicate and too many scopes, without echoing input', () => {
    const p = mandateProblems({ scopes: ['cases:read', 'cases:read', 'x:y:z', '<script>'], expiresAt: days(1) }, now);
    assert.ok(p.some((m) => m.includes('duplicates')));
    assert.ok(!p.some((m) => m.includes('<script>')));
    assert.ok(mandateProblems({ scopes: Array.from({ length: 21 }, (_, i) => (i % 2 ? 'cases:read' : 'cases:submit')), expiresAt: days(1) }, now).some((m) => m.includes('at most 20')));
  });
  it('refuses missing, past and over-long expiry, and a start in the past', () => {
    assert.ok(mandateProblems({ scopes: ['cases:read'] }, now).some((m) => m.startsWith('expiresAt')));
    assert.ok(mandateProblems({ scopes: ['cases:read'], expiresAt: days(-1) }, now).some((m) => m.startsWith('expiresAt')));
    assert.ok(mandateProblems({ scopes: ['cases:read'], expiresAt: days(400) }, now).some((m) => m.includes('366')));
    assert.ok(mandateProblems({ scopes: ['cases:read'], validFrom: days(-2), expiresAt: days(5) }, now).some((m) => m.startsWith('validFrom')));
  });
  it('derives "expired" from the expiry date', () => {
    assert.equal(effectiveStatus('active', new Date(now.getTime() - 1), now), 'expired');
    assert.equal(effectiveStatus('revoked', new Date(now.getTime() - 1), now), 'revoked');
    assert.equal(effectiveStatus('active', new Date(now.getTime() + 1000), now), 'active');
  });
});

describe('accessibility preferences (P3-F4)', () => {
  it('accepts known keys with valid values and refuses the rest', () => {
    assert.deepEqual(accessibilityProblems({ textSize: 'large', highContrast: true }), []);
    assert.equal(accessibilityProblems({ textSize: 'huge' }).length, 1);
    assert.equal(accessibilityProblems({ fontColour: 'red' }).length, 1);
    assert.equal(accessibilityProblems([]).length, 1);
  });
});
