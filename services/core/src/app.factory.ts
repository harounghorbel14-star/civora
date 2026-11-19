import 'reflect-metadata';
import { type INestApplication, type LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

/** Structured JSON logs (ADR-011). Never logs request bodies, headers or personal data. */
export class JsonLogger implements LoggerService {
  private write(level: string, message: unknown, context?: string): void {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, service: 'civora-core', context, msg: String(message) }) + '\n');
  }
  log(message: unknown, context?: string): void { this.write('info', message, context); }
  error(message: unknown, _trace?: string, context?: string): void { this.write('error', message, context); }
  warn(message: unknown, context?: string): void { this.write('warn', message, context); }
  debug(message: unknown, context?: string): void { this.write('debug', message, context); }
  verbose(message: unknown, context?: string): void { this.write('trace', message, context); }
}

export async function createApp(opts: { logger?: LoggerService | false } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: opts.logger ?? new JsonLogger(), bufferLogs: false });
  const http = app.getHttpAdapter().getInstance() as { disable?: (name: string) => void };
  http.disable?.('x-powered-by');
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}

/** Public OpenAPI contract (ADR-015). /metrics is excluded; internal routes never appear in the public contract. */
export function buildOpenApi(app: INestApplication, version: string): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('CIVORA Core API')
    .setDescription('Phase 2 walking skeleton. Contains platform endpoints only. Synthetic data only; no production integrations.')
    .setVersion(version)
    .setLicense('Proprietary — all rights reserved', 'https://docs.civora.invalid/licence')
    .addServer('http://localhost:3000', 'Local development cell')
    .build();
  return SwaggerModule.createDocument(app, config);
}
