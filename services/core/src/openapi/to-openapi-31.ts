/**
 * OpenAPI 3.0 → 3.1 conversion for the generated contract (ADR-015, O-API3).
 * @nestjs/swagger emits 3.0 schema keywords. OpenAPI 3.1 uses JSON Schema 2020-12, where `nullable` does not exist:
 *   { type: 'string', nullable: true }      → { type: ['string', 'null'] }
 *   { $ref | allOf | oneOf …, nullable: true } → { anyOf: [ <schema without nullable>, { type: 'null' } ] }
 * Schema-level `example` is kept (still valid in 3.1, though `examples` is preferred).
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function convertSchemas(node: Json): Json {
  if (Array.isArray(node)) return node.map(convertSchemas);
  if (node === null || typeof node !== 'object') return node;
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(node)) out[k] = convertSchemas(v);
  if (out.nullable === true) {
    delete out.nullable;
    if (typeof out.type === 'string') {
      out.type = [out.type, 'null'];
    } else if (Array.isArray(out.type)) {
      if (!out.type.includes('null')) out.type = [...out.type, 'null'];
    } else {
      return { anyOf: [out, { type: 'null' }] };
    }
  } else if (out.nullable === false) {
    delete out.nullable;
  }
  return out;
}

export function toOpenApi31<T extends object>(doc: T): T {
  const converted = convertSchemas(doc as unknown as Json) as { [k: string]: Json };
  converted.openapi = '3.1.0';
  converted.jsonSchemaDialect = 'https://spec.openapis.org/oas/3.1/dialect/base';
  return converted as unknown as T;
}
