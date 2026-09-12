import json
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

import chess
import click
import requests
import sqlalchemy as sa
from flask import Flask


def register_commands(app: Flask) -> None:
    @app.cli.command("whitelist-add")
    @click.option("--username", required=True, help="Lichess username to whitelist")
    def whitelist_add(username: str) -> None:
        from app.services.whitelist_service import add

        added = add(username)
        if added:
            click.echo(f"Added {username.lower()} to whitelist.")
        else:
            click.echo(f"{username.lower()} is already whitelisted.")

    @app.cli.command("superadmin-add")
    @click.option("--username", required=True, help="Lichess username to grant superadmin")
    def superadmin_add(username: str) -> None:
        import sqlalchemy as sa

        from app.extensions import db
        from app.models.user import User

        normalized = username.lower()
        user = db.session.execute(
            sa.select(User).filter_by(lichess_username=normalized)
        ).scalar_one_or_none()
        if not user:
            click.echo(f"No active user found with Lichess username '{normalized}'.")
            return
        user.is_superadmin = True
        db.session.commit()
        click.echo(f"Granted superadmin to {normalized}.")

    @app.cli.command("backfill-country")
    def backfill_country() -> None:
        """Fetch country_code from Lichess public API for users missing it."""
        import requests as http
        import sqlalchemy as sa

        from app.extensions import db
        from app.models.user import User
        from app.services.flags import is_valid_flag

        users = db.session.scalars(
            sa.select(User).where(User.country_code.is_(None))
        ).all()

        if not users:
            click.echo("All users already have a country_code.")
            return

        click.echo(f"Backfilling country for {len(users)} users...")
        updated = 0
        for user in users:
            try:
                resp = http.get(
                    f"https://lichess.org/api/user/{user.lichess_username}",
                    timeout=5,
                )
                if resp.ok:
                    data = resp.json()
                    profile = data.get("profile") or {}
                    raw = profile.get("flag") or profile.get("country")
                    if raw and isinstance(raw, str) and is_valid_flag(raw):
                        user.country_code = raw
                        updated += 1
            except http.exceptions.RequestException:
                click.echo(f"  Warning: failed to fetch {user.lichess_username}")
            time.sleep(0.1)  # ~10 req/s, well under Lichess rate limit

        db.session.commit()
        click.echo(f"Done. Updated {updated}/{len(users)} users.")

    @app.cli.command("backfill-source-game-moves")
    @click.option("--api-token", default=None, envvar="LICHESS_API_TOKEN", help="Lichess API token (optional but recommended to avoid rate limits)")
    @click.option("--batch-size", type=int, default=300, show_default=True, help="Lichess API batch size (max 300)")
    @click.option("--dry-run", is_flag=True, default=False, help="Report counts without making any changes")
    def backfill_source_game_moves(api_token: str | None, batch_size: int, dry_run: bool) -> None:
        """Backfill SourceGame.moves and puzzle game_id FKs for all existing training data.

        Processes three passes in order:
          1. lichess_tactics with game_id IS NULL  → create SourceGame rows + set FK
          2. scraped_positional_puzzles with game_id IS NULL  → create SourceGame rows + set FK
          3. games with lichess_id IS NOT NULL AND moves IS NULL  → populate moves column
        """
        from datetime import datetime, timezone

        from app.extensions import db
        from app.models.game import SourceGame
        from app.models.lichess_tactic import LichessTactic
        from app.models.opening import Opening
        from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
        from app.models.source_import_run import (
            SourceImportOperation,
            SourceImportSource,
            SourceImportRun,
            SourceImportStatus,
        )

        def _san_to_uci(san_moves: str) -> str | None:
            if not san_moves:
                return None
            board = chess.Board()
            uci: list[str] = []
            for san in san_moves.split():
                try:
                    move = board.parse_san(san)
                    uci.append(move.uci())
                    board.push(move)
                except Exception:
                    return None
            return " ".join(uci)

        def _fetch_games(game_ids: list[str]) -> dict[str, dict]:
            headers: dict[str, str] = {"Accept": "application/x-ndjson"}
            if api_token:
                headers["Authorization"] = f"Bearer {api_token}"
            resp = requests.post(
                "https://lichess.org/api/games/export/_ids",
                params={"opening": "true"},
                data=",".join(game_ids),
                headers={**headers, "Content-Type": "text/plain"},
                timeout=60,
                stream=True,
            )
            resp.raise_for_status()
            result: dict[str, dict] = {}
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                game = json.loads(raw_line)
                gid = game.get("id", "")
                if gid:
                    san_moves = game.get("moves", "")
                    white_p = game.get("players", {}).get("white", {})
                    black_p = game.get("players", {}).get("black", {})
                    white_user = white_p.get("user") or {}
                    black_user = black_p.get("user") or {}
                    opening = game.get("opening")
                    created_at = game.get("createdAt")
                    date_str: str | None = None
                    if created_at:
                        date_str = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc).strftime("%Y.%m.%d")
                    result[gid] = {
                        "moves_uci": _san_to_uci(san_moves),
                        "opening": opening,
                        "white": white_user.get("name") or "?",
                        "black": black_user.get("name") or "?",
                        "white_elo": white_p.get("rating"),
                        "black_elo": black_p.get("rating"),
                        "white_title": white_user.get("title"),
                        "black_title": black_user.get("title"),
                        "event": game.get("perf"),
                        "date": date_str,
                        "eco": opening.get("eco") if opening else None,
                    }
            return result

        def _lichess_id_from_url(url: str) -> str | None:
            try:
                parts = urlsplit(url).path.strip("/").split("/")
                return parts[0] if parts else None
            except Exception:
                return None

        def _load_opening_caches() -> tuple[dict[str, int], dict[str, list[tuple[int, str]]]]:
            rows = db.session.execute(
                sa.select(Opening.id, Opening.eco, Opening.display_name)
            ).all()
            by_name: dict[str, int] = {}
            by_eco: dict[str, list[tuple[int, str]]] = {}
            for id_, eco, display_name in rows:
                by_name[display_name] = id_
                by_eco.setdefault(eco, []).append((id_, display_name))
            return by_name, by_eco

        def _upsert_games_from_api(
            lichess_ids: list[str],
            run_id: int,
            by_name: dict[str, int],
            by_eco: dict[str, list[tuple[int, str]]],
        ) -> dict[str, int]:
            existing = {
                row.lichess_id: row.id
                for row in db.session.execute(
                    sa.select(SourceGame.lichess_id, SourceGame.id)
                    .where(SourceGame.lichess_id.in_(lichess_ids))
                ).all()
            }
            new_ids = [gid for gid in lichess_ids if gid not in existing]
            if not new_ids:
                return existing

            api_data = _fetch_games(new_ids)
            time.sleep(1.0)

            new_rows = []
            for lichess_id in new_ids:
                data = api_data.get(lichess_id)
                if not data:
                    continue
                opening = data.get("opening") or {}
                opening_name = opening.get("name") if isinstance(opening, dict) else None
                eco = data.get("eco")
                opening_id: int | None = None
                if opening_name and opening_name in by_name:
                    opening_id = by_name[opening_name]
                elif eco and eco in by_eco:
                    opening_id = by_eco[eco][0][0]
                new_rows.append({
                    "lichess_id": lichess_id,
                    "white": data.get("white") or "?",
                    "black": data.get("black") or "?",
                    "white_elo": data.get("white_elo"),
                    "black_elo": data.get("black_elo"),
                    "white_title": data.get("white_title"),
                    "black_title": data.get("black_title"),
                    "event": data.get("event"),
                    "date": data.get("date"),
                    "eco": eco,
                    "moves": data.get("moves_uci"),
                    "opening_id": opening_id,
                    "source_import_run_id": run_id,
                })

            if new_rows:
                from sqlalchemy.dialects.postgresql import insert as pg_insert
                inserted = db.session.execute(
                    pg_insert(SourceGame.__table__)
                    .values(new_rows)
                    .on_conflict_do_nothing(index_elements=["lichess_id"])
                    .returning(SourceGame.__table__.c.id, SourceGame.__table__.c.lichess_id)
                ).all()
                db.session.commit()
                for row in inserted:
                    existing[row.lichess_id] = row.id

            return existing

        click.echo("=== backfill-source-game-moves ===")

        # --- Create a SOURCE_GAME_BACKFILL import run ---
        if dry_run:
            click.echo("[dry-run] Skipping SourceImportRun creation.")
            run_id = -1
        else:
            run = SourceImportRun(
                source=SourceImportSource.SOURCE_GAME_BACKFILL,
                operation=SourceImportOperation.SOURCE_GAME_BACKFILL,
                status=SourceImportStatus.RUNNING,
                started_at=datetime.now(tz=timezone.utc),
            )
            db.session.add(run)
            db.session.commit()
            run_id = run.id
            click.echo(f"Created SourceImportRun #{run_id}")

        by_name, by_eco = _load_opening_caches()
        total_tactics_linked = 0
        total_positional_linked = 0
        total_moves_populated = 0

        # --- Pass 1: lichess_tactics with game_id IS NULL ---
        tactics_without_game = db.session.execute(
            sa.select(LichessTactic.id, LichessTactic.puzzle_id, LichessTactic.game_url)
            .where(LichessTactic.game_id.is_(None))
        ).all()
        click.echo(f"Pass 1: {len(tactics_without_game):,} lichess_tactics need game_id")

        tactic_lichess_ids = [
            (row.id, row.puzzle_id, _lichess_id_from_url(row.game_url))
            for row in tactics_without_game
        ]
        tactic_lichess_ids = [(tid, pid, gid) for tid, pid, gid in tactic_lichess_ids if gid]
        unique_tactic_game_ids = list({gid for _, _, gid in tactic_lichess_ids})

        if not dry_run and unique_tactic_game_ids:
            for batch_start in range(0, len(unique_tactic_game_ids), batch_size):
                batch = unique_tactic_game_ids[batch_start: batch_start + batch_size]
                game_map = _upsert_games_from_api(batch, run_id, by_name, by_eco)
                for tactic_id, puzzle_id, lichess_id in tactic_lichess_ids:
                    db_game_id = game_map.get(lichess_id)
                    if db_game_id:
                        db.session.execute(
                            sa.text("UPDATE lichess_tactics SET game_id = :gid WHERE id = :tid AND game_id IS NULL"),
                            {"gid": db_game_id, "tid": tactic_id},
                        )
                db.session.commit()
                total_tactics_linked += len(batch)
                click.echo(f"  Pass 1: batch {batch_start // batch_size + 1} done ({total_tactics_linked:,}/{len(unique_tactic_game_ids):,} game IDs processed)")
                if batch_start + batch_size < len(unique_tactic_game_ids):
                    time.sleep(1.0)
        else:
            click.echo(f"  [dry-run] Would process {len(unique_tactic_game_ids):,} unique game IDs")

        # --- Pass 2: scraped_positional_puzzles with game_id IS NULL ---
        positional_without_game = db.session.execute(
            sa.select(ScrapedPositionalPuzzle.id, ScrapedPositionalPuzzle.internal_id, ScrapedPositionalPuzzle.lichess_url)
            .where(ScrapedPositionalPuzzle.game_id.is_(None))
        ).all()
        click.echo(f"Pass 2: {len(positional_without_game):,} scraped_positional_puzzles need game_id")

        positional_lichess_ids = [
            (row.id, row.internal_id, _lichess_id_from_url(row.lichess_url))
            for row in positional_without_game
        ]
        positional_lichess_ids = [(pid, iid, gid) for pid, iid, gid in positional_lichess_ids if gid]
        unique_positional_game_ids = list({gid for _, _, gid in positional_lichess_ids})

        if not dry_run and unique_positional_game_ids:
            for batch_start in range(0, len(unique_positional_game_ids), batch_size):
                batch = unique_positional_game_ids[batch_start: batch_start + batch_size]
                game_map = _upsert_games_from_api(batch, run_id, by_name, by_eco)
                for puzzle_db_id, internal_id, lichess_id in positional_lichess_ids:
                    db_game_id = game_map.get(lichess_id)
                    if db_game_id:
                        db.session.execute(
                            sa.text("UPDATE scraped_positional_puzzles SET game_id = :gid WHERE id = :pid AND game_id IS NULL"),
                            {"gid": db_game_id, "pid": puzzle_db_id},
                        )
                db.session.commit()
                total_positional_linked += len(batch)
                click.echo(f"  Pass 2: batch {batch_start // batch_size + 1} done ({total_positional_linked:,}/{len(unique_positional_game_ids):,} game IDs processed)")
                if batch_start + batch_size < len(unique_positional_game_ids):
                    time.sleep(1.0)
        else:
            click.echo(f"  [dry-run] Would process {len(unique_positional_game_ids):,} unique game IDs")

        # --- Pass 3: games with lichess_id IS NOT NULL AND moves IS NULL ---
        games_without_moves = db.session.execute(
            sa.select(SourceGame.id, SourceGame.lichess_id)
            .where(SourceGame.lichess_id.isnot(None), SourceGame.moves.is_(None))
        ).all()
        click.echo(f"Pass 3: {len(games_without_moves):,} games need moves populated")

        games_needing_moves = {row.lichess_id: row.id for row in games_without_moves}

        if not dry_run and games_needing_moves:
            ids_list = list(games_needing_moves.keys())
            for batch_start in range(0, len(ids_list), batch_size):
                batch = ids_list[batch_start: batch_start + batch_size]
                try:
                    api_data = _fetch_games(batch)
                except requests.HTTPError as exc:
                    click.echo(f"  Warning: API error for batch at offset {batch_start}: {exc}")
                    continue
                for lichess_id in batch:
                    data = api_data.get(lichess_id)
                    if not data or not data.get("moves_uci"):
                        continue
                    db.session.execute(
                        sa.text("UPDATE games SET moves = :moves WHERE id = :gid"),
                        {"moves": data["moves_uci"], "gid": games_needing_moves[lichess_id]},
                    )
                    total_moves_populated += 1
                db.session.commit()
                click.echo(f"  Pass 3: batch {batch_start // batch_size + 1} done ({total_moves_populated:,} games updated so far)")
                if batch_start + batch_size < len(ids_list):
                    time.sleep(1.0)
        else:
            click.echo(f"  [dry-run] Would fetch moves for {len(games_needing_moves):,} games")

        # --- Finalise run ---
        if not dry_run:
            run.status = SourceImportStatus.SUCCEEDED
            run.finished_at = datetime.now(tz=timezone.utc)
            run.summary_json = {
                "tactics_linked": total_tactics_linked,
                "positional_linked": total_positional_linked,
                "moves_populated": total_moves_populated,
            }
            db.session.commit()

        click.echo(
            f"\nDone. tactics_linked={total_tactics_linked:,}  "
            f"positional_linked={total_positional_linked:,}  "
            f"moves_populated={total_moves_populated:,}"
        )
