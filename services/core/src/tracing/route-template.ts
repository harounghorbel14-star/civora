import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { context } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';

/**
 * The route template of a request (`/v1/oid4vp/requests/:id`), for the HTTP server span's `http.route` and name
 * (tracing, O-A6). The HTTP instrumentation reads it from the request's RPC metadata when the response ends.
 *
 * This used to come from @opentelemetry/instrumentation-nestjs-core, which supports @nestjs/core below 12 only (0.72.1,
 * the latest release on 28 Nov 2026). Recording it here does not depend on that instrumentation. It is the route as
 * declared (Express's matched `req.route.path`), never the concrete path: no identifier from the URL is exported.
 */
export function recordRouteTemplate(req: { route?: { path?: unknown }; baseUrl?: unknown }): string | undefined {
  const path = req.route?.path;
  if (typeof path !== 'string') return undefined;
  const template = `${typeof req.baseUrl === 'string' ? req.baseUrl : ''}${path}`;
  const md = getRPCMetadata(context.active());
  if (md?.type === RPCType.HTTP) md.route = template;
  return template;
}

/**
 * A global guard that never refuses: global guards run before the routes' own guards, so the template is recorded even
 * for requests a route's guard turns away (401, 403).
 */
export class RouteTemplateGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() === 'http') recordRouteTemplate(ctx.switchToHttp().getRequest());
    return true;
  }
}
