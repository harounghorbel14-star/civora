/**
 * Distributed tracing (O-A6, ADR-011). Enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set (the in-cell collector).
 *
 * Privacy rule: spans leave the process only through AllowListExporter, which keeps an explicit list of
 * attributes and drops everything else — full URLs and query strings, client addresses, user agents, headers,
 * SQL text and exception messages never reach the collector. Route templates (`/v1/cases/{id}`) are kept;
 * concrete paths are not.
 *
 * Must be started before NestJS, Express, http and pg are loaded (see main.ts).
 */
import { context, propagation, trace, type Attributes } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator, type ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace';

/** Attributes allowed to leave the process. Anything else is dropped. Review changes like a schema change. */
export const SPAN_ATTRIBUTE_ALLOW_LIST: ReadonlySet<string> = new Set([
  // HTTP (stable and legacy semantic conventions) — templates and codes only
  'http.request.method',
  'http.route',
  'http.response.status_code',
  'http.method',
  'http.status_code',
  'http.flavor',
  'network.protocol.version',
  'url.scheme',
  'server.port',
  'error.type',
  // Framework spans
  'express.name',
  'express.type',
  'nestjs.type',
  'nestjs.module',
  'nestjs.controller',
  'nestjs.callback',
  'nestjs.version',
  'component',
  // Database: system and operation, never statement text or parameters
  'db.system',
  'db.system.name',
  'db.name',
  'db.namespace',
  'db.operation',
  'db.operation.name',
  // CIVORA
  'civora.tenant_id',
  'civora.request_id',
]);

/** Event attributes allowed (exception type only; messages and stack traces may contain input data). */
const EVENT_ATTRIBUTE_ALLOW_LIST: ReadonlySet<string> = new Set(['exception.type']);

export function filterAttributes(attrs: Attributes, allow: ReadonlySet<string> = SPAN_ATTRIBUTE_ALLOW_LIST): Attributes {
  const out: Attributes = {};
  for (const [k, v] of Object.entries(attrs)) if (allow.has(k)) out[k] = v;
  return out;
}

/** Returns a view of the span with filtered attributes and events; the original span object is untouched. */
export function scrubSpan(span: ReadableSpan): ReadableSpan {
  const events = span.events.map((e) => ({ ...e, attributes: e.attributes ? filterAttributes(e.attributes, EVENT_ATTRIBUTE_ALLOW_LIST) : undefined }));
  return Object.create(span, {
    attributes: { value: filterAttributes(span.attributes), enumerable: true },
    events: { value: events, enumerable: true },
    links: { value: [], enumerable: true },
  }) as ReadableSpan;
}

export class AllowListExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.inner.export(spans.map(scrubSpan), resultCallback);
  }
  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
  forceFlush(): Promise<void> {
    return this.inner.forceFlush ? this.inner.forceFlush() : Promise.resolve();
  }
}

const NOT_TRACED = /^\/(health|metrics)(\/|$|\?)/;

export interface TracingHandle {
  shutdown(): Promise<void>;
}

export function startTracing(env: NodeJS.ProcessEnv = process.env): TracingHandle | null {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return null;
  const ratio = Number(env.OTEL_TRACES_SAMPLER_ARG ?? '1');
  const provider = new TracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'civora-core',
      'service.version': env.APP_VERSION ?? '0.1.0-dev',
      'deployment.environment.name': env.CIVORA_ENV ?? 'dev',
      'civora.country_pack': env.COUNTRY_PACK ?? 'tn',
    }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 1) }),
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new AllowListExporter(new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })),
        scheduledDelayMillis: Number(env.OTEL_BSP_SCHEDULE_DELAY ?? '5000'),
      }),
    ],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => NOT_TRACED.test(req.url ?? '') }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  return { shutdown: () => provider.shutdown() };
}
