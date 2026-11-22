'use client';

import { useActionState } from 'react';
import { statusStep, type StatusState } from './actions';

/** Two steps in one page: reference, then the one-time code. Texts come from the server, already translated. */
export function StatusForm({ lang, text, states }: { lang: string; text: Record<string, string>; states: Record<string, string> }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(statusStep, { step: 'reference' });
  if (state.step === 'status') {
    const line = text.result!.replace('{reference}', state.reference).replace('{institution}', state.institution)
      .replace('{status}', states[state.status] ?? state.status).replace('{date}', state.since);
    return (
      <div>
        <p className="notice notice-success" role="status" data-testid="status-result" data-status={state.status}>{line}</p>
        <form action={action}><input type="hidden" name="lang" value={lang} /><input type="hidden" name="step" value="reference" />
          <input type="hidden" name="reference" value={state.reference} /><button type="submit" className="secondary">{text.again}</button></form>
      </div>
    );
  }
  if (state.step === 'code') {
    return (
      <form action={action} className="stack" data-testid="status-code-form">
        <p className="notice notice-info" role="status" data-testid="status-sent">{text.sent}</p>
        {state.error === 'wrong' && <p className="notice notice-danger" role="alert" data-testid="status-wrong">{text.wrong}</p>}
        <input type="hidden" name="lang" value={lang} /><input type="hidden" name="step" value="code" />
        <label>{text.code} <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" required data-testid="status-code" /></label>
        <button type="submit" disabled={pending} data-testid="status-show">{text.show}</button>
      </form>
    );
  }
  return (
    <form action={action} className="stack" data-testid="status-reference-form">
      {state.error && <p className="notice notice-danger" role="alert" data-testid={`status-error-${state.error}`}>{text[state.error]}</p>}
      <input type="hidden" name="lang" value={lang} /><input type="hidden" name="step" value="reference" />
      <label>{text.reference} <input name="reference" dir="ltr" autoComplete="off" required data-testid="status-reference" /></label>
      <button type="submit" disabled={pending} data-testid="status-send">{text.send}</button>
    </form>
  );
}
