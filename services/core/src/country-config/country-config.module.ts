import { Global, Module } from '@nestjs/common';
import { loadCountryPack, type LoadedPack } from '@civora/country-packs';
import { APP_CONFIG, type AppConfig, loadAppConfig } from '../config/app-config';

export const COUNTRY_PACK = Symbol('COUNTRY_PACK');

/**
 * country-config module: loads and verifies the country pack once at start-up (ADR-017).
 * A tampered or invalid pack stops the service from starting.
 * Pilot/production refuse a pack whose status is synthetic-development-only (ADR-025).
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: (): AppConfig => loadAppConfig() },
    {
      provide: COUNTRY_PACK,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): LoadedPack => {
        const loaded = loadCountryPack(cfg.countryPack);
        if ((cfg.environment === 'pilot' || cfg.environment === 'prod') && loaded.pack.status === 'synthetic-development-only') {
          throw new Error(`country pack ${loaded.pack.packId}@${loaded.pack.version} is synthetic-development-only and cannot run in ${cfg.environment}`);
        }
        return loaded;
      },
    },
  ],
  exports: [APP_CONFIG, COUNTRY_PACK],
})
export class CountryConfigModule {}
