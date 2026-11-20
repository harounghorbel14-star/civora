import { Module } from '@nestjs/common';

/**
 * Bounded context: appointments.
 * Built in: Phase 6.
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class AppointmentsModule {}
