import gzip
import os
import shutil
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone

import boto3  # type: ignore[import-not-found]
import sentry_sdk
from sentry_sdk.crons import capture_checkin
from sentry_sdk.crons.consts import MonitorStatus

MONITOR_SLUG = "woodpecker-backup"
MONITOR_CONFIG = {
    "schedule": {"type": "crontab", "value": "0 2 * * *"},
    "timezone": "UTC",
    "checkin_margin": 10,
    "max_runtime": 30,
}


def _init_sentry() -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment="production",
        traces_sample_rate=0.0,
        send_default_pii=False,
    )


def _run_backup() -> None:
    postgres_user = os.environ["POSTGRES_USER"]
    postgres_password = os.environ["POSTGRES_PASSWORD"]
    postgres_db = os.environ["POSTGRES_DB"]
    backup_bucket = os.environ["BACKUP_BUCKET"]

    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    s3_key = f"{now.strftime('%Y')}/{now.strftime('%m')}/woodpecker_{timestamp}.sql.gz"

    print(f"[backup] Starting pg_dump at {timestamp}")

    s3 = boto3.client("s3", region_name="eu-west-1")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".sql.gz", prefix="woodpecker-")
    os.close(tmp_fd)
    try:
        pg_dump = subprocess.Popen(
            ["pg_dump", "-h", "db", "-U", postgres_user, postgres_db],
            stdout=subprocess.PIPE,
            env={**os.environ, "PGPASSWORD": postgres_password},
        )
        try:
            assert pg_dump.stdout is not None
            with open(tmp_path, "wb") as f:
                with gzip.GzipFile(fileobj=f, mode="wb") as gz:
                    shutil.copyfileobj(pg_dump.stdout, gz)
            pg_dump.wait()
            if pg_dump.returncode != 0:
                raise subprocess.CalledProcessError(pg_dump.returncode, "pg_dump")
        except:
            pg_dump.kill()
            pg_dump.wait()
            raise

        print(f"[backup] Uploading to s3://{backup_bucket}/{s3_key}")
        s3.upload_file(tmp_path, backup_bucket, s3_key)
        print("[backup] Upload complete")
    finally:
        os.unlink(tmp_path)

    _verify_upload(s3, backup_bucket, s3_key)
    print("[backup] Done")


def _verify_upload(s3, backup_bucket: str, s3_key: str) -> None:
    print(f"[backup] Verifying s3://{backup_bucket}/{s3_key}")
    verify_fd, verify_path = tempfile.mkstemp(suffix=".sql.gz", prefix="woodpecker-verify-")
    os.close(verify_fd)
    try:
        s3.download_file(backup_bucket, s3_key, verify_path)
        with gzip.open(verify_path, "rb") as f:
            while f.read(65536):
                pass
        print("[backup] Verification OK — backup is readable")
    finally:
        os.unlink(verify_path)


def main() -> None:
    _init_sentry()

    check_in_id = capture_checkin(
        monitor_slug=MONITOR_SLUG,
        status=MonitorStatus.IN_PROGRESS,
        monitor_config=MONITOR_CONFIG,  # type: ignore[arg-type]
    ) or str(uuid.uuid4())

    try:
        _run_backup()
        capture_checkin(
            monitor_slug=MONITOR_SLUG,
            check_in_id=check_in_id,
            status=MonitorStatus.OK,
        )
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        capture_checkin(
            monitor_slug=MONITOR_SLUG,
            check_in_id=check_in_id,
            status=MonitorStatus.ERROR,
        )
        print(f"[backup] FAILED: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
