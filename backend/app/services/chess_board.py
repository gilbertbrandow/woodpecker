from typing import NamedTuple

import chess

from app.services.solve_contract import SolveContract


def _resolve(ply: str | list[str]) -> str:
    return ply if isinstance(ply, str) else ply[0]


class _ContractStep(NamedTuple):
    fen_before: str
    uci: str
    fen_after: str
    is_player: bool
    correct: bool  # always True for opponent steps; True/False for player steps


def _walk_contract(
    contract: SolveContract,
    player_moves: list[str],
) -> list[_ContractStep]:
    """Walk a SolveContract interleaved with player moves.

    Returns one _ContractStep per ply pushed: the opponent's first move, then
    alternating player and opponent moves. Stops at (and includes) the first
    wrong player move. Opponent steps always have correct=True.
    A checkmate move is always treated as correct regardless of the expected ply.
    """
    plies = contract.plies
    player_positions = list(range(1, len(plies), 2))
    board = chess.Board(contract.fen)
    result: list[_ContractStep] = []

    opp_uci = _resolve(plies[0])
    fen_before = board.fen()
    try:
        board.push_uci(opp_uci)
    except ValueError:
        return result
    result.append(_ContractStep(fen_before, opp_uci, board.fen(), is_player=False, correct=True))

    for i, uci in enumerate(player_moves):
        if i >= len(player_positions):
            break
        expected = plies[player_positions[i]]
        is_correct_move = uci in expected if isinstance(expected, list) else uci == expected
        fen_before = board.fen()
        try:
            board.push_uci(uci)
        except ValueError:
            break
        is_correct = is_correct_move or board.is_checkmate()
        result.append(_ContractStep(fen_before, uci, board.fen(), is_player=True, correct=is_correct))
        if not is_correct:
            break

        opp_idx = player_positions[i] + 1
        if opp_idx < len(plies) and i + 1 < len(player_moves):
            opp_uci = _resolve(plies[opp_idx])
            fen_before = board.fen()
            try:
                board.push_uci(opp_uci)
            except ValueError:
                break
            result.append(_ContractStep(fen_before, opp_uci, board.fen(), is_player=False, correct=True))

    return result


def compute_attempt_board(
    contract: SolveContract,
    status: str,
    moves: list[list[str]],
) -> dict[str, object] | None:
    if status == "in_progress":
        return None

    flat = moves[0] if moves else []
    steps = _walk_contract(contract, flat)

    if status == "solved":
        last_player = next((s for s in reversed(steps) if s.is_player), None)
        if last_player:
            return {
                "terminalFen": last_player.fen_after,
                "lastMove": [last_player.uci[:2], last_player.uci[2:4]],
                "result": "correct",
            }
        last = steps[-1] if steps else None
        return {
            "terminalFen": last.fen_after if last else None,
            "lastMove": None,
            "result": "correct",
        }

    # status == "failed"
    wrong = next((s for s in steps if s.is_player and not s.correct), None)
    if wrong is None:
        return {"terminalFen": None, "lastMove": None, "result": None}
    return {
        "terminalFen": wrong.fen_after,
        "lastMove": [wrong.uci[:2], wrong.uci[2:4]],
        "result": "wrong",
    }


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
        except (ValueError, AssertionError):
            return None

    # ── Determine the canonical player move for the mainline ──────────────────

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

    # ── Build subvariations (wrong-move entries) ──────────────────────────────

    subvariations: list[list[dict[str, object]]] = []

    for variation in moves:
        if not variation:
            continue
        steps = _walk_contract(contract, variation)
        wrong = next((s for s in steps if s.is_player and not s.correct), None)
        if wrong is None:
            continue
        wrong_board = chess.Board(wrong.fen_before)
        sv_dm = _make_display_move(wrong_board, wrong.uci, "wrong")
        if sv_dm:
            subvariations.append([sv_dm])

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
