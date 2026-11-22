import { Socket } from 'node:net';
import { type AdapterMode, type AdapterRegistration, assertModeAllowed } from '../../../adapter-registry';
import type { IntegrationLogger } from '../../../integration-log';
import { MessageNotSent, type MessagingChannel, type OutboundMessage } from '../../../ports/messaging';

/**
 * MessagingChannel, simulated mode: plain SMTP to the cell's mail catcher (dev and test only; no TLS, no
 * authentication, nothing leaves the cell). Recipients must be synthetic addresses (*.invalid).
 */
export const SIMULATED_EMAIL: AdapterRegistration = { port: 'MessagingChannel', provider: 'simulated-smtp', registerEntry: 'M-02', integrationClass: 3 };

export interface SimulatedSmtpConfig { host: string; port: number; from: string }

export function loadSimulatedSmtpConfig(env: NodeJS.ProcessEnv = process.env): SimulatedSmtpConfig | null {
  const host = env.MESSAGING_SMTP_HOST;
  if (!host) return null;
  if (!['dev', 'test'].includes(env.CIVORA_ENV ?? 'dev')) throw new Error('the simulated e-mail channel runs in dev and test only');
  const port = Number(env.MESSAGING_SMTP_PORT ?? 1025);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MESSAGING_SMTP_PORT must be a port number');
  return { host, port, from: env.MESSAGING_FROM ?? 'no-reply@civora-cell.invalid' };
}

const ADDRESS = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]+\.invalid$/;

/** RFC 2047 encoded word for a non-ASCII subject (Arabic, French). */
const encodeHeader = (s: string): string => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

export class SimulatedSmtpChannel implements MessagingChannel {
  readonly registration = SIMULATED_EMAIL;
  readonly mode: AdapterMode = assertModeAllowed(SIMULATED_EMAIL, 'simulated', { productionAdaptersFlag: false });

  constructor(private readonly cfg: SimulatedSmtpConfig, private readonly log: IntegrationLogger) {}

  async send(m: OutboundMessage): Promise<void> {
    const started = Date.now();
    let outcome: 'ok' | 'rejected' | 'unavailable' = 'ok';
    try {
      if (!ADDRESS.test(m.to)) { outcome = 'rejected'; throw new MessageNotSent('only synthetic addresses (*.invalid) in simulated mode'); }
      await this.smtp(m);
    } catch (e) {
      if (outcome === 'ok') outcome = 'unavailable';
      throw e instanceof MessageNotSent ? e : new MessageNotSent('mail catcher unreachable');
    } finally {
      this.log({ correlationId: m.correlationId, port: SIMULATED_EMAIL.port, provider: SIMULATED_EMAIL.provider, mode: this.mode, operation: 'send',
        purpose: m.purpose, legalBasisRef: 'none: simulated channel, synthetic recipients only', outcome, latencyMs: Date.now() - started });
    }
  }

  private smtp(m: OutboundMessage): Promise<void> {
    const body = Buffer.from(m.text, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
    const data = [`From: ${this.cfg.from}`, `To: ${m.to}`, `Subject: ${encodeHeader(m.subject)}`, 'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', body, '.'].join('\r\n');
    const steps = ['EHLO civora-core', `MAIL FROM:<${this.cfg.from}>`, `RCPT TO:<${m.to}>`, 'DATA', data, 'QUIT'];
    return new Promise((resolve, reject) => {
      const sock = new Socket();
      let buffer = '';
      let i = -1; // -1: waiting for the greeting
      sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('timeout')); });
      sock.on('error', reject);
      sock.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\r\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (/^\d{3}-/.test(line)) continue; // multi-line reply continues
          if (!/^[23]\d\d /.test(line)) { sock.destroy(); reject(new Error(`smtp: ${line.slice(0, 3)}`)); return; }
          i++;
          if (i < steps.length) sock.write(`${steps[i]}\r\n`);
          else { sock.end(); resolve(); }
        }
      });
      sock.connect(this.cfg.port, this.cfg.host);
    });
  }
}
