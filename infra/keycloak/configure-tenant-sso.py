#!/usr/bin/env python3
"""Connects one institution's (tenant's) own identity provider to the staff realm (Phase 3 P3-R1, doc 07).

Platform-operator action, run per tenant. Creates or updates, idempotently:
  - the identity provider (OIDC or SAML): hidden on the shared login page (the app sends kc_idp_hint), signatures
    validated (OIDC: PKCE S256 too), the institution's tokens not stored;
  - first sign-in through it: flow staff-first-broker-login, which creates the account only if no account has that
    username or e-mail and NEVER links to an existing one (no takeover of a local or another tenant's account);
  - every sign-in through it: flow staff-post-broker-key, the CIVORA security key (P3-SEC5), enrolled at the first SSO
    sign-in (approved models only);
  - mappers: tenant_id HARDCODED to this tenant (sync FORCE; the institution can never assert a tenant), username
    "<alias>.<subject at the institution>" (unique per provider), e-mail and names;
  - a Keycloak organisation for the tenant (attribute tenant_id, the institution's e-mail domain) with the provider
    linked to it (Phase 2 doc 06 §6.2: tenants as organisations).
check-realm-security.py --profile staff verifies the result on the live realm.

Usage:
  configure-tenant-sso.py --server URL --tenant-id UUID --alias ALIAS --name NAME --domain DOMAIN --protocol oidc
      --issuer URL [--internal-url URL] --client-id ID --client-secret-file FILE
  configure-tenant-sso.py ... --protocol saml --sso-url URL --idp-entity-id ID --signing-cert-file PEM [--sp-entity-id ID]
--issuer and --sso-url are the addresses the browser uses; --internal-url is where Keycloak reaches the provider's
token and key endpoints when that differs (e.g. inside the cell). The admin token is read from KC_ADMIN_TOKEN.
Standard library only.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
REALM = "civora-staff"


def call(server, token, method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(server.rstrip("/") + path, method=method, data=data,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            out = resp.read()
            loc = resp.headers.get("Location")
            return (json.loads(out) if out else None), loc
    except urllib.error.HTTPError as e:
        if e.code == 404 and method == "GET":
            return None, None
        raise SystemExit(f"{method} {path}: HTTP {e.code} {e.read().decode()[:300]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True)
    ap.add_argument("--tenant-id", required=True)
    ap.add_argument("--alias", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--domain", required=True)
    ap.add_argument("--protocol", required=True, choices=["oidc", "saml"])
    ap.add_argument("--issuer")
    ap.add_argument("--internal-url")
    ap.add_argument("--client-id")
    ap.add_argument("--client-secret-file")
    ap.add_argument("--sso-url")
    ap.add_argument("--idp-entity-id")
    ap.add_argument("--signing-cert-file")
    ap.add_argument("--sp-entity-id", default="civora-staff-sp")
    a = ap.parse_args()
    token = os.environ.get("KC_ADMIN_TOKEN")
    if not token:
        sys.exit("KC_ADMIN_TOKEN is not set")
    if not UUID.match(a.tenant_id):
        sys.exit("--tenant-id must be a UUID")
    if not re.match(r"^[a-z0-9][a-z0-9-]{1,62}$", a.alias):
        sys.exit("--alias: lower-case letters, digits and dashes")
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", a.domain):
        sys.exit("--domain: the institution's e-mail domain")

    common = {
        "alias": a.alias, "displayName": a.name, "enabled": True, "hideOnLogin": True, "trustEmail": True, "storeToken": False,
        "linkOnly": False, "addReadTokenRoleOnCreate": False, "authenticateByDefault": False,
        "firstBrokerLoginFlowAlias": "staff-first-broker-login", "postBrokerLoginFlowAlias": "staff-post-broker-key",
    }
    if a.protocol == "oidc":
        if not (a.issuer and a.client_id and a.client_secret_file):
            sys.exit("OIDC needs --issuer, --client-id and --client-secret-file")
        back = (a.internal_url.rstrip("/") + urllib.parse.urlparse(a.issuer).path) if a.internal_url else a.issuer
        idp = {**common, "providerId": "oidc", "config": {
            "issuer": a.issuer, "authorizationUrl": f"{a.issuer}/protocol/openid-connect/auth",
            "tokenUrl": f"{back}/protocol/openid-connect/token", "jwksUrl": f"{back}/protocol/openid-connect/certs",
            "useJwksUrl": "true", "validateSignature": "true", "clientId": a.client_id,
            "clientSecret": open(a.client_secret_file).read().strip(), "clientAuthMethod": "client_secret_post",
            "pkceEnabled": "true", "pkceMethod": "S256", "defaultScope": "openid email profile", "syncMode": "IMPORT",
            "backchannelSupported": "false", "loginHint": "false", "isAccessTokenJWT": "false"}}
        username_mapper = {"identityProviderMapper": "oidc-username-idp-mapper", "config": {"template": "${ALIAS}.${CLAIM.sub}", "syncMode": "IMPORT"}}
        extra = []
    else:
        if not (a.sso_url and a.idp_entity_id and a.signing_cert_file):
            sys.exit("SAML needs --sso-url, --idp-entity-id and --signing-cert-file")
        cert = "".join(l.strip() for l in open(a.signing_cert_file) if "CERTIFICATE" not in l)
        idp = {**common, "providerId": "saml", "config": {
            "singleSignOnServiceUrl": a.sso_url, "idpEntityId": a.idp_entity_id, "entityId": a.sp_entity_id,
            "nameIDPolicyFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent", "principalType": "SUBJECT",
            "postBindingResponse": "true", "postBindingAuthnRequest": "true", "postBindingLogout": "true",
            "validateSignature": "true", "wantAssertionsSigned": "true", "wantAuthnRequestsSigned": "false",
            "signingCertificate": cert, "signatureAlgorithm": "RSA_SHA256", "syncMode": "IMPORT", "allowCreate": "true"}}
        username_mapper = {"identityProviderMapper": "saml-username-idp-mapper", "config": {"template": "${ALIAS}.${NAMEID}", "syncMode": "IMPORT"}}
        extra = [{"name": f"{n}", "identityProviderMapper": "saml-user-attribute-idp-mapper",
                  "config": {"attribute.name": n, "user.attribute": n, "syncMode": "FORCE"}} for n in ("email", "firstName", "lastName")]

    s, t = a.server, token
    base = f"/admin/realms/{REALM}/identity-provider/instances"
    existing, _ = call(s, t, "GET", f"{base}/{a.alias}")
    if existing:
        call(s, t, "PUT", f"{base}/{a.alias}", {**existing, **idp, "config": {**existing.get("config", {}), **idp["config"]}})
    else:
        call(s, t, "POST", base, idp)
    # Mappers: replace ours by name.
    current, _ = call(s, t, "GET", f"{base}/{a.alias}/mappers")
    mappers = [{"name": "tenant", "identityProviderMapper": "hardcoded-attribute-idp-mapper",
                "config": {"attribute": "tenant_id", "attribute.value": a.tenant_id, "syncMode": "FORCE"}},
               {"name": "username", **username_mapper}, *extra]
    for m in mappers:
        for old in [x for x in (current or []) if x.get("name") == m["name"]]:
            call(s, t, "DELETE", f"{base}/{a.alias}/mappers/{old['id']}")
        call(s, t, "POST", f"{base}/{a.alias}/mappers", {**m, "identityProviderAlias": a.alias})

    # The tenant's organisation, with the provider linked to it.
    orgs, _ = call(s, t, "GET", f"/admin/realms/{REALM}/organizations?q=tenant_id:{a.tenant_id}&exact=true&briefRepresentation=false")
    org = next((o for o in orgs or [] if (o.get("attributes") or {}).get("tenant_id") == [a.tenant_id]), None)
    body = {"name": a.name, "alias": a.alias, "enabled": True, "domains": [{"name": a.domain}], "attributes": {"tenant_id": [a.tenant_id]}}
    if org:
        call(s, t, "PUT", f"/admin/realms/{REALM}/organizations/{org['id']}", {**org, **body, "id": org["id"]})
        org_id = org["id"]
    else:
        _, loc = call(s, t, "POST", f"/admin/realms/{REALM}/organizations", body)
        org_id = loc.rstrip("/").split("/")[-1]
    linked, _ = call(s, t, "GET", f"/admin/realms/{REALM}/organizations/{org_id}/identity-providers")
    if not any(x.get("alias") == a.alias for x in linked or []):
        call(s, t, "POST", f"/admin/realms/{REALM}/organizations/{org_id}/identity-providers", a.alias)  # body: the alias, as a JSON string
    print(f"tenant {a.tenant_id}: identity provider {a.alias} ({a.protocol}) configured, organisation {org_id}")


if __name__ == "__main__":
    main()
