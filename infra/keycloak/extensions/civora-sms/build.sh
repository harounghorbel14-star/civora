#!/usr/bin/env bash
# Builds the CIVORA Keycloak extension (unit tests, then target/civora-keycloak-sms-0.1.0.jar). Used by CI, the
# nightly, dev-cell-up.sh and the realms test, so they all build it the same way.
#
# Maven Central answers 429 (Too Many Requests) to busy shared runners. Maven's resolver retries a 429 or 503 by
# itself (here 5 times, at least 10 s apart); the whole build is then tried up to 4 times, 30, 60 and 90 s apart.
# Every plugin version is pinned in pom.xml, so a retry resolves exactly what the first attempt would have.
# Java 21 is required: GitHub's runners expose it as JAVA_HOME_21_X64 (their default Java is older).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mvn="${MVN:-mvn}"   # MVN=/path/to/mvn when Maven is not on the PATH
if [ -n "${JAVA_HOME_21_X64:-}" ]; then export JAVA_HOME="$JAVA_HOME_21_X64"; fi
command -v "$mvn" >/dev/null || { echo "Maven 3.9 and Java 21 are needed to build $here" >&2; exit 1; }
for attempt in 1 2 3 4; do
  if "$mvn" -B -q -f "$here/pom.xml" \
      -Daether.connector.http.retryHandler.count=5 -Daether.connector.http.retryHandler.interval=10000 \
      package "$@"; then
    exit 0
  fi
  [ "$attempt" -lt 4 ] || break
  echo "Keycloak extension build: attempt $attempt failed; trying again in $((attempt * 30)) s" >&2
  sleep $((attempt * 30))
done
echo "Keycloak extension build failed 4 times" >&2
exit 1
