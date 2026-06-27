import chess

from app.services.solve_contract import SolveContract


def _resolve(ply: str | list[str]) -> str:
    return ply if isinstance(ply, str) else ply[0]


def compute_attempt_board(
    contract: SolveContract,
    status: str,
    moves: list[str],
) -> dict[str, object] | None:
    if status == "in_progress":
        return None

    plies = contract.plies
    board = chess.Board(contract.fen)

    if status == "solved":
        try:
            board.push_uci(_resolve(plies[0]))
            player_idx = 0
            opponent_idx = 2
            for uci in moves:
                board.push_uci(uci)
                is_last_user = player_idx + 1 >= len(moves)
                if not is_last_user and opponent_idx < len(plies):
                    board.push_uci(_resolve(plies[opponent_idx]))
                    opponent_idx += 2
                player_idx += 1
        except Exception:
            pass
        last_uci = moves[-1] if moves else None
        last_move: list[str] | None = [last_uci[:2], last_uci[2:4]] if last_uci else None
        return {
            "terminalFen": board.fen(),
            "lastMove": last_move,
            "result": "correct",
        }

    try:
        board.push_uci(_resolve(plies[0]))
        player_positions = list(range(1, len(plies), 2))
        for i, uci in enumerate(moves):
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
            if i + 1 < len(moves) and player_positions[i] + 1 < len(plies):
                board.push_uci(_resolve(plies[player_positions[i] + 1]))
    except Exception:
        pass

    return {"terminalFen": None, "lastMove": None, "result": None}


def compute_attempt_pgn(
    contract: SolveContract,
    status: str,
    moves: list[str],
) -> dict[str, object] | None:
    if status == "in_progress":
        return None

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
        except Exception:
            return None

    def _decoy_subvariations(player_uci: str | None) -> list[list[dict[str, object]]] | None:
        accepted: list[str] = plies[1]  # type: ignore[assignment]
        lines = contract.decoy_lines or {}
        result: list[list[dict[str, object]]] = []
        for acc_uci in accepted:
            if acc_uci == player_uci:
                continue
            sub_board = chess.Board(contract.fen)
            try:
                sub_board.push_uci(_resolve(plies[0]))
            except Exception:
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
                result.append(sv_moves)
        return result if result else None

    mainline: list[dict[str, object]] = []
    variation: list[dict[str, object]] | None = None
    subvariations: list[list[dict[str, object]]] | None = None

    board = chess.Board(contract.fen)
    try:
        opp_move = _make_display_move(board, _resolve(plies[0]), "opponent")
        if opp_move:
            mainline.append(opp_move)
    except Exception:
        return {"mainline": mainline, "variation": None, "subvariations": None}

    player_positions = list(range(1, len(plies), 2))

    if status == "solved":
        for i, uci in enumerate(moves):
            is_last = i == len(moves) - 1
            dm = _make_display_move(board, uci, "correct")
            if not dm:
                break
            mainline.append(dm)
            if not is_last:
                opp_idx = player_positions[i] + 1 if i < len(player_positions) else None
                if opp_idx is not None and opp_idx < len(plies):
                    opp = _make_display_move(board, _resolve(plies[opp_idx]), "opponent")
                    if opp:
                        mainline.append(opp)
        if is_decoy:
            player_uci = moves[0] if moves else None
            if player_uci and contract.decoy_lines:
                for cont_uci in contract.decoy_lines.get(player_uci, "").split()[1:]:
                    cont_dm = _make_display_move(board, cont_uci, None)
                    if not cont_dm:
                        break
                    mainline.append(cont_dm)
            subvariations = _decoy_subvariations(player_uci)
        return {"mainline": mainline, "variation": None, "subvariations": subvariations}

    for i, uci in enumerate(moves):
        if i >= len(player_positions):
            break
        expected = plies[player_positions[i]]
        is_wrong = (uci not in expected) if isinstance(expected, list) else (uci != expected)
        dm = _make_display_move(board, uci, "wrong" if is_wrong else "correct")
        if not dm:
            break
        mainline.append(dm)
        if is_wrong and not board.is_checkmate():
            if is_decoy:
                subvariations = _decoy_subvariations(uci)
            else:
                var_board = chess.Board(contract.fen)
                try:
                    var_board.push_uci(_resolve(plies[0]))
                    for j in range(i):
                        var_board.push_uci(moves[j])
                        if player_positions[j] + 1 < len(plies):
                            var_board.push_uci(_resolve(plies[player_positions[j] + 1]))
                except Exception:
                    break
                variation = []
                var_idx = player_positions[i]
                for k in range(var_idx, len(plies)):
                    vdm = _make_display_move(
                        var_board,
                        _resolve(plies[k]),
                        "correct" if k % 2 == 1 else "opponent",
                    )
                    if not vdm:
                        break
                    variation.append(vdm)
            break
        if i + 1 < len(moves) and player_positions[i] + 1 < len(plies):
            opp = _make_display_move(board, _resolve(plies[player_positions[i] + 1]), "opponent")
            if opp:
                mainline.append(opp)

    return {"mainline": mainline, "variation": variation, "subvariations": subvariations}
