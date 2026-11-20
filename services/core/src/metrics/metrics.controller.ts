import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { collectDefaultMetrics, register } from '@prometheus-io/client';

collectDefaultMetrics({ prefix: 'civora_core_' });

/**
 * Prometheus metrics (ADR-011). Internal only: the ingress does not route /metrics publicly.
 * Metrics carry no personal data and no tenant-identifying labels beyond tenant ids.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
