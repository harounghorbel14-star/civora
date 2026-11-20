#!/usr/bin/env python3
"""Identity realm conformance (doc 06; Phase 0 §10.3): checks a Keycloak realm export against the documented rules.

Usage: check-realm-security.py REALM.json [--self-test]
--self-test also feeds weakened copies of the realm and requires each to be rejected (negative controls).
Exit 1 on any violation.
"""
import copy
import json
import re
import sys


def violations(r):
    v = []
    if r.get("sslRequired") not in ("external", "all"):
        v.append("sslRequired must be 'external' or 'all'")
    if not r.get("bruteForceProtected"):
        v.append("brute-force protection must be on")
    if int(r.get("failureFactor", 30)) > 5:
        v.append("lockout after at most 5 failures")
    pol = r.get("passwordPolicy", "")
    m = re.search(r"length\((\d+)\)", pol)
    if not m or int(m.group(1)) < 12:
        v.append("password policy: length >= 12")
    for rule in ("notUsername", "passwordHistory"):
        if rule not in pol:
            v.append(f"password policy: {rule}")
    if int(r.get("accessTokenLifespan", 300)) > 300:
        v.append("access tokens live at most 5 min")
    if not r.get("revokeRefreshToken") or int(r.get("refreshTokenMaxReuse", 0)) != 0:
        v.append("refresh tokens must be rotated (revokeRefreshToken=true, refreshTokenMaxReuse=0)")
    if r.get("registrationAllowed"):
        v.append("self-registration must be off")
    for c in r.get("clients", []):
        cid = c.get("clientId")
        if c.get("implicitFlowEnabled"):
            v.append(f"{cid}: implicit flow forbidden")
        if c.get("directAccessGrantsEnabled", True) and not c.get("bearerOnly"):
            v.append(f"{cid}: password grant (direct access) forbidden")
        if c.get("publicClient"):
            if c.get("attributes", {}).get("pkce.code.challenge.method") != "S256":
                v.append(f"{cid}: public client needs PKCE S256")
            for u in c.get("redirectUris", []):
                if u.strip() in ("*", "/*") or re.match(r"^https?://\*", u):
                    v.append(f"{cid}: wildcard redirect URI {u}")
    for u in r.get("users", []):
        for cred in u.get("credentials", []):
            if cred.get("type") == "password" and ("value" in cred or "secretData" in cred):
                v.append(f"user {u.get('username')}: password stored in the realm file")
    return v


def main():
    realm = json.load(open(sys.argv[1]))
    found = violations(realm)
    for x in found:
        print(f"  FAIL {x}")
    if not found:
        print(f"  ok   realm {realm.get('realm')}: {len(realm.get('clients', []))} clients conform to doc 06")
    if "--self-test" in sys.argv:
        mutations = {
            "refresh tokens not rotated": lambda r: r.update(revokeRefreshToken=False),
            "token lifetime 1 h": lambda r: r.update(accessTokenLifespan=3600),
            "weak password length": lambda r: r.update(passwordPolicy="length(8)"),
            "public client without PKCE": lambda r: next(c for c in r["clients"] if c.get("publicClient"))["attributes"].pop("pkce.code.challenge.method"),
            "password grant enabled": lambda r: next(c for c in r["clients"] if c.get("publicClient")).update(directAccessGrantsEnabled=True),
            "wildcard redirect": lambda r: next(c for c in r["clients"] if c.get("publicClient")).update(redirectUris=["*"]),
            "password in file": lambda r: r.setdefault("users", [{}])[0].setdefault("credentials", []).append({"type": "password", "value": "x"}),
        }
        for name, mutate in mutations.items():
            weak = copy.deepcopy(realm)
            mutate(weak)
            if violations(weak):
                print(f"  ok   negative control rejected: {name}")
            else:
                print(f"  FAIL negative control NOT rejected: {name}")
                found.append(name)
    sys.exit(1 if found else 0)


if __name__ == "__main__":
    main()
