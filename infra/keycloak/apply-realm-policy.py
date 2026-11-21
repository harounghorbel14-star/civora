#!/usr/bin/env python3
"""Applies the parts of the CIVORA realm policy that a realm import cannot express, then exports the live realm.

A Keycloak realm import adds to the built-in defaults; it cannot remove them. The default role of every new realm
grants offline_access (long-lived offline tokens), uma_authorization and the account console roles. This script
removes what the profile does not allow, requires PKCE on Keycloak's built-in public clients and has Keycloak
generate the pairwise-subject salts, then writes the live realm (partial export: realm, flows, clients, roles,
user profile; no users, secrets masked) so that check-realm-security.py checks what Keycloak actually runs,
not only the file.

Usage: apply-realm-policy.py --server URL --realm NAME --profile citizens|staff|dev --export OUT.json
The admin access token is read from the KC_ADMIN_TOKEN environment variable (never from the command line).
Standard library only. Idempotent.
"""
import argparse
import json
import os
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
    export = call(a.server, token, "POST", f"/admin/realms/{realm}/partial-export?exportClients=true&exportGroupsAndRoles=true")
    with open(a.export, "w") as f:
        json.dump(export, f, indent=2)
    print(f"  policy: {a.realm} exported to {a.export}")


if __name__ == "__main__":
    main()
