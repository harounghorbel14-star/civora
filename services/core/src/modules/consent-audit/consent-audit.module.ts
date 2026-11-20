import { Module } from '@nestjs/common';

/**
 * Bounded context: consent-audit.
 * Built in: Phases 3–6 (hash-chained audit; consent for Government track).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class ConsentAuditModule {}
