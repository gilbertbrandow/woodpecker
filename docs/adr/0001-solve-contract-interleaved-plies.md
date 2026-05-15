# SolveContract uses interleaved opponent+player plies

The SolveContract encodes all moves in a single interleaved sequence — opponent ply, player ply, opponent ply, player ply — rather than separating player steps from opponent responses. Opponent plies are always exact UCI strings; player plies are `string | string[]` (exact or set-match).

The alternative was a player-only sequence with opponent responses encoded separately (e.g. as a sibling field or nested on each step). That would have required every call site — the engine, the frontend board controller, the PGN/board computation in `chess_board.py` — to reassemble the full move sequence before advancing the board. The interleaved shape preserves the existing call-site contract exactly: index parity still determines whose move it is, and the only new logic is the set-match membership check on player plies.
