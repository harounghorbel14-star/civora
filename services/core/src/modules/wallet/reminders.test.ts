import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { OutboundMessage } from '../integrations/public-api';
import { type DueReminder, ExpiryReminders } from './reminders';

const NOW = Date.parse('2026-12-01T09:00:00Z');
const due = (over: Partial<DueReminder> = {}): DueReminder => ({
  entryId: 'e1', personId: 'p1', vct: 'urn:civora:tn:synthetic:residence-certificate:1', expiresAt: new Date(NOW + 20 * 86_400_000), threshold: 30,
  renewalServiceSlug: 'residence-certificate', display: { ar: 'شهادة إقامة', fr: 'Certificat de résidence', en: 'Residence certificate' }, ...over,
});

function harness(items: DueReminder[], contact: { email: string; locale: string } | null, failSend = false) {
  const sent: OutboundMessage[] = [];
  const marked: [string, number][] = [];
  const logs: Record<string, unknown>[] = [];
  const r = new ExpiryReminders({
    due: async () => items,
    mark: async (e, t) => { marked.push([e, t]); return true; },
    contacts: { contactOf: async () => contact },
    messaging: { registration: {} as never, mode: 'simulated' as never, send: async (m) => { if (failSend) throw new Error('smtp down'); sent.push(m); } },
    appOrigin: 'https://app.civora-cell.invalid',
    log: (e) => logs.push(e),
    now: () => NOW,
  });
  return { r, sent, marked, logs };
}

describe('expiry reminders (P4-D5) with renewal deep-links (P4-F6)', () => {
  it('in the person\'s language: the type, the date, the days left and the renewal link; then marked sent', async () => {
    for (const [locale, word, path] of [['fr-TN', 'Certificat de résidence', '/fr/services/residence-certificate'], ['ar-TN', 'شهادة إقامة', '/ar/services/residence-certificate'], ['en', 'Residence certificate', '/en/services/residence-certificate']] as const) {
      const h = harness([due()], { email: 'synthetic.person@example.invalid', locale });
      assert.deepEqual(await h.r.runOnce(), { sent: 1, noContact: 0, failed: 0 });
      const m = h.sent[0]!;
      assert.equal(m.to, 'synthetic.person@example.invalid');
      assert.ok(m.text.includes(word), `${locale}: type name`);
      assert.ok(m.text.includes('20'), `${locale}: days left`);
      assert.ok(m.text.includes(`https://app.civora-cell.invalid${path}`), `${locale}: renewal link`);
      assert.equal(m.purpose, 'wallet-expiry-reminder');
      assert.deepEqual(h.marked, [['e1', 30]]);
    }
  });

  it('without a renewal service: tells the person to contact the issuer; an unknown type gets a generic name', async () => {
    const h = harness([due({ renewalServiceSlug: null, display: null })], { email: 'synthetic.person@example.invalid', locale: 'en' });
    await h.r.runOnce();
    assert.ok(h.sent[0]!.text.includes('Digital document'));
    assert.ok(h.sent[0]!.text.includes('contact the organisation'));
    assert.ok(!h.sent[0]!.text.includes('https://'));
  });

  it('no contact: nothing sent, marked handled; a failed send is not marked (retried on the next pass)', async () => {
    const h = harness([due()], null);
    assert.deepEqual(await h.r.runOnce(), { sent: 0, noContact: 1, failed: 0 });
    assert.deepEqual(h.marked, [['e1', 30]]);
    const f = harness([due()], { email: 'synthetic.person@example.invalid', locale: 'fr' }, true);
    assert.deepEqual(await f.r.runOnce(), { sent: 0, noContact: 0, failed: 1 });
    assert.deepEqual(f.marked, []);
    assert.equal(f.logs[0]!.outcome, 'not-sent');
  });
});
