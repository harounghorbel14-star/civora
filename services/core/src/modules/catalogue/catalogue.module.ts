import { Module } from '@nestjs/common';

/**
 * Bounded context: catalogue.
 * Built in: Phase 5 (Government Services Directory; taxonomy reused by Workspace).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class CatalogueModule {}
