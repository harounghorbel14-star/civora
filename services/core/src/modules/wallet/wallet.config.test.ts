import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadOfficerTenant } from './wallet.config';

describe('wallet configuration: the issuing institution of the credential officers (P4-F5)', () => {
  const tenant = '6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b';
  it('required when the wallet is on outside dev and test; a UUID', () => {
    assert.throws(() => loadOfficerTenant({ CIVORA_ENV: 'staging', WALLET_PUBLIC_URL: 'https://wallet.civora-cell.invalid' }), /WALLET_OFFICER_TENANT is required/);
    assert.equal(loadOfficerTenant({ CIVORA_ENV: 'prod', WALLET_PUBLIC_URL: 'https://wallet.civora-cell.invalid', WALLET_OFFICER_TENANT: ` ${tenant} ` }), tenant);
    assert.throws(() => loadOfficerTenant({ CIVORA_ENV: 'prod', WALLET_PUBLIC_URL: 'https://w.invalid', WALLET_OFFICER_TENANT: 'civil-registry' }), /a UUID/);
  });
  it('not required in a cell without the wallet, nor in dev and test', () => {
    assert.equal(loadOfficerTenant({ CIVORA_ENV: 'staging' }), null);
    assert.equal(loadOfficerTenant({ CIVORA_ENV: 'dev', WALLET_PUBLIC_URL: 'https://wallet.civora-cell.invalid' }), null);
    assert.equal(loadOfficerTenant({ CIVORA_ENV: 'test', WALLET_PUBLIC_URL: 'https://wallet.civora-cell.invalid' }), null);
  });
});
