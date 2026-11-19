import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { toOpenApi31 } from './to-openapi-31';

describe('toOpenApi31', () => {
  it('sets the version and dialect', () => {
    const out = toOpenApi31({ openapi: '3.0.0', paths: {} }) as Record<string, unknown>;
    assert.equal(out.openapi, '3.1.0');
    assert.equal(out.jsonSchemaDialect, 'https://spec.openapis.org/oas/3.1/dialect/base');
  });
  it('turns nullable primitive types into type arrays', () => {
    const out = toOpenApi31({ components: { schemas: { A: { properties: { region: { type: 'string', nullable: true, example: 'TN' } } } } } }) as any;
    assert.deepEqual(out.components.schemas.A.properties.region, { type: ['string', 'null'], example: 'TN' });
  });
  it('wraps nullable references in anyOf', () => {
    const out = toOpenApi31({ s: { allOf: [{ $ref: '#/components/schemas/B' }], nullable: true } }) as any;
    assert.deepEqual(out.s, { anyOf: [{ allOf: [{ $ref: '#/components/schemas/B' }] }, { type: 'null' }] });
  });
  it('drops nullable: false and leaves other schemas untouched', () => {
    const out = toOpenApi31({ s: { type: 'integer', nullable: false }, t: { type: 'string' } }) as any;
    assert.deepEqual(out.s, { type: 'integer' });
    assert.deepEqual(out.t, { type: 'string' });
  });
});
