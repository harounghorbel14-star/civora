'use strict';
/**
 * TEST ONLY: writes the attestation certificate of Chromium's WebAuthn virtual authenticator as a PEM file, to be
 * mounted into the test Keycloak's truststore. It plays the part of a vendor's attestation root, so that the staff
 * realm's approved-key list (AAGUID) and attestation verification can be tested end to end. Never used in a cell.
 * Usage: node attestation-root.cjs OUT.pem EXPECTED_AAGUID
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');

// Minimal CBOR decoding: enough for a WebAuthn attestation object.
function cbor(buf) {
  let i = 0;
  const read = () => {
    const b = buf[i++];
    const major = b >> 5;
    const info = b & 31;
    let v;
    if (info < 24) v = info;
    else if (info === 24) v = buf[i++];
    else if (info === 25) { v = buf.readUInt16BE(i); i += 2; }
    else if (info === 26) { v = buf.readUInt32BE(i); i += 4; }
    else throw new Error(`unsupported CBOR length ${info}`);
    if (major === 0) return v;
    if (major === 1) return -1 - v;
    if (major === 2) { const o = buf.subarray(i, i + v); i += v; return o; }
    if (major === 3) { const o = buf.subarray(i, i + v).toString(); i += v; return o; }
    if (major === 4) return Array.from({ length: v }, read);
    if (major === 5) { const m = {}; for (let k = 0; k < v; k++) { const key = read(); m[key] = read(); } return m; }
    throw new Error(`unsupported CBOR type ${major}`);
  };
  return read();
}

(async () => {
  const [out, expected] = process.argv.slice(2);
  const server = http.createServer((_, res) => res.end('<!doctype html><title>attestation</title>')).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const browser = await chromium.launch({ args: ['--no-proxy-server'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable', { enableUI: false });
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: false, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await page.goto(`http://localhost:${server.address().port}/`); // localhost: a secure context
    const att = await page.evaluate(async () => {
      const c = await navigator.credentials.create({ publicKey: {
        rp: { name: 'attestation', id: 'localhost' }, user: { id: new Uint8Array(16), name: 'a', displayName: 'a' },
        challenge: crypto.getRandomValues(new Uint8Array(32)), pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        attestation: 'direct', authenticatorSelection: { userVerification: 'required' },
      } });
      return Array.from(new Uint8Array(c.response.attestationObject));
    });
    const obj = cbor(Buffer.from(att));
    const aaguid = obj.authData.subarray(37, 53).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    if (expected && aaguid !== expected) throw new Error(`virtual authenticator AAGUID ${aaguid}, expected ${expected}`);
    const der = obj.attStmt?.x5c?.[0];
    if (!der) throw new Error(`no attestation certificate (format ${obj.fmt})`);
    fs.writeFileSync(out, `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`);
    console.log(`  info test attestation root written (format ${obj.fmt}, AAGUID ${aaguid})`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(`  FAIL ${e.message}`); process.exit(1); });
