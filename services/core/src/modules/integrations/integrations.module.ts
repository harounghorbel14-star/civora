import { Module } from '@nestjs/common';

/**
 * Bounded context: integrations.
 * Built in: Phase 12 (adapter registry; simulated adapters earlier).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class IntegrationsModule {}
