from collections.abc import Sequence
from dataclasses import dataclass, field


@dataclass
class SolveContract:
    fen: str
    plies: Sequence[str | list[str]] = field(default_factory=list)
    decoy_lines: dict[str, str] | None = None
    is_decoy: bool = False
