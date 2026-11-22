# Password deny list and context words (ASVS 5.0 V6.1.2, V6.2.4, V6.2.11, V6.2.12)

Used by the password policy of the `civora-citizens` and `civora-staff` realms
([Phase 3 doc 11](../../../docs/phase-3/11-security-verification.md)):

```
passwordBlacklist(civora-deny.txt) and regexPattern((?is)^(?!.*(?:<context words>)).*$)
```

| File | What it is |
|---|---|
| `civora-deny.txt` | 47,200 common and breached passwords, lower case, sorted, one per line. Keycloak compares case-insensitively. Only entries of 12 to 128 characters are kept: shorter ones are already refused by `length(12)` |
| `context-words.txt` | Words that must not appear anywhere in a password (product, country, institution words in Arabic, French and English). The realm checker (`infra/scripts/check-realm-security.py`) requires every word of this file in the realms' `regexPattern` |

## Where Keycloak finds the list

Keycloak reads `data/password-blacklists/civora-deny.txt` under its home directory. A realm import or a password
change **fails** when the file is missing, so a missing list cannot silently weaken the policy.

| Deployment | How the file gets there |
|---|---|
| Realms test (`infra/tests/keycloak-realms/run.sh`) | bind mount |
| Dev cell (`infra/compose/compose.yaml`) | bind mount |
| Kubernetes (`infra/k8s/keycloak/keycloak.yaml`) | ConfigMap `keycloak-password-deny-list` (690 KB, under the 1 MiB limit) |

## Provenance (retrieved 22 Nov 2026)

From SecLists (MIT licence, © Daniel Miessler), `Passwords/` on the `master` branch:

| Source file | SHA-256 | Entries of 12+ characters |
|---|---|---|
| `Common-Credentials/100k-most-used-passwords-NCSC.txt` (UK NCSC list derived from breach data) | `c2e5696882c603b76bb67a47ee970897e5a76fc4c3f5547abe3d0ca340c576e0` | 1,274 |
| `Common-Credentials/xato-net-10-million-passwords-1000000.txt` | `424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51` | 46,296 |
| `Leaked-Databases/rockyou-75.txt` | `d36811f6d5c8dd78c52738efa730689422ac2a9a0ea28255928ae16fbbbcb83d` | 628 |

Built with: concatenate, drop carriage returns, keep lines of 12–128 characters not starting with a space, lower case,
`LC_ALL=C sort -u`. Result: `civora-deny.txt`, SHA-256 `746f387d6d34960eb6f807dc0d84e773548d5b1291d20988232f9e3424e5d622`.

The set is local on purpose: no part of a citizen's password (not even a hash prefix) is sent to an outside service.
It is refreshed with each release; a larger breach corpus can replace it if the Bloom filter memory allows.
