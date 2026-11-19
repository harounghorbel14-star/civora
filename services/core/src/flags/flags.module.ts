import { Global, Module } from '@nestjs/common';
import type { LoadedPack } from '@civora/country-packs';
import { initFlags } from '@civora/feature-flags';
import { COUNTRY_PACK } from '../country-config/country-config.module';

export const FLAGS = Symbol('FLAGS');

@Global()
@Module({
  providers: [
    {
      provide: FLAGS,
      inject: [COUNTRY_PACK],
      // Tenant overrides come from the tenant registry in Phase 3; Phase 2 uses pack defaults only.
      useFactory: (loaded: LoadedPack) => initFlags({ packDefaults: loaded.pack.featureFlags }, `core-${loaded.pack.packId}`),
    },
  ],
  exports: [FLAGS],
})
export class FlagsModule {}
