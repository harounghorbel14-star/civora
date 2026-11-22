import { Module } from '@nestjs/common';
import { type CaseStatusDirectory, loadCaseStatusDirectory } from './case-status';
import { CASE_STATUS_DIRECTORY } from './tokens';

/**
 * Bounded context: cases.
 * Built in: Phase 6 (Workspace v1 case engine; Workspace RF rule packs FR-60–FR-66). Phase 3: only the status view that
 * the customer status page needs (P3-R2), from a synthetic directory in dev and test.
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({
  providers: [{ provide: CASE_STATUS_DIRECTORY, useFactory: (): CaseStatusDirectory | null => loadCaseStatusDirectory() }],
  exports: [CASE_STATUS_DIRECTORY],
})
export class CasesModule {}
