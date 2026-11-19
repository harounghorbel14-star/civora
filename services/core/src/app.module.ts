import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { CountryConfigModule } from './country-config/country-config.module';
import { FlagsModule } from './flags/flags.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { MetricsController } from './metrics/metrics.controller';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { CasesModule } from './modules/cases/cases.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { ConsentAuditModule } from './modules/consent-audit/consent-audit.module';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletModule } from './modules/wallet/wallet.module';

/**
 * civora-core modular monolith (ADR-001). Platform modules first, then the empty bounded contexts
 * that later phases fill. No business endpoints exist in Phase 2.
 */
@Module({
  imports: [
    CountryConfigModule,
    FlagsModule,
    HealthModule,
    MetaModule,
    IdentityAccessModule,
    CatalogueModule,
    CasesModule,
    AppointmentsModule,
    WalletModule,
    PaymentsModule,
    NotificationsModule,
    ConsentAuditModule,
    IntegrationsModule,
  ],
  controllers: [MetricsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
