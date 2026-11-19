# Test node for the postgresql_ha role: Ubuntu 24.04 with systemd (test harness only; never deployed).
# Packages are preinstalled so the test runs without network access from the containers.
# Behind a TLS-inspecting proxy: --secret id=proxy_ca,src=<ca.crt> --build-arg HTTPS_PROXY=<url> --network host
FROM geerlingguy/docker-ubuntu2404-ansible@sha256:fa0889a991fe4f9404efc2f53d5960804f4e409e74bff6ad2443992cc57915c4
ARG HTTPS_PROXY=""
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then cp /run/secrets/proxy_ca /usr/local/share/ca-certificates/proxy.crt && update-ca-certificates >/dev/null; fi && \
    sed -i 's#http://#https://#g' /etc/apt/sources.list.d/ubuntu.sources && \
    if [ -n "$HTTPS_PROXY" ]; then printf 'Acquire::https::Proxy "%s";\n' "$HTTPS_PROXY" > /etc/apt/apt.conf.d/99proxy; fi && \
    apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
      postgresql-16 patroni etcd-server etcd-client pgbackrest python3-psycopg2 >/dev/null && \
    rm -f /etc/apt/apt.conf.d/99proxy /usr/local/share/ca-certificates/proxy.crt && update-ca-certificates --fresh >/dev/null && \
    rm -rf /var/lib/apt/lists/*
