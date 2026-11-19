import { Module } from '@nestjs/common';

/**
 * Bounded context: identity-access.
 * Built in: Phase 3 (staff SSO, customer OTP, citizen accounts).
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class IdentityAccessModule {}
