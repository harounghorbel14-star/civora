import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

/**
 * RFC 9457 problem details for every error (ADR-015).
 * Never echoes request input (query, headers, body) or stack traces to clients: the title is the standard reason
 * phrase for the status, never an exception message (the router's 404 message contains the full URL with its query
 * string). Internal errors are logged with the request id only.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;
    // Validation problems (fixed messages written by the code; they never echo the submitted values).
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const errors = status === 400 && body && typeof body === 'object' && Array.isArray((body as { errors?: unknown }).errors)
      ? ((body as { errors: unknown[] }).errors).slice(0, 20).map(String) : undefined;
    if (status >= 500) this.logger.error(`unhandled error requestId=${requestId ?? '-'} type=${(exception as Error)?.name ?? 'unknown'}`);
    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://docs.civora.invalid/problems/${status}`,
        title: STATUS_CODES[status] ?? 'Error',
        status,
        instance: req.originalUrl?.split('?')[0],
        requestId,
        ...(errors ? { errors } : {}),
      });
  }
}
