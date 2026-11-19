import { Module } from '@nestjs/common';

/**
 * Bounded context: payments.
 * Built in: Phase 8.
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class PaymentsModule {}
