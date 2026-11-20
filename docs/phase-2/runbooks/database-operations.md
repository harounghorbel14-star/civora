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
8. Disaster recovery: rebuild the cluster from a repository (8.1 live second site: promote the standby cluster)
9. Keys and secrets
10. What the application sees during a failover
11. Evidence to keep

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
| Application entry point | Service `pg-router` (HAProxy): port 5432 for clients, `:8404/healthz` for probes (ready only while a primary is known). A starting router sends no client anywhere until a check has shown which server is primary (the first checks run at start-up; ready in under a second in tests) |
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
- Stopping Patroni on the leader (`systemctl stop patroni`) also hands over leadership; both were tested, measured 2 s.
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

`patronictl` may first print an error about the frozen node's etcd endpoint. It then uses the other members, so the error is expected.

Measured with `sync-safety-experiment.sh` on 20 Nov 2026 ([17 §17.2.1](../17-technical-validation-strategy.md)):

| Step | Result |
|---|---|
| Waiting for automatic promotion | None for 120 s |
| Standby promoted | 5 s after the operator action |
| Writes the old leader had acknowledged in the window | **50 of 50 lost** |
| Old leader rejoined through `pg_rewind` | 4 s after the server returned |
| Synchronous standby designated again | 4 s after re-enabling |

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
| Second copy | **Repository 2** at the second in-country site (group `backup_dr`), its own encryption key, WAL archived to both. Built and tested on containers; real hosts need the provider |

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

**Restoring the production cluster itself** (corruption, human error, or loss of the main site) means building a **new** Patroni cluster from a repository (§8 below), then pointing `pg-router` at it.

## 8. Disaster recovery: rebuild the cluster from a repository (tested 20 Nov 2026)

**When.** Use it in either case:
- the main site is lost; rebuild at the second site from **repository 2**;
- data is corrupted; rebuild anywhere from either repository, to a point in time before the damage.

**Steps:**

1. Provision the new database servers (OpenTofu, same cell). Generate the inventory with the database servers at the new site and the surviving repository host:
   - repository 2 stays in group `backup_dr`;
   - group `backup` is empty if the main site is lost.
2. Set `postgresql_ha_bootstrap_from_repo: 2` (or `1`). Optionally set `postgresql_ha_bootstrap_target_time: "2026-11-20 09:00:00+00"` to stop before the damage.
3. Run `site.yml` (database play). Patroni does the rest:
   - it restores the latest backup set;
   - it replays the archived WAL (to the end, or to the target time);
   - it promotes the first server;
   - it clones the second server from it.
4. Update `pg-router`'s `servers` (Helm values, through Argo CD) to the new servers. Applications reconnect by themselves.
5. Remove `postgresql_ha_bootstrap_from_repo` from the inventory afterwards: it only matters when a cluster is first created.
6. Check:
   - `pgbackrest check` (the new timeline is archived);
   - take a new full backup;
   - plan the re-creation of the lost site's repository.

**Measured** (`infra/ansible/tests/postgresql-ha/dr.sh`, both sites on containers; nightly on GitHub):

| | Result |
|---|---|
| Data restored | Every acknowledged write up to the last archived WAL, with no gaps |
| Data lost (RPO) | The writes of the last **16 s** before the loss (63 of 291 in the test). WAL is archived at least every 60 s (`archive_timeout`); the target is ≤ 15 min |
| Time until writes are accepted again (RTO, test) | **85 s**: server start, role, restore, replay, promotion, router. Real servers add provisioning time; the target is ≤ 4 h |

**Repository schedules.**
- pgBackRest allows **one backup per stanza at a time** (it takes a lock on the database host).
- Repository 1 is backed up at 01:00 and repository 2 at 03:30. A unit that meets a lock retries after 10 minutes.
- If the link to the second site is down, WAL accumulates on the database servers until it returns. Watch the archive alert (§15.2 of the observability document).

## 8.1 Live second site: promote the standby cluster (tested 20 Nov 2026)

**Topology.** Inventory group `standby_db_nodes` (OpenTofu role `db_standby`):
- two or more database servers at the second site run a Patroni **standby cluster**;
- its leader streams WAL from the main site continuously, over TLS checked against the cell CA, through the permanent slot `civora_standby_site`;
- repository 2 provides any WAL the stream missed;
- it has its own etcd: the second site's servers plus the repository-2 node;
- it refuses writes until promoted.

The main site keeps at most `max_slot_wal_keep_size` (50 GB) of WAL for it. Alerts fire before that limit (§15.2).

**Check it is healthy** (§2 from a second-site server):
- one `standby_leader` and its replicas, all `streaming`;
- on the main primary, slot `civora_standby_site` is active;
- alerts `CivoraStandbySiteDisconnected` and `CivoraStandbySiteLagging` are quiet.

**When the main site is lost:**

1. **Decide and record.** The on-call engineer and the incident lead declare the main site lost. Write down the time.
2. **Fence the main site.** It must not come back as a second primary.
   - Power off or isolate its database servers through the provider.
   - If reachable, run `systemctl stop patroni` on each.
   - Never promote while the old primary might still accept writes.
3. **Promote**, on any second-site database server:

   ```sh
   patronictl -c /etc/patroni/config.yml edit-config --force -s standby_cluster=null
   ```

   Within seconds the standby leader becomes `leader`, and a replica becomes `sync_standby` (check with §2).
4. **Point `pg-router`** at the second-site servers (Helm values `servers`, through Argo CD). Applications reconnect by themselves.
5. **Check archiving:** `pgbackrest --stanza=civora check` on the new leader. Repository 2 receives the new timeline.
6. **Re-run the role for the new topology:**
   - `db_nodes` = the second-site servers;
   - `backup_dr` = the repository-2 node;
   - no `standby_db_nodes` group.

   Repository 2's backups then follow the new primary. Take a full backup.
7. **Later, rebuild the lost site as the new standby site.** Use new or wiped servers: the old data diverged and must not be reused. Set the inventory group `standby_db_nodes` to those servers, and swap the roles of the two repository nodes in the inventory.

**Measured** ([`dr-standby.sh`](../../../infra/ansible/tests/postgresql-ha/dr-standby.sh), both sites on containers; nightly on GitHub):

| | Result |
|---|---|
| Acknowledged writes lost when the main site vanished | **0 of 176** (client writing every 200 ms) |
| Promotion after the command | 4 s |
| Writes accepted through `pg-router` after the loss | 10 s (the test runs the steps immediately; real time adds steps 1–2) |
| After the role re-run | Full backup of the new primary to repository 2 succeeds; no data changed |

**Not yet rehearsed:** a *planned* switch between sites while both are up (for maintenance). It needs the main site turned into a standby of the second site; the procedure will be written and rehearsed before the pilot.

## 9. Keys and secrets

| Secret | Where it lives | If lost |
|---|---|---|
| Repository passphrases (`repo1-cipher-pass`, `repo2-cipher-pass` — different per repository, enforced by the role) | OpenBao; a sealed copy offline under M-of-N, **one copy at each site** | **That repository's backups become unreadable.** Keep two copies in separate places |
| Superuser, replication, rewind, REST API passwords | OpenBao → Ansible variables | Rotate with the role (re-run the playbook) |
| Application and owner account passwords | OpenBao → Kubernetes Secret (file mount) | Rotate in OpenBao, re-run the role, restart the pods |
| Node certificates | Cell CA (OpenBao PKI). Database node certificates also carry the `pg-router` service names (clients verify the server name) | Re-issue and re-run the role |

## 10. What the application sees during a failover

Measured through `pg-router`, with a client writing every 100 ms as the application account (`verify-full` TLS):

| Event | Write interruption | Acknowledged writes lost |
|---|---|---|
| Leader crash (frozen, no clean shutdown) | Leader lease (30 s) + up to one Patroni loop (10 s) + two router checks (2 × 2 s). Measured: longest gap 26.7 s (2 servers), 39.0 s (3 servers) | **0** |
| Planned failover or switchover | Measured: leadership moved in 2 s | **0** |

- The application must retry transactions that fail with a connection error. That is a Phase 3 coding standard for every module.
- The core service keeps running through failovers. Earlier, an unhandled pool error stopped the process; this was fixed on 19 Nov 2026 and is covered by a test.

## 11. Evidence to keep

For every drill or incident, keep:

- timestamps;
- the commands run;
- the `pgbackrest info` before and after;
- the drill JSON line;
- the write-gap measurement;
- the decision record (for §4).

Store them with the monthly drill log ([15 §15.5](../15-observability-backup-and-dr.md)).
