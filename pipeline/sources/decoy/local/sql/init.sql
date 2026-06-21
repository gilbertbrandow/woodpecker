-- Local staging database for the decoy position generation pipeline.

CREATE TABLE IF NOT EXISTS engine_positions (
    fen TEXT PRIMARY KEY,
    depth INTEGER NOT NULL,
    knodes BIGINT,
    pvs JSONB NOT NULL,
    best_cp INTEGER,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sampled_game_positions (
    id BIGSERIAL PRIMARY KEY,
    fen TEXT NOT NULL,
    prev_fen TEXT NOT NULL,
    opponent_move TEXT NOT NULL,
    source_game_id TEXT,
    source TEXT NOT NULL,
    move_number INTEGER NOT NULL,
    side_to_move TEXT NOT NULL,
    eco TEXT,
    opening_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sampled_game_positions_fen ON sampled_game_positions (fen);

CREATE TABLE IF NOT EXISTS decision_positions_clean (
    id BIGSERIAL PRIMARY KEY,
    fen TEXT NOT NULL UNIQUE,
    prev_fen TEXT NOT NULL,
    opponent_move TEXT NOT NULL,
    source TEXT NOT NULL,
    source_game_id TEXT,
    move_number INTEGER,
    best_cp INTEGER NOT NULL,
    accepted_moves JSONB NOT NULL,
    engine_eval JSONB NOT NULL,
    eco TEXT,
    opening_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
