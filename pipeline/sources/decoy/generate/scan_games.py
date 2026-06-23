"""Scan OTB master game PGN files against the eval DB and emit qualifying decoy positions."""

import json
import shutil
import tempfile
import time
import zipfile
from collections import Counter
from pathlib import Path

import chess
import chess.pgn
import py7zr
import requests

from eval_db import DB_PATH, lookup, open_db

MOVE_MIN = 20

_EXPLORER_URL = "https://explorer.lichess.org/masters"
_LICHESS_GAME_BASE = "https://lichess.org/{}"
_RATE_INTERVAL = 1.0


class _LichessAuthError(Exception):
    pass


def _short_fen(board: chess.Board) -> str:
    return " ".join(board.fen().split()[:4])


def _avg_elo(game: chess.pgn.Game) -> int:
    try:
        w = int(game.headers.get("WhiteElo") or 0)
        b = int(game.headers.get("BlackElo") or 0)
        return (w + b) // 2 if w and b else 0
    except ValueError:
        return 0


def _extracted_pgn_path(archive: Path) -> Path:
    return archive.with_suffix(".pgn")


def _ensure_extracted(path: Path) -> Path:
    suffix = path.suffix.lower()
    if suffix not in (".7z", ".zip"):
        return path

    out = _extracted_pgn_path(path)
    if out.exists():
        return out

    print(f"Extracting {path.name} → {out.name} ...")
    if suffix == ".7z":
        with py7zr.SevenZipFile(path, mode="r") as arc:
            pgn_names = [n for n in arc.namelist() if n.lower().endswith(".pgn")]
            if not pgn_names:
                raise ValueError(f"No .pgn file found inside {path}")
            with tempfile.TemporaryDirectory() as tmpdir:
                arc.extractall(path=tmpdir)
                # shutil.move handles cross-device moves (e.g. tmpfs → bind mount in Docker)
                shutil.move(str(Path(tmpdir) / pgn_names[0]), str(out))
    else:
        with zipfile.ZipFile(path) as zf:
            pgn_names = [n for n in zf.namelist() if n.lower().endswith(".pgn")]
            if not pgn_names:
                raise ValueError(f"No .pgn file found inside {path}")
            with tempfile.TemporaryDirectory() as tmpdir:
                zf.extract(pgn_names[0], path=tmpdir)
                shutil.move(str(Path(tmpdir) / pgn_names[0]), str(out))

    print(f"Extracted: {out} ({out.stat().st_size // 1_000_000} MB)")
    return out


def _build_elo_index(pgn_path: Path, min_both_elo: int = 0) -> list[tuple[int, int]]:
    index: list[tuple[int, int]] = []
    with open(pgn_path, encoding="utf-8", errors="replace") as f:
        while True:
            offset = f.tell()
            headers = chess.pgn.read_headers(f)
            if headers is None:
                break
            try:
                w = int(headers.get("WhiteElo") or 0)
                b = int(headers.get("BlackElo") or 0)
            except ValueError:
                continue
            if min_both_elo and (w < min_both_elo or b < min_both_elo):
                continue
            index.append(((w + b) // 2, offset))
    index.sort(key=lambda x: x[0], reverse=True)
    return index


def stream_games(path: Path, min_both_elo: int = 0):
    pgn_path = _ensure_extracted(path)
    with open(pgn_path, encoding="utf-8", errors="replace") as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            if min_both_elo:
                try:
                    w = int(game.headers.get("WhiteElo") or 0)
                    b = int(game.headers.get("BlackElo") or 0)
                except ValueError:
                    continue
                if w < min_both_elo or b < min_both_elo:
                    continue
            yield game


def stream_games_by_elo(path: Path, min_both_elo: int = 0):
    pgn_path = _ensure_extracted(path)
    print(f"Building ELO index for {pgn_path.name} ...", flush=True)
    index = _build_elo_index(pgn_path, min_both_elo=min_both_elo)
    print(
        f"Index built: {len(index):,} qualifying games, top avg ELO: {index[0][0] if index else 0}",
        flush=True,
    )
    with open(pgn_path, encoding="utf-8", errors="replace") as f:
        for _avg, offset in index:
            f.seek(offset)
            game = chess.pgn.read_game(f)
            if game is not None:
                yield game


def _fetch_lichess_url(
    fen: str,
    http: requests.Session,
    last_req: list[float],
    fen_cache: dict[str, str | None],
) -> str | None:
    """Rate-limited Lichess Masters Explorer lookup with cross-game FEN cache.

    Retries indefinitely on transient errors (network, 5xx, 429).
    Returns None only when the API definitively responds 200 with no topGames,
    meaning this position is simply not in the Lichess Masters database.
    """
    if fen in fen_cache:
        return fen_cache[fen]

    elapsed = time.monotonic() - last_req[0]
    if elapsed < _RATE_INTERVAL:
        time.sleep(_RATE_INTERVAL - elapsed)

    backoff = 2.0
    attempts = 0
    max_attempts = 8
    while attempts < max_attempts:
        try:
            resp = http.get(
                _EXPLORER_URL,
                params={"fen": fen, "topGames": 1, "moves": 0},
                timeout=10,
            )
            last_req[0] = time.monotonic()

            if resp.status_code == 401:
                raise _LichessAuthError(
                    "Lichess API returned 401. Set LICHESS_TOKEN env var or pass --lichess-token."
                )
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 60))
                print(f"  429 rate limited — sleeping {retry_after}s", flush=True)
                time.sleep(retry_after)
                last_req[0] = time.monotonic()
                continue  # 429 doesn't count as an attempt
            if resp.status_code == 200:
                games = resp.json().get("topGames", [])
                url = _LICHESS_GAME_BASE.format(games[0]["id"]) if games else None
                fen_cache[fen] = url
                return url

            print(f"  Unexpected status {resp.status_code} — retrying in {backoff:.0f}s", flush=True)

        except _LichessAuthError:
            raise
        except Exception as exc:
            print(f"  Lichess request error ({exc}) — retrying in {backoff:.0f}s", flush=True)

        attempts += 1
        time.sleep(backoff)
        backoff = min(backoff * 2, 60.0)
        last_req[0] = time.monotonic()

    print(f"  Failed to resolve Lichess URL after {max_attempts} attempts — storing null", flush=True)
    fen_cache[fen] = None
    return None


def print_info(path: Path, min_both_elo: int = 0) -> None:
    total = 0
    elos: list[int] = []
    events: Counter[str] = Counter()

    for game in stream_games(path, min_both_elo=min_both_elo):
        total += 1
        avg = _avg_elo(game)
        if avg:
            elos.append(avg)
        events[game.headers.get("Event", "?")] += 1
        if total % 50_000 == 0:
            print(f"  ... {total:,} games scanned so far", flush=True)

    print(f"Total games: {total:,}")
    if elos:
        print(f"Avg ELO range: {min(elos):,} – {max(elos):,}")
    print()
    print("Top 20 events:")
    for event, count in events.most_common(20):
        print(f"  {count:4d}  {event}")


def scan(
    path: Path,
    out_path: Path,
    *,
    db_path: Path = DB_PATH,
    min_both_elo: int = 2600,
    sort_by_elo: bool = False,
    event_filter: str | None = None,
    games_limit: int | None = None,
    decoys_limit: int | None = None,
    max_per_game: int = 2,
    fetch_lichess_urls: bool = True,
    lichess_token: str | None = None,
) -> None:
    start = time.monotonic()
    games_processed = 0
    positions_checked = 0
    decoys_found = 0
    lichess_queries = 0

    conn = open_db(db_path)
    game_source = stream_games_by_elo if sort_by_elo else stream_games

    if fetch_lichess_urls and not lichess_token:
        print(
            "Warning: fetch_lichess_urls=True but no lichess_token provided. "
            "All lichessGameUrl fields will be null. Set LICHESS_TOKEN to fix this.",
            flush=True,
        )
        fetch_lichess_urls = False

    http = requests.Session()
    http.headers["Accept"] = "application/json"
    if lichess_token:
        http.headers["Authorization"] = f"Bearer {lichess_token}"
    last_req: list[float] = [0.0]
    fen_cache: dict[str, str | None] = {}

    try:
        with open(out_path, "w", encoding="utf-8") as out:
            for game in game_source(path, min_both_elo=min_both_elo):
                event = game.headers.get("Event", "")
                if event_filter and event_filter.lower() not in event.lower():
                    continue

                games_processed += 1
                board = game.board()
                prev_fen_4: str | None = None
                prev_move_uci: str | None = None
                move_num = 0
                decoys_this_game = 0
                next_check_at = MOVE_MIN
                game_lichess_url: str | None = None
                game_lichess_fetched = False

                for node in game.mainline():
                    move = node.move
                    if move is None:
                        break
                    move_num += 1

                    # Compute FEN once — reused for both the lookup and prev_fen_4 update
                    current_fen_4 = _short_fen(board)

                    if move_num >= next_check_at and prev_fen_4 is not None:
                        positions_checked += 1
                        result = lookup(conn, current_fen_4)
                        if result is not None:
                            decoys_found += 1
                            decoys_this_game += 1

                            if fetch_lichess_urls and not game_lichess_fetched:
                                # Query once per OTB game, reuse URL for any further decoys
                                lichess_queries += 1
                                print(
                                    f"  [API call #{lichess_queries}] {game.headers.get('White')} vs "
                                    f"{game.headers.get('Black')} move {move_num} — querying Lichess ...",
                                    flush=True,
                                )
                                try:
                                    game_lichess_url = _fetch_lichess_url(
                                        current_fen_4, http, last_req, fen_cache
                                    )
                                except _LichessAuthError as e:
                                    print(f"\nWarning: {e}\nDisabling Lichess URL fetching for this run.", flush=True)
                                    fetch_lichess_urls = False
                                print(f"  → {game_lichess_url}", flush=True)
                                game_lichess_fetched = True
                            elif decoys_this_game > 1:
                                print(
                                    f"  [reuse] {game.headers.get('White')} vs "
                                    f"{game.headers.get('Black')} move {move_num} — reusing {game_lichess_url}",
                                    flush=True,
                                )

                            record = {
                                "fen": prev_fen_4,
                                "opponentMove": prev_move_uci,
                                "bestCp": result["bestCp"],
                                "depth": result["depth"],
                                "acceptedMoves": result["acceptedMoves"],
                                "source": "otb_master",
                                "event": event,
                                "date": game.headers.get("Date"),
                                "white": game.headers.get("White"),
                                "black": game.headers.get("Black"),
                                "whiteElo": game.headers.get("WhiteElo"),
                                "blackElo": game.headers.get("BlackElo"),
                                "whiteTitle": game.headers.get("WhiteTitle"),
                                "blackTitle": game.headers.get("BlackTitle"),
                                "moveNumber": move_num,
                                "eco": game.headers.get("ECO"),
                                "openingName": game.headers.get("Opening"),
                                "lichessGameUrl": game_lichess_url,
                            }
                            out.write(json.dumps(record, ensure_ascii=False) + "\n")
                            next_check_at = move_num + 10
                            if decoys_this_game >= max_per_game:
                                break

                    prev_fen_4 = current_fen_4
                    prev_move_uci = move.uci()
                    board.push(move)

                if games_processed % 1_000 == 0:
                    elapsed = time.monotonic() - start
                    print(
                        f"Games {games_processed:,} | Positions checked {positions_checked:,} | "
                        f"Decoys {decoys_found:,} | Lichess queries {lichess_queries:,} | {elapsed:.0f}s",
                        flush=True,
                    )

                if games_limit and games_processed >= games_limit:
                    break
                if decoys_limit and decoys_found >= decoys_limit:
                    break
    finally:
        conn.close()

    elapsed = time.monotonic() - start
    print(f"Games processed:    {games_processed:,}")
    print(f"Positions checked:  {positions_checked:,}")
    print(
        f"Decoys found:       {decoys_found:,}  ({decoys_found / max(positions_checked, 1) * 100:.2f}% hit rate)"
    )
    print(f"Lichess queries:    {lichess_queries:,} ({len(fen_cache)} unique FENs cached)")
    print(f"Elapsed:            {elapsed:.1f}s")
    print(f"Output:             {out_path}")
