# Runbook — PostgreSQL high availability, backup and restore

| | |
|---|---|
| Applies to | Database nodes built by `infra/ansible/roles/postgresql_ha` (Patroni + etcd + pgBackRest), and `infra/helm/pg-router` |
| Status | **Draft, Phase 2.** Every command below was run against the role on systemd containers by `infra/ansible/tests/postgresql-ha/run.sh` or `sync-safety-experiment.sh` (19 Nov 2026). No real server exists yet: the hosting provider is not selected (Phase 1 evidence E-07) |
| Decisions it depends on | ADR-003 (PostgreSQL + Patroni) and ADR-029 (backup) — both **Proposed, awaiting founder approval** (P2-D1), including the choice of 2 or 3 database servers per site |
| Data | Synthetic only until pilot. Never copy production data to a test or drill environment |

Contents:

1. Where things are
2. Health check
3. Planned switchover (maintenance)
4. Leader lost and no synchronous standby: the manual decision (2-server sites)
5. A standby that does not rejoin
6. Backups
7. Restore drills (monthly)
8. Keys and secrets
9. What the application sees during a failover
10. Evidence to keep

## 1. Where things are

| Item | Location |
|---|---|
| Patroni configuration | `/etc/patroni/config.yml` (cluster name `civora-<cell id>`) |
| Patroni REST API | `https://<node>:8008` (TLS; certificate checked against the cell CA; write operations need the API user) |
| `patronictl` | `patronictl -c /etc/patroni/config.yml <command>` on any database node, as root |
| PostgreSQL data | `/var/lib/postgresql/16/patroni` (data checksums on) |
| TLS material | `/etc/civora/tls/{ca.crt,node.crt,node.key}` |
| etcd | `/etc/default/etcd`; members: an odd number of nodes (2 database servers + backup node, or 3 database servers) |
| pgBackRest | `/etc/pgbackrest.conf`; repository on the backup node `/var/lib/pgbackrest`; stanza `civora` |
| Backup timers (backup node) | `pgbackrest-backup-full.timer` (Sunday 01:00), `pgbackrest-backup-diff.timer` (Monday–Saturday 01:00) |
| Restore drill | `/usr/local/sbin/civora-restore-drill` on the backup node |
| Application entry point | Service `pg-router` (HAProxy): port 5432 for clients, `:8404/healthz` for probes (ready only while a primary is known) |
| Accounts | Per database: an owner (migrations only) and an application account (`NOSUPERUSER NOBYPASSRLS`, connect and temporary only) |

## 2. Health check

```sh
# Cluster view (works even if one member is frozen: it reads the shared state)
curl -s --cacert /etc/civora/tls/ca.crt https://<node>:8008/cluster | python3 -m json.tool
patronictl -c /etc/patroni/config.yml list
# Backups
sudo -u pgbackrest pgbackrest --stanza=civora info
sudo -u pgbackrest pgbackrest --stanza=civora check      # forces a WAL switch and waits for it in the archive
```

Healthy means:

- exactly one `leader`;
- one `sync_standby` in state `streaming`;
- every other member `replica`/`streaming`;
- `pgbackrest info` status `ok` with a full backup in the last 7 days.

## 3. Planned switchover (maintenance)

Use before patching or rebooting the leader.

```sh
patronictl -c /etc/patroni/config.yml switchover civora-<cell> --leader <current leader> --candidate <sync standby> --force
```

- Choose the **synchronous standby** as candidate: it holds every acknowledged transaction.
- Check with §2 that the old leader is back as `streaming`.
- Stopping Patroni on the leader (`systemctl stop patroni`) also hands over leadership; the test measured 2 s.
- Clients through `pg-router` see their sessions to the old leader cut and reconnect to the new one (§9).

## 4. Leader lost and no synchronous standby: the manual decision (2-server sites)

**When it happens.** Only with 2 database servers, and only if the leader fails while the other server is *not* the designated synchronous standby. The window is short, for example while the standby is restarting or catching up.

**What Patroni does.** It refuses to promote. Writes stop; reads on the standby continue. This is the safe default: promoting would discard transactions the old leader acknowledged but never sent.

- Measured: no promotion for 120 s (finding R2-10).
- With 3 database servers this situation needs two faults at once. With one standby down, the other is designated and failover stays automatic (tested).

**Decision.** Who decides: the on-call engineer together with the tenant's agreed contact. Keep the written decision with the incident record.

| Option | Consequence |
|---|---|
| Wait for the old leader to come back (preferred if it is expected within the RTO) | No data loss. Downtime until it returns |
| Promote the standby now | Service resumes in seconds. **Transactions acknowledged by the old leader during the window are lost**. Record the time window so the tenant can re-enter or reconcile them |

**To promote the standby** (leader still down):

```sh
patronictl -c /etc/patroni/config.yml edit-config --force -s synchronous_mode=false
# Patroni promotes the standby on its next cycle; confirm with §2.
```

Then:

1. When the old server returns, Patroni rewinds it (`pg_rewind`) and it rejoins as a replica. Check with §2.
2. Turn synchronous mode back on:

   ```sh
   patronictl -c /etc/patroni/config.yml edit-config --force -s synchronous_mode=true
   ```

3. Confirm a `sync_standby` is designated again.

Measured by `sync-safety-experiment.sh` with `MANUAL_RECOVERY=1`: see the timeline in [17 §17.2.1](../17-technical-validation-strategy.md).

## 5. A standby that does not rejoin

Patroni repairs a former leader with `pg_rewind` automatically (tested after a crash). If a member stays `stopped` or `start failed`, rebuild it from the leader:

```sh
patronictl -c /etc/patroni/config.yml reinit civora-<cell> <member> --force --wait
```

This erases that member's data directory and copies the leader again, so **never run it against the leader**. On large databases it takes as long as a full copy over the network.

## 6. Backups

| What | How |
|---|---|
| Schedule | Full weekly, differential daily, WAL continuously (archive on every WAL switch; RPO target ≤ 15 min) |
| Manual full backup | `sudo -u pgbackrest pgbackrest --stanza=civora backup --type=full` on the backup node |
| Status | `pgbackrest info` (§2). Alert if no backup in 26 h or a WAL gap > 15 min ([15 §15.2](../15-observability-backup-and-dr.md)) |
| Encryption | Repository encrypted (`aes-256-cbc`). Without the passphrase the repository is unreadable (tested) |
| Second copy | Repository 2 at the second in-country site: **not built yet** (needs the provider) |

## 7. Restore drills (monthly)

```sh
# Latest backup + all archived WAL; prints one JSON line, exits non-zero on failure
sudo -u postgres /usr/local/sbin/civora-restore-drill 'select count(*) from <a known table>'
# Point in time
sudo -u postgres CIVORA_DRILL_TARGET_TIME='2026-11-19 09:00:00+00' /usr/local/sbin/civora-restore-drill '<query>'
```

The drill:

1. restores into a scratch directory on the backup node;
2. starts PostgreSQL on a private socket with archiving off;
3. runs the query;
4. stops it;
5. verifies every page checksum (`pg_checksums`);
6. deletes the copy.

Measured: 2 s on the test data set. Real drills take as long as the data needs; record the time.

**Restoring the production cluster itself** (corruption, human error) means restoring into a **new** Patroni cluster from a chosen point in time, then pointing `pg-router` at it. This has **not been rehearsed yet**. It is the first DR exercise on staging once the provider is chosen.

## 8. Keys and secrets

| Secret | Where it lives | If lost |
|---|---|---|
| Repository passphrase (`repo1-cipher-pass`) | OpenBao; a sealed copy offline under M-of-N | **All backups become unreadable.** Keep two copies in separate places |
| Superuser, replication, rewind, REST API passwords | OpenBao → Ansible variables | Rotate with the role (re-run the playbook) |
| Application and owner account passwords | OpenBao → Kubernetes Secret (file mount) | Rotate in OpenBao, re-run the role, restart the pods |
| Node certificates | Cell CA (OpenBao PKI). Database node certificates also carry the `pg-router` service names (clients verify the server name) | Re-issue and re-run the role |

## 9. What the application sees during a failover

Measured through `pg-router`, with a client writing every 100 ms as the application account (`verify-full` TLS):

| Event | Write interruption | Acknowledged writes lost |
|---|---|---|
| Leader crash (frozen, no clean shutdown) | Patroni detection (leader key TTL 30 s) + router check (2 × 2 s): about 25–30 s | 0 |
| Planned switchover | A few seconds | 0 |

- The application must retry transactions that fail with a connection error. That is a Phase 3 coding standard for every module.
- The core service keeps running through failovers. Earlier, an unhandled pool error stopped the process; this was fixed on 19 Nov 2026 and is covered by a test.

## 10. Evidence to keep

For every drill or incident, keep:

- timestamps;
- the commands run;
- the `pgbackrest info` before and after;
- the drill JSON line;
- the write-gap measurement;
- the decision record (for §4).

Store them with the monthly drill log ([15 §15.5](../15-observability-backup-and-dr.md)).
