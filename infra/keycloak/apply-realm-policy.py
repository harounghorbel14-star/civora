#!/usr/bin/env python3
"""Applies the parts of the CIVORA realm policy that a realm import cannot express, then exports the live realm.

A Keycloak realm import adds to the built-in defaults; it cannot remove them. The default role of every new realm
grants offline_access (long-lived offline tokens), uma_authorization and the account console roles. This script
removes what the profile does not allow, requires PKCE on Keycloak's built-in public clients and has Keycloak
generate the pairwise-subject salts, then writes the live realm (partial export: realm, flows, clients, roles,
user profile; no users, secrets masked) so that check-realm-security.py checks what Keycloak actually runs,
not only the file.

Usage: apply-realm-policy.py --server URL --realm NAME --profile citizens|staff|dev --export OUT.json
                             [--smtp-host HOST [--smtp-port N] [--smtp-from ADDR]] [--approved-keys FILE]
                             [--provisioner-secret-out FILE]
The admin access token is read from the KC_ADMIN_TOKEN environment variable (never from the command line).
Standard library only. Idempotent.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BUILT_IN_CLIENTS = {"account", "account-console", "admin-cli", "broker", "realm-management", "security-admin-console"}
# Default-role grants allowed per profile; anything else in the default role is removed.
ALLOWED_DEFAULTS = {
    "citizens": {"realm": {"citizen"}, "account": {"view-profile", "manage-account"}},
    # Staff do not manage their own authenticators in the account console: a staff member who removed their
    # security key there would let the next password-only login enrol a new one (see doc phase-3/03).
    "staff": {"realm": set(), "account": {"view-profile"}},
    "dev": {"realm": set(), "account": {"view-profile", "manage-account"}},
}


def call(server, token, method, path, body=None):
    req = urllib.request.Request(server.rstrip("/") + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True)
    ap.add_argument("--realm", required=True)
    ap.add_argument("--profile", required=True, choices=sorted(ALLOWED_DEFAULTS))
    ap.add_argument("--export", required=True)
    ap.add_argument("--smtp-host", help="mail relay for activation and invitation e-mails (deployment setting, not in Git)")
    ap.add_argument("--smtp-port", default="25")
    ap.add_argument("--smtp-from", default="no-reply@civora-cell.invalid")
    ap.add_argument("--approved-keys", help="JSON file listing the approved security-key models ([{\"aaguid\": ..., \"model\": ...}]); "
                    "their vendor attestation roots must be in Keycloak's truststore (conf/truststores)")
    ap.add_argument("--web-client-jwks", help="JSON key set with the web app's public key(s) for its client assertions "
                    "(private_key_jwt); set on the civora-web client (deployment setting, not in Git)")
    ap.add_argument("--pairwise-out", help="write the relying parties' pairwise sectors and salts (JSON, mode 0600) for the core's "
                    "mirror of pairwise ids (P3-DB6); a deployment secret, never in Git")
    ap.add_argument("--provisioner-secret-out", help="regenerate the civora-core-provisioner secret and write it to this file "
                    "(mode 0600) for the core's secret store; the secret never goes to Git")
    a = ap.parse_args()
    token = os.environ.get("KC_ADMIN_TOKEN")
    if not token:
        sys.exit("KC_ADMIN_TOKEN is not set")
    realm = urllib.parse.quote(a.realm)
    allowed = ALLOWED_DEFAULTS[a.profile]
    default_role = call(a.server, token, "GET", f"/admin/realms/{realm}")["defaultRole"]
    base = f"/admin/realms/{realm}/roles-by-id/{default_role['id']}/composites"
    composites = call(a.server, token, "GET", base)
    clients = {c["id"]: c["clientId"] for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?max=1000")}
    remove = []
    for role in composites:
        if role.get("clientRole"):
            owner = clients.get(role["containerId"], "?")
            if role["name"] not in allowed.get(owner, set()):
                remove.append(role)
        elif role["name"] not in allowed["realm"]:
            remove.append(role)
    if remove:
        call(a.server, token, "DELETE", base, remove)
    for role in remove:
        print(f"  policy: removed {role['name']} from {default_role['name']}")
    # Built-in public clients (the legacy "account" client has the code flow on without PKCE): require PKCE S256.
    # Our own clients are not changed here: the file check requires them to be correct in Git.
    for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?max=1000"):
        if c["clientId"] in BUILT_IN_CLIENTS and c.get("publicClient") and c.get("standardFlowEnabled") \
                and (c.get("attributes") or {}).get("pkce.code.challenge.method") != "S256":
            c.setdefault("attributes", {})["pkce.code.challenge.method"] = "S256"
            call(a.server, token, "PUT", f"/admin/realms/{realm}/clients/{c['id']}", c)
            print(f"  policy: built-in client {c['clientId']} now requires PKCE S256")
    # Pairwise subjects (P3-A3): an imported mapper has no salt, and an unsalted pairwise id can be computed by anyone
    # who knows a user's internal id and the relying party's host. Saving the mapper through the admin API makes
    # Keycloak generate a random salt, kept in its database (never in Git). Because the salt lives there, a cell is
    # rebuilt by restoring the Keycloak database, not by re-importing the realm: a new salt changes every pairwise id.
    for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?max=1000"):
        for m in c.get("protocolMappers") or []:
            if m.get("protocolMapper") == "oidc-sha256-pairwise-sub-mapper" and not (m.get("config") or {}).get("pairwiseSubAlgorithmSalt"):
                call(a.server, token, "PUT", f"/admin/realms/{realm}/clients/{c['id']}/protocol-mappers/models/{m['id']}", m)
                print(f"  policy: client {c['clientId']}: pairwise salt generated")
    if a.web_client_jwks:
        keys = json.load(open(a.web_client_jwks))
        if not isinstance(keys, dict) or not keys.get("keys") or any("d" in k or k.get("kty") not in ("EC", "OKP", "RSA") for k in keys["keys"]):
            sys.exit("--web-client-jwks: a JSON key set of public keys")
        for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?clientId=civora-web"):
            c.setdefault("attributes", {}).update({"use.jwks.url": "false", "use.jwks.string": "true", "jwks.string": json.dumps(keys)})
            call(a.server, token, "PUT", f"/admin/realms/{realm}/clients/{c['id']}", c)
            print(f"  policy: civora-web: {len(keys['keys'])} public key(s) for its client assertions")
    if a.pairwise_out:
        from urllib.parse import urlparse
        sectors = []
        for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?max=1000"):
            for m in c.get("protocolMappers") or []:
                cfg = m.get("config") or {}
                if m.get("protocolMapper") != "oidc-sha256-pairwise-sub-mapper" or not cfg.get("pairwiseSubAlgorithmSalt"):
                    continue
                hosts = {urlparse(u).netloc for u in ([cfg["sectorIdentifierUri"]] if cfg.get("sectorIdentifierUri") else c.get("redirectUris") or []) if urlparse(u).netloc}
                if len(hosts) == 1:
                    sectors.append({"clientId": c["clientId"], "sector": hosts.pop(), "salt": cfg["pairwiseSubAlgorithmSalt"]})
        fd = os.open(a.pairwise_out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(sectors, f)
        print(f"  policy: {len(sectors)} pairwise sector(s) written to {a.pairwise_out} (0600)")
    if a.smtp_host:
        rep = call(a.server, token, "GET", f"/admin/realms/{realm}")
        # Authentication to the relay, when it needs one, comes from Keycloak's vault (${vault.smtp-password}), never from here.
        rep["smtpServer"] = {**(rep.get("smtpServer") or {}), "host": a.smtp_host, "port": str(a.smtp_port), "from": a.smtp_from,
                             "fromDisplayName": "CIVORA"}
        call(a.server, token, "PUT", f"/admin/realms/{realm}", rep)
        print(f"  policy: e-mail relay set ({a.smtp_host}:{a.smtp_port})")
    if a.approved_keys:
        keys = json.load(open(a.approved_keys))
        aaguids = sorted({k["aaguid"].lower() for k in keys})
        if not aaguids or any(not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", g) for g in aaguids):
            sys.exit("approved keys: at least one valid AAGUID is required")
        rep = call(a.server, token, "GET", f"/admin/realms/{realm}")
        rep["webAuthnPolicyAttestationConveyancePreference"] = "direct"
        rep["webAuthnPolicyAcceptableAaguids"] = aaguids
        call(a.server, token, "PUT", f"/admin/realms/{realm}", rep)
        print(f"  policy: {len(aaguids)} approved security-key model(s): " + ", ".join(k.get("model", k["aaguid"]) for k in keys))
    if a.provisioner_secret_out:
        prov = [c for c in call(a.server, token, "GET", f"/admin/realms/{realm}/clients?clientId=civora-core-provisioner")]
        if not prov:
            sys.exit("client civora-core-provisioner not found")
        secret = call(a.server, token, "POST", f"/admin/realms/{realm}/clients/{prov[0]['id']}/client-secret")["value"]
        fd = os.open(a.provisioner_secret_out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(secret)
        print(f"  policy: provisioner secret regenerated, written to {a.provisioner_secret_out} (0600)")
    export = call(a.server, token, "POST", f"/admin/realms/{realm}/partial-export?exportClients=true&exportGroupsAndRoles=true")
    with open(a.export, "w") as f:
        json.dump(export, f, indent=2)
    print(f"  policy: {a.realm} exported to {a.export}")


if __name__ == "__main__":
    main()
