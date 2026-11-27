#!/usr/bin/env python3
"""Test server for check-hsts-preload.py (TEST ONLY): HTTPS and HTTP on local ports, behaviour set by arguments."""
import argparse
import http.server
import ssl
import threading

ap = argparse.ArgumentParser()
ap.add_argument("--domain", required=True)
ap.add_argument("--cert", required=True)
ap.add_argument("--key", required=True)
ap.add_argument("--https-port", type=int, required=True)
ap.add_argument("--http-port", type=int, required=True)
ap.add_argument("--hsts", default="")
ap.add_argument("--https-mode", choices=["page", "redirect-with-hsts", "redirect-without-hsts"], default="page")
ap.add_argument("--http-mode", choices=["redirect-same-host", "redirect-other-host", "plain"], default="redirect-same-host")
a = ap.parse_args()


class Https(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if a.https_mode.startswith("redirect"):
            self.send_response(301)
            self.send_header("Location", f"https://{a.domain}/ar")
            if a.https_mode == "redirect-with-hsts" and a.hsts:
                self.send_header("Strict-Transport-Security", a.hsts)
        else:
            self.send_response(200)
            if a.hsts:
                self.send_header("Strict-Transport-Security", a.hsts)
        self.send_header("Content-Length", "0")
        self.end_headers()


class Http(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if a.http_mode == "plain":
            self.send_response(200)
        else:
            self.send_response(301)
            host = a.domain if a.http_mode == "redirect-same-host" else f"www.{a.domain}"
            self.send_header("Location", f"https://{host}/")
        self.send_header("Content-Length", "0")
        self.end_headers()


tls = http.server.ThreadingHTTPServer(("127.0.0.1", a.https_port), Https)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(a.cert, a.key)
tls.socket = ctx.wrap_socket(tls.socket, server_side=True)
plain = http.server.ThreadingHTTPServer(("127.0.0.1", a.http_port), Http)
threading.Thread(target=plain.serve_forever, daemon=True).start()
print("ready", flush=True)
tls.serve_forever()
