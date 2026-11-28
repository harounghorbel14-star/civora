'use client';

import { useActionState } from 'react';
import { sendReport, type ReportState } from './actions';

/** The report form. Texts come from the server, already translated; it also works without scripts. */
export function ReportForm({ lang, code, version, text }: { lang: string; code: string; version: number; text: Record<string, string> }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(sendReport, { step: 'write' });
  if (state.step === 'sent') {
    return <p className="notice notice-success" role="status" data-testid="report-sent">{text.sent}</p>;
  }
  return (
    <form action={action} className="stack" data-testid="report-form">
      {state.error && <p className="notice notice-danger" role="alert" data-testid={`report-error-${state.error}`}>{text[state.error]}</p>}
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="version" value={String(version)} />
      <label>{text.label}
        <textarea name="message" rows={6} minLength={5} maxLength={2000} required defaultValue={state.message ?? ''}
          aria-describedby="report-hint" data-testid="report-message" />
      </label>
      <p id="report-hint" className="hint">{text.hint}</p>
      <button type="submit" disabled={pending} data-testid="report-submit">{text.submit}</button>
    </form>
  );
}
