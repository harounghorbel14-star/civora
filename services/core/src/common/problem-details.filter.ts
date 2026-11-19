import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * RFC 9457 problem details for every error (ADR-015).
 * Never echoes request bodies or stack traces to clients; internal errors are logged with the request id only.
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
    if (status >= 500) this.logger.error(`unhandled error requestId=${requestId ?? '-'} type=${(exception as Error)?.name ?? 'unknown'}`);
    const title = exception instanceof HttpException ? exception.message : 'Internal Server Error';
    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `https://docs.civora.invalid/problems/${status}`,
        title: status >= 500 ? 'Internal Server Error' : title,
        status,
        instance: req.originalUrl?.split('?')[0],
        requestId,
      });
  }
}
