'use server';

import { publicCoreCall } from '@/lib/core';
import { reportMessage, reportTarget } from '@/lib/directory';
import { config, correlationId } from '@/server/context';

/** The form's state, kept in the page (useActionState). The message stays in the form when it could not be sent. */
export type ReportState =
  | { step: 'write'; error?: 'invalid' | 'unknown' | 'busy' | 'unavailable'; message?: string }
  | { step: 'sent' };

/** Forwards a report to the core (P5-F4, POST /v1/feedback/content-errors). Only the message is sent: no name, no contact. */
export async function sendReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  const target = reportTarget(form.get('code'), form.get('version'));
  const raw = form.get('message');
  const kept = typeof raw === 'string' ? raw.slice(0, 2000) : '';
  if (!target) return { step: 'write', error: 'unknown', message: kept };
  const message = reportMessage(raw);
  if (!message) return { step: 'write', error: 'invalid', message: kept };
  const r = await publicCoreCall(config(), '/v1/feedback/content-errors', { service_code: target.code, version: target.version, message }, await correlationId())
    .catch(() => null);
  if (r?.status === 201) return { step: 'sent' };
  return { step: 'write', message: kept, error: r?.status === 404 ? 'unknown' : r?.status === 400 ? 'invalid' : r?.status === 429 ? 'busy' : 'unavailable' };
}
