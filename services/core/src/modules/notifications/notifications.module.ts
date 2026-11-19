import { Module } from '@nestjs/common';

/**
 * Bounded context: notifications.
 * Built in: Phases 3–6.
 * Rules (ADR-001): own schema only; other modules use ./public-api.ts or domain events; no cross-module database access.
 */
@Module({})
export class NotificationsModule {}
