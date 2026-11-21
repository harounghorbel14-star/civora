/**
 * Mandate rules (P3-F5). The database enforces the same limits (check constraints); these checks give clear
 * errors before the call and keep identity management out of delegation.
 */
export const MANDATE_DOMAINS = ['cases', 'documents', 'appointments', 'payments', 'benefits'] as const;
export const MANDATE_ACTIONS = ['read', 'submit', 'manage'] as const;
export const MAX_SCOPES = 20;
export const MAX_DURATION_DAYS = 366;

export interface MandateRequest {
  scopes: string[];
  validFrom: Date;
  expiresAt: Date;
}

/** Returns the problems with a mandate request; empty when valid. Mandates can never delegate identity or mandates. */
export function mandateProblems(input: { scopes?: unknown; validFrom?: unknown; expiresAt?: unknown }, now = new Date()): string[] {
  const problems: string[] = [];
  const scopes = input.scopes;
  if (!Array.isArray(scopes) || scopes.length === 0) problems.push('scopes: at least one scope is required');
  else {
    if (scopes.length > MAX_SCOPES) problems.push(`scopes: at most ${MAX_SCOPES}`);
    if (new Set(scopes).size !== scopes.length) problems.push('scopes: duplicates are not allowed');
    scopes.forEach((s, i) => {
      const [domain, action, extra] = typeof s === 'string' ? s.split(':') : [];
      if (extra !== undefined || !MANDATE_DOMAINS.includes(domain as never) || !MANDATE_ACTIONS.includes(action as never)) {
        problems.push(`scopes[${i}]: must be one of ${MANDATE_DOMAINS.join('|')}:${MANDATE_ACTIONS.join('|')}`);
      }
    });
  }
  const from = input.validFrom === undefined ? now : new Date(String(input.validFrom));
  const to = new Date(String(input.expiresAt));
  if (Number.isNaN(from.getTime())) problems.push('validFrom: not a date-time');
  if (input.expiresAt === undefined || Number.isNaN(to.getTime())) problems.push('expiresAt: a date-time is required');
  else if (!Number.isNaN(from.getTime())) {
    if (to.getTime() <= from.getTime()) problems.push('expiresAt: must be after validFrom');
    if (to.getTime() - from.getTime() > MAX_DURATION_DAYS * 86_400_000) problems.push(`expiresAt: at most ${MAX_DURATION_DAYS} days after validFrom`);
    if (to.getTime() <= now.getTime()) problems.push('expiresAt: must be in the future');
  }
  if (!Number.isNaN(from.getTime()) && from.getTime() < now.getTime() - 60_000) problems.push('validFrom: cannot be in the past');
  return problems;
}

/** Status as the parties see it: an active or proposed mandate past its expiry is "expired". */
export function effectiveStatus(status: string, expiresAt: Date, now = new Date()): string {
  return (status === 'active' || status === 'proposed') && expiresAt.getTime() <= now.getTime() ? 'expired' : status;
}

/** Accessibility preferences a person may set (P3-F4); anything else is refused. */
export const ACCESSIBILITY_KEYS: Record<string, (v: unknown) => boolean> = {
  textSize: (v) => v === 'default' || v === 'large' || v === 'x-large',
  highContrast: (v) => typeof v === 'boolean',
  reducedMotion: (v) => typeof v === 'boolean',
  simplifiedLanguage: (v) => typeof v === 'boolean',
  screenReaderHints: (v) => typeof v === 'boolean',
};

export function accessibilityProblems(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['accessibility: an object is required'];
  const problems: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const check = ACCESSIBILITY_KEYS[k];
    if (!check) problems.push(`accessibility: unknown preference (allowed: ${Object.keys(ACCESSIBILITY_KEYS).join(', ')})`);
    else if (!check(v)) problems.push(`accessibility: invalid value for "${k}"`);
  }
  return problems;
}
