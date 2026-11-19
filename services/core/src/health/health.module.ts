import { Module } from '@nestjs/common';
import { DatabaseProbe } from './database-probe';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController], providers: [DatabaseProbe] })
export class HealthModule {}
