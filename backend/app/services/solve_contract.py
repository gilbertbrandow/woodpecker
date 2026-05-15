from dataclasses import dataclass, field


@dataclass
class SolveContract:
    fen: str
    plies: list[str | list[str]] = field(default_factory=list)
