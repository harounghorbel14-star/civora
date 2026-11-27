#!/usr/bin/env python3
"""Checks a domain against the HSTS preload list's submission requirements (ASVS 5.0 V3.7.4; Phase 3 gap G5, doc 18).

The requirements of hstspreload.org (the form Chromium, Firefox, Safari and Edge build their lists from):
  1. a valid certificate;
  2. if port 80 answers: a redirect from HTTP to HTTPS on the SAME host first;
  3. every subdomain over HTTPS, in particular www when it has a DNS record;
  4. on the base domain over HTTPS, the header Strict-Transport-Security with max-age >= 31536000 (one year),
     includeSubDomains and preload; a redirect served over HTTPS carries the header itself.
CIVORA sends max-age=63072000 (two years), the value the list recommends.

Usage: check-hsts-preload.py --domain DOMAIN [--subdomain NAME ...] [--ca-file PEM]
                             [--connect HOST=IP] [--https-port N] [--http-port N] [--no-http]
--connect, --https-port and --http-port point the checks at a test server (the TLS name and Host stay the domain's).
The domain is a deployment setting: until the founder chooses it (G5), the repository uses the placeholder
civora-cell.invalid, which can never be submitted. Standard library only.
"""
import argparse
import re
import socket
import ssl
import sys

MIN_MAX_AGE = 31536000
PLACEHOLDER = "civora-cell.invalid"


def fetch(host, address, port, tls, ca_file, timeout=10):
    """One GET / to host at address:port; returns (status, headers dict lower-cased) or raises."""
    raw = socket.create_connection((address, port), timeout=timeout)
    if tls:
        ctx = ssl.create_default_context(cafile=ca_file) if ca_file else ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        sock = ctx.wrap_socket(raw, server_hostname=host)  # verifies the chain and the name
    else:
        sock = raw
    try:
        sock.sendall(f"GET / HTTP/1.1\r\nHost: {host}\r\nUser-Agent: civora-hsts-check\r\nConnection: close\r\n\r\n".encode())
        data = b""
        while b"\r\n\r\n" not in data and len(data) < 65536:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
    finally:
        sock.close()
    head = data.split(b"\r\n\r\n", 1)[0].decode("iso-8859-1").split("\r\n")
    m = re.match(r"HTTP/1\.[01] (\d{3})", head[0] if head else "")
    if not m:
        raise ValueError("not an HTTP response")
    headers = {}
    for line in head[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return int(m.group(1)), headers


def hsts_problems(value):
    """What the header lacks for the preload list ([] when it qualifies)."""
    if not value:
        return ["no Strict-Transport-Security header"]
    directives = [d.strip() for d in value.split(";") if d.strip()]
    names = [d.split("=", 1)[0].strip().lower() for d in directives]
    out = []
    age = next((d.split("=", 1)[1].strip().strip('"') for d in directives if d.lower().startswith("max-age=")), None)
    if age is None or not age.isdigit():
        out.append("max-age missing")
    elif int(age) < MIN_MAX_AGE:
        out.append(f"max-age {age} is below one year ({MIN_MAX_AGE})")
    if "includesubdomains" not in names:
        out.append("includeSubDomains missing")
    if "preload" not in names:
        out.append("preload missing")
    if len(set(names)) != len(names):
        out.append("a directive appears twice")
    return out


def check(domain, subdomains, ca_file, connect, https_port, http_port, no_http):
    results = []

    def ok(name, cond, detail=""):
        results.append((bool(cond), name, detail))

    addr = lambda h: connect.get(h, h)
    if domain == PLACEHOLDER or domain.endswith(".invalid") or domain.endswith(".example"):
        results.append((None, f"{domain} is a placeholder: it can be checked against a test server, never submitted", ""))
    try:
        status, headers = fetch(domain, addr(domain), https_port, True, ca_file)
        ok(f"https://{domain}/ has a valid certificate", True)
        problems = hsts_problems(headers.get("strict-transport-security"))
        kind = "redirect" if 300 <= status < 400 else "response"
        ok(f"https://{domain}/ ({kind} {status}) sends HSTS fit for the preload list (max-age >= 1 year, includeSubDomains, preload)",
           not problems, "; ".join(problems))
    except (OSError, ssl.SSLError, ValueError) as e:
        ok(f"https://{domain}/ has a valid certificate", False, str(e)[:200])
    if not no_http:
        try:
            status, headers = fetch(domain, addr(domain), http_port, False, None)
            loc = headers.get("location", "")
            same_host = re.match(rf"https://{re.escape(domain)}(:\d+)?(/|$)", loc, re.I) is not None
            ok(f"http://{domain}/ redirects to HTTPS on the same host first", 300 <= status < 400 and same_host, f"{status} {loc}")
        except OSError as e:
            results.append((None, f"http://{domain}/ does not answer (port {http_port}): nothing to redirect", str(e)[:120]))
    for sub in subdomains:
        host = f"{sub}.{domain}"
        try:
            fetch(host, addr(host), https_port, True, ca_file)
            ok(f"https://{host}/ is served over HTTPS with a valid certificate (includeSubDomains covers it)", True)
        except socket.gaierror:
            results.append((None, f"{host} has no DNS record", ""))
        except (OSError, ssl.SSLError, ValueError) as e:
            ok(f"https://{host}/ is served over HTTPS with a valid certificate (includeSubDomains covers it)", False, str(e)[:200])
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True)
    ap.add_argument("--subdomain", action="append", default=[], help="a subdomain that exists (www, app, auth, api...)")
    ap.add_argument("--ca-file")
    ap.add_argument("--connect", action="append", default=[], help="HOST=IP: connect there instead of resolving HOST")
    ap.add_argument("--https-port", type=int, default=443)
    ap.add_argument("--http-port", type=int, default=80)
    ap.add_argument("--no-http", action="store_true", help="port 80 is not served at all")
    a = ap.parse_args()
    connect = dict(c.split("=", 1) for c in a.connect)
    failed = 0
    for passed, name, detail in check(a.domain.lower().rstrip("."), a.subdomain, a.ca_file, connect, a.https_port, a.http_port, a.no_http):
        tag = "info" if passed is None else ("ok  " if passed else "FAIL")
        failed += passed is False
        print(f"  {tag} {name}" + (f" — {detail}" if detail and passed is not True else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
