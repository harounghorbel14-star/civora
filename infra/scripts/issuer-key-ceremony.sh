#!/usr/bin/env bash
# Issuer key ceremony (Phase 4, P4-SEC3, P4-A5; procedure in docs/phase-4/02-issuer-keys-and-ceremony.md).
# Generates an issuer's ES256 key pair INSIDE a PKCS#11 token, checks that the private key is sensitive and never
# extractable, exports the public key as a JWK with its RFC 7638 thumbprint, proves the key signs, and writes the
# ceremony record. Nothing secret is printed or written: the record holds the public key only.
#
# Dev and test: SoftHSM 2 (ADR-028). Production: the cell's HSM (decision Q4-2 open), same steps, with the witnesses
# named in the record present.
#
# Usage:
#   CIVORA_HSM_PIN=... issuer-key-ceremony.sh --module /usr/lib/softhsm/libsofthsm2.so --token-label civora-issuers \
#     --key-label demo-civil-registry-2026-1 --key-id 01 --kid demo-civil-registry-2026-1 --out DIR \
#     --operator "Name" --witness "Name" [--witness "Name"] [--init-token]   # --init-token: SoftHSM only (needs CIVORA_HSM_SO_PIN)
set -euo pipefail

module="" token="" key_label="" key_id="" kid="" out="" operator="" init=0
witnesses=()
while [ $# -gt 0 ]; do
  case "$1" in
    --module) module=$2; shift 2 ;;
    --token-label) token=$2; shift 2 ;;
    --key-label) key_label=$2; shift 2 ;;
    --key-id) key_id=$2; shift 2 ;;
    --kid) kid=$2; shift 2 ;;
    --out) out=$2; shift 2 ;;
    --operator) operator=$2; shift 2 ;;
    --witness) witnesses+=("$2"); shift 2 ;;
    --init-token) init=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
die() { echo "ceremony refused: $*" >&2; exit 1; }
[ -n "$module" ] && [ -n "$token" ] && [ -n "$key_label" ] && [ -n "$key_id" ] && [ -n "$kid" ] && [ -n "$out" ] || die "missing arguments (see the header)"
[ -n "$operator" ] && [ "${#witnesses[@]}" -ge 1 ] || die "an operator and at least one witness are named"
[[ "$key_id" =~ ^[0-9a-fA-F]{2,64}$ ]] || die "--key-id is hex"
[[ "$kid" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || die "--kid: letters, digits, dot, dash, underscore"
[ -n "${CIVORA_HSM_PIN:-}" ] || die "CIVORA_HSM_PIN is not set"
command -v pkcs11-tool >/dev/null || die "OpenSC's pkcs11-tool is needed"
command -v node >/dev/null || die "node is needed (JWK and thumbprint)"
p11() { pkcs11-tool --module "$module" --token-label "$token" "$@"; }

if [ "$init" = 1 ]; then
  [[ "$(basename "$module")" == libsofthsm2* ]] || die "--init-token is for SoftHSM only; a production token is initialised by the HSM's own procedure"
  [ -n "${CIVORA_HSM_SO_PIN:-}" ] || die "CIVORA_HSM_SO_PIN is not set"
  command -v softhsm2-util >/dev/null || die "softhsm2-util is needed for --init-token"
  softhsm2-util --init-token --free --label "$token" --so-pin "$CIVORA_HSM_SO_PIN" --pin "$CIVORA_HSM_PIN" >/dev/null
fi

# 1. The id must be free: a ceremony never replaces a key.
if p11 --login --pin env:CIVORA_HSM_PIN --list-objects --id "$key_id" 2>/dev/null | grep -q "Object;"; then
  die "an object with id $key_id already exists on token $token"
fi

# 2. Generate the pair on the token.
p11 --login --pin env:CIVORA_HSM_PIN --keypairgen --key-type EC:prime256v1 --label "$key_label" --id "$key_id" --usage-sign >/dev/null 2>&1 \
  || die "key generation failed"

# 3. The private key must be sensitive and never extractable, and able to sign.
attrs=$(p11 --login --pin env:CIVORA_HSM_PIN --list-objects --type privkey --id "$key_id" 2>/dev/null)
grep -q "never extractable" <<<"$attrs" || die "the private key is extractable"
grep -Eq "Access:.*sensitive" <<<"$attrs" || die "the private key is not sensitive"
grep -Eq "Usage:.*sign" <<<"$attrs" || die "the private key cannot sign"

# 4. Public key, JWK, thumbprint; 5. a signature over a fresh challenge, verified with the exported public key.
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
p11 --read-object --type pubkey --id "$key_id" --output-file "$work/pub.der" >/dev/null 2>&1 || die "could not read the public key"
head -c 32 /dev/urandom > "$work/challenge"
openssl dgst -sha256 -binary "$work/challenge" \
  | p11 --login --pin env:CIVORA_HSM_PIN --sign --mechanism ECDSA --id "$key_id" --input-file /dev/stdin --output-file "$work/sig" >/dev/null 2>&1 \
  || die "the token did not sign"
serial=$(pkcs11-tool --module "$module" --list-token-slots 2>/dev/null \
  | awk -v t="$token" '/token label/ { sub(/^[^:]*: */, ""); hit = ($0 == t) } hit && /serial num/ { sub(/^[^:]*: */, ""); print; exit }')
mkdir -p "$out"
record="$out/$kid.ceremony.json"
[ ! -e "$record" ] || die "$record exists"
CER_KID="$kid" CER_LABEL="$key_label" CER_ID="$key_id" CER_TOKEN="$token" CER_SERIAL="${serial:-unknown}" CER_MODULE="$(basename "$module")" \
CER_OPERATOR="$operator" CER_ATTRS="$(grep -E 'Access:|Usage:' <<<"$attrs" | tr -s ' ' | tr '\n' ';')" \
node - "$work" "$record" "${witnesses[@]}" <<'EOF'
const crypto = require('node:crypto'), fs = require('node:fs');
const [work, record, ...witnesses] = process.argv.slice(2);
const pub = crypto.createPublicKey({ key: fs.readFileSync(`${work}/pub.der`), format: 'der', type: 'spki' });
const j = pub.export({ format: 'jwk' });
if (j.kty !== 'EC' || j.crv !== 'P-256') { console.error('ceremony refused: not a P-256 key'); process.exit(1); }
const ok = crypto.verify('sha256', fs.readFileSync(`${work}/challenge`), { key: pub, dsaEncoding: 'ieee-p1363' }, fs.readFileSync(`${work}/sig`));
if (!ok) { console.error('ceremony refused: the test signature does not verify'); process.exit(1); }
const e = process.env;
const publicJwk = { kty: 'EC', crv: 'P-256', x: j.x, y: j.y, kid: e.CER_KID, alg: 'ES256', use: 'sig' };
const thumbprint = crypto.createHash('sha256').update(JSON.stringify({ crv: j.crv, kty: j.kty, x: j.x, y: j.y })).digest('base64url');
fs.writeFileSync(record, JSON.stringify({
  ceremony: 'issuer-key-generation', at: new Date().toISOString(),
  token: { label: e.CER_TOKEN, serial: e.CER_SERIAL, module: e.CER_MODULE },
  key: { label: e.CER_LABEL, id: e.CER_ID, kid: e.CER_KID, alg: 'ES256', private_key_attributes: e.CER_ATTRS },
  public_jwk: publicJwk, jwk_thumbprint_sha256: thumbprint,
  test_signature: 'verified with the exported public key',
  operator: e.CER_OPERATOR, witnesses,
}, null, 2) + '\n', { mode: 0o644 });
console.log(`key ${e.CER_KID} generated on token ${e.CER_TOKEN}; thumbprint ${thumbprint}; record ${record}`);
EOF
