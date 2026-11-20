import { Module } from '@nestjs/common';

/**
 * Bounded context: cases.
 * Built in: Phase 6 (Workspace v1 case engine; Workspace RF rule packs FR-60–FR-66).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class CasesModule {}
