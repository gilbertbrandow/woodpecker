"""Build and query the local SQLite index of qualifying decoy positions from Lichess evals."""

import io
import json
import sqlite3
import time
from pathlib import Path

import zstandard

MIN_DEPTH = 20
MAX_ABS_CP = 200
CLUSTER_CP = 30
MIN_ACCEPTED = 3
MAX_ACCEPTED = 6
MIN_DROPOFF_CP = 50
_BATCH = 5_000
_PROGRESS = 200_000

DB_PATH = Path("/data/decoy_evals.sqlite")


def _normalize_cp(cp: int, fen: str) -> int:
    return cp if fen.split()[1] == "w" else -cp


def classify(evals: list[dict], fen: str) -> dict | None:
    candidates = [e for e in evals if e.get("depth", 0) >= MIN_DEPTH]
    if not candidates:
        return None
    top = max(candidates, key=lambda e: e["depth"])
    depth = top["depth"]

    cp_pvs = [pv for pv in top.get("pvs", []) if pv.get("cp") is not None]
    if len(cp_pvs) < MIN_ACCEPTED:
        return None

    entries = sorted(
        [(_normalize_cp(pv["cp"], fen), pv) for pv in cp_pvs],
        key=lambda x: x[0],
        reverse=True,
    )
    best_cp = entries[0][0]

    if abs(best_cp) > MAX_ABS_CP:
        return None

    seen: set[str] = set()
    unique: list[tuple[int, str, str]] = []  # (norm_cp, first_uci, full_line)
    for norm_cp, pv in entries:
        line = pv.get("line") or ""
        first = line.split()[0] if line else ""
        if not first or first in seen:
            continue
        seen.add(first)
        unique.append((norm_cp, first, line))

    accepted = []
    for norm_cp, uci, line in unique:
        if best_cp - norm_cp <= CLUSTER_CP:
            accepted.append({"uci": uci, "line": line, "cp": norm_cp, "dropCp": best_cp - norm_cp})
        else:
            break

    if not (MIN_ACCEPTED <= len(accepted) <= MAX_ACCEPTED):
        return None

    first_outside_idx = len(accepted)
    if first_outside_idx >= len(unique):
        return None
    outside_cp = unique[first_outside_idx][0]
    if best_cp - outside_cp < MIN_DROPOFF_CP:
        return None

    return {"bestCp": best_cp, "depth": depth, "acceptedMoves": accepted}


def build(
    src: Path,
    db_path: Path = DB_PATH,
    *,
    force: bool = False,
    limit: int | None = None,
) -> None:
    if db_path.exists() and not force:
        conn = sqlite3.connect(db_path)
        try:
            count = conn.execute("SELECT COUNT(*) FROM qualifying_positions").fetchone()[0]
        except sqlite3.OperationalError:
            count = 0
        finally:
            conn.close()
        if count > 0:
            print(f"DB already has {count:,} qualifying positions. Pass --force to rebuild.")
            return

    db_path.parent.mkdir(parents=True, exist_ok=True)
    if force and db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-65536")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS qualifying_positions (
            fen TEXT PRIMARY KEY,
            best_cp INTEGER NOT NULL,
            depth INTEGER NOT NULL,
            accepted_moves TEXT NOT NULL
        )
        """
    )
    conn.commit()

    start = time.monotonic()
    lines = 0
    inserted = 0
    batch: list[tuple[str, int, int, str]] = []

    dctx = zstandard.ZstdDecompressor()
    with open(src, "rb") as fh:
        text = io.TextIOWrapper(dctx.stream_reader(fh), encoding="utf-8")
        try:
            for raw_line in text:
                raw_line = raw_line.strip()
                if not raw_line:
                    continue
                lines += 1

                try:
                    entry = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue

                result = classify(entry.get("evals", []), entry.get("fen", ""))
                if result is None:
                    continue

                batch.append((
                    entry["fen"],
                    result["bestCp"],
                    result["depth"],
                    json.dumps(result["acceptedMoves"]),
                ))
                inserted += 1

                if len(batch) >= _BATCH:
                    conn.executemany(
                        "INSERT OR REPLACE INTO qualifying_positions "
                        "(fen, best_cp, depth, accepted_moves) VALUES (?, ?, ?, ?)",
                        batch,
                    )
                    conn.commit()
                    batch.clear()

                if limit and lines >= limit:
                    break

                if lines % _PROGRESS == 0:
                    elapsed = time.monotonic() - start
                    print(f"Lines {lines:,} | Inserted {inserted:,} | {elapsed:.0f}s", flush=True)
        finally:
            text.close()

    if batch:
        conn.executemany(
            "INSERT OR REPLACE INTO qualifying_positions "
            "(fen, best_cp, depth, accepted_moves) VALUES (?, ?, ?, ?)",
            batch,
        )
        conn.commit()

    conn.close()
    elapsed = time.monotonic() - start
    print(f"\nDone. Lines: {lines:,} | Qualifying positions: {inserted:,} | {elapsed:.1f}s")


def lookup(conn: sqlite3.Connection, fen_4: str) -> dict | None:
    row = conn.execute(
        "SELECT best_cp, depth, accepted_moves FROM qualifying_positions WHERE fen = ?",
        (fen_4,),
    ).fetchone()
    if row is None:
        return None
    return {"bestCp": row[0], "depth": row[1], "acceptedMoves": json.loads(row[2])}


def open_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    if not db_path.exists():
        raise FileNotFoundError(f"Eval DB not found at {db_path}. Run: make build-evals")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.execute("PRAGMA cache_size=-65536")
    return conn
