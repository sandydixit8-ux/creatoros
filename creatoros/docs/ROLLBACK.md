# CreatorOS — Rollback Plan

**Date:** 11 October 2026 (post-redesign deploy tooling)
**Applies when:** a post-deploy probe (see `docs/DEPLOY.md` §4) fails, or the live site regresses
beyond repair after shipping the redesign archive.

---

## 1. What we have to restore from

| Artifact | Location | Contents |
|---|---|---|
| Pre-deploy app archive | `~/app-pre-redesign-20261011.tar.gz` (made in `DEPLOY.md` §3 step 2) | Whole `/home/ubuntu/app` before extraction |
| DB snapshot | `/home/ubuntu/data/creatoros.db.snapshot-2026-10-11T…` (made in `DEPLOY.md` §3 step 1) | Live DB before deploy, integrity-checked |
| Recovery copy (extra safety net) | `C:\Users\Ats\AppData\Local\Temp\opencode\creatoros-recovery-20261010-1525\recovery-copy\creatoros` | pre-redesign build source **and** its `.env` backup; build from here only if the app archive is lost |
| Redesign archive | `C:\Users\Ats\AppData\Local\Temp\opencode\creatoros-new.tar.gz` | the new build (for re-applying after a fixed deploy) |

Ash-board incident history: older snapshots named `predeploy`, `pre-d5`, `pre-receipt` were the
subjects of deploy-integrity incidents in `CREATOROS_COMMERCIAL_AUDIT.md` and are **not** trusted
restore points. Always make a fresh snapshot per deploy.

## 2. Decision guide

- **Config/visual regression only, DB schema unchanged, no user-visible data error** (this release:
  no migrations shipped): revert code, keep the live DB.
- **DB corrupted or migrations half-applied** (e.g. `db:"ok"` fails or `integrity_check` errors):
  revert code **and** restore the DB snapshot, because a schema change mid-rollback leaves code
  that cannot read the migrated rows.
- **Not sure**: restore both. Code without its matching DB state is never trustworthy.

## 3. Procedure

1. Stop new traffic cleanly and STOP the service:
   ```
   # from the box; confirm the unit name first (DEPLOY.md §3 step 5)
   sudo systemctl stop <creatoros-unit>      # or: pm2 stop creatoros
   ```
2. If restoring the DB (decision guide above), move the live DB aside and restore the snapshot:
   ```
   mv /home/ubuntu/data/creatoros.db{,-post-redesign-2026-10-11}   # keep it for forensics
   mv /home/ubuntu/data/creatoros.db.snapshot-2026-10-11T<TIME> /home/ubuntu/data/creatoros.db
   sqlite3 /home/ubuntu/data/creatoros.db "PRAGMA integrity_check;"   # must be ok
   ```
3. Restore the app code from the pre-deploy archive:
   ```
   rm -rf /home/ubuntu/app                    # live `.env` is preserved separately on the box
   tar -xzf ~/app-pre-redesign-20261011.tar.gz -C /home/ubuntu
   # if the pre-deploy archive was never made, extract the recovery copy's build instead
   ```
4. Confirm the live `.env` survived in `/home/ubuntu/app/.env` (never restored from any archive;
   it is the box's own copy). If it is missing, copy it back from the recovery copy backup.
5. Start the service:
   ```
   sudo systemctl start <creatoros-unit>      # or: pm2 start creatoros
   ```
6. Verify the rollback exactly like a deploy (DEPLOY.md §4): `/api/health` → `{"ok":true,"db":"ok"}`,
   homepage HTML resolves, login works. The reverted build's `BUILD_ID` must differ from
   `BV3YuJAAPxGWHGqw6E3Mm` (i.e. it is genuinely the old build).

## 4. After rollback

- Keep the `-post-redesign-2026-10-11` DB and the failed archive untouched; they are evidence.
- Diagnose from the service logs before re-trying (`sudo journalctl -u <unit> -n 200`).
- Re-run the full green gate before shipping a fixed archive; never rerun `deploy.sh` with an
  unverified tarball.

## 5. Drill status

- Restore-from-snapshot drill of this exact procedure: **not yet executed** (was already listed as
  a pre-launch to-do in `PRODUCTION-READINESS-REPORT.md`). Recommended before or right after the
  first redesign deploy.