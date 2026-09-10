import chess

from app.services.solve_contract import SolveContract


def _resolve(ply: str | list[str]) -> str:
    return ply if isinstance(ply, str) else ply[0]


def compute_attempt_board(
    contract: SolveContract,
    status: str,
    moves: list[list[str]],
) -> dict[str, object] | None:
    if status == "in_progress":
        return None

    # Use the first variation for the terminal board position.
    flat = moves[0] if moves else []

    plies = contract.plies
    board = chess.Board(contract.fen)

    if status == "solved":
        try:
            board.push_uci(_resolve(plies[0]))
            for player_idx, uci in enumerate(flat):
                board.push_uci(uci)
                is_last_user = player_idx + 1 >= len(flat)
                opponent_idx = player_idx * 2 + 2
                if not is_last_user and opponent_idx < len(plies):
                    board.push_uci(_resolve(plies[opponent_idx]))
        except ValueError:
            pass
        last_uci = flat[-1] if flat else None
        last_move: list[str] | None = [last_uci[:2], last_uci[2:4]] if last_uci else None
        return {
            "terminalFen": board.fen(),
            "lastMove": last_move,
            "result": "correct",
        }

    try:
        board.push_uci(_resolve(plies[0]))
        player_positions = list(range(1, len(plies), 2))
        for i, uci in enumerate(flat):
            if i >= len(player_positions):
                break
            expected = plies[player_positions[i]]
            board.push_uci(uci)
            is_correct = (
                uci in expected if isinstance(expected, list) else uci == expected
            )
            if not is_correct and not board.is_checkmate():
                last_move = [uci[:2], uci[2:4]]
                return {
                    "terminalFen": board.fen(),
                    "lastMove": last_move,
                    "result": "wrong",
                }
            if i + 1 < len(flat) and player_positions[i] + 1 < len(plies):
                board.push_uci(_resolve(plies[player_positions[i] + 1]))
    except ValueError:
        pass

    return {"terminalFen": None, "lastMove": None, "result": None}


def build_pgn(
    contract: SolveContract,
    moves: list[list[str]],
) -> dict[str, object]:
    """Build the display representation for one TrainingAttempt.

    Returns a structured dict with:
      - mainline: list of display moves (the correct solution)
      - subvariations: wrong-move entries and Decoy alternatives

    Mainline: the correct solution from the SolveContract (for Decoy: the
    accepted move the user actually solved with, falling back to plies[1][0]).
    Subvariations: one entry per failed Variation (single wrong move with ??).
    For Decoy puzzles, other accepted moves also appear as correct subvariations.

    Extensibility note: future callers may pass additional keyword arguments
    such as a game_prefix (moves before the training position) to produce a
    full-game display that embeds the training excerpt in context.
    """
    plies = contract.plies
    is_decoy = contract.is_decoy

    def _make_display_move(
        board: chess.Board,
        uci: str,
        move_status: str | None,
    ) -> dict[str, object] | None:
        is_white = board.turn == chess.WHITE
        move_number = board.fullmove_number
        try:
            move = chess.Move.from_uci(uci)
            san = board.san(move)
            board.push(move)
            return {
                "san": san,
                "uci": uci,
                "fen": board.fen(),
                "from": uci[:2],
                "to": uci[2:4],
                "moveNumber": move_number,
                "isWhite": is_white,
                "moveStatus": move_status,
            }
        except ValueError:
            return None

    # ── Determine the canonical player move for the mainline ──────────────────

    # For Decoy: find the accepted move the user played when they solved.
    solved_player_uci: str | None = None
    if is_decoy:
        accepted: list[str] = plies[1]  # type: ignore[assignment]
        for variation in moves:
            if variation:
                candidate = variation[0]
                if candidate in accepted:
                    solved_player_uci = candidate
                    break

    # ── Build the mainline ────────────────────────────────────────────────────

    mainline: list[dict[str, object]] = []
    board = chess.Board(contract.fen)

    try:
        opp_move = _make_display_move(board, _resolve(plies[0]), "opponent")
        if opp_move:
            mainline.append(opp_move)
    except ValueError:
        return {"mainline": mainline, "subvariations": None}

    if is_decoy:
        canonical_uci = solved_player_uci or _resolve(plies[1])
        player_dm = _make_display_move(board, canonical_uci, "correct")
        if player_dm:
            mainline.append(player_dm)
        # Append decoy continuation line after the accepted move.
        lines = contract.decoy_lines or {}
        for cont_uci in lines.get(canonical_uci, "").split()[1:]:
            cont_dm = _make_display_move(board, cont_uci, None)
            if not cont_dm:
                break
            mainline.append(cont_dm)
    else:
        player_positions = list(range(1, len(plies), 2))
        for i, ply in enumerate(player_positions):
            player_dm = _make_display_move(board, _resolve(plies[ply]), "correct")
            if not player_dm:
                break
            mainline.append(player_dm)
            opp_idx = ply + 1
            if opp_idx < len(plies):
                opp_dm = _make_display_move(board, _resolve(plies[opp_idx]), "opponent")
                if not opp_dm:
                    break
                mainline.append(opp_dm)

    # ── Build subvariations ───────────────────────────────────────────────────

    subvariations: list[list[dict[str, object]]] = []

    # Wrong-move subvariations (one per failed Variation).
    player_positions = list(range(1, len(plies), 2))
    for variation in moves:
        if not variation:
            continue
        # Walk through the variation to find the first wrong player move.
        var_board = chess.Board(contract.fen)
        try:
            var_board.push_uci(_resolve(plies[0]))
        except ValueError:
            continue

        for i, uci in enumerate(variation):
            if i >= len(player_positions):
                break
            expected = plies[player_positions[i]]
            is_correct = (
                uci in expected if isinstance(expected, list) else uci == expected
            )
            if not is_correct:
                # This is the wrong move — emit it as a ?? subvariation.
                sv_dm = _make_display_move(var_board, uci, "wrong")
                if sv_dm:
                    subvariations.append([sv_dm])
                break
            # Correct so far — advance the board and continue.
            try:
                var_board.push_uci(uci)
            except ValueError:
                break
            opp_idx = player_positions[i] + 1
            if opp_idx < len(plies) and i + 1 < len(variation):
                try:
                    var_board.push_uci(_resolve(plies[opp_idx]))
                except ValueError:
                    break

    # For Decoy: append other accepted moves as correct subvariations.
    if is_decoy:
        accepted = plies[1]  # type: ignore[assignment]
        lines = contract.decoy_lines or {}
        mainline_uci = solved_player_uci or _resolve(plies[1])
        for acc_uci in accepted:
            if acc_uci == mainline_uci:
                continue
            sub_board = chess.Board(contract.fen)
            try:
                sub_board.push_uci(_resolve(plies[0]))
            except ValueError:
                continue
            line_str = lines.get(acc_uci)
            line_ucis = line_str.split() if line_str else [acc_uci]
            sv_moves: list[dict[str, object]] = []
            for idx, line_uci in enumerate(line_ucis):
                dm = _make_display_move(sub_board, line_uci, "correct" if idx == 0 else None)
                if not dm:
                    break
                sv_moves.append(dm)
            if sv_moves:
                subvariations.append(sv_moves)

    return {
        "mainline": mainline,
        "subvariations": subvariations if subvariations else None,
    }
