import { Module } from '@nestjs/common';

/**
 * Bounded context: wallet.
 * Built in: Phase 4 (verifiable credentials, documents).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class WalletModule {}
