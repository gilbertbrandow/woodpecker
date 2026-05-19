from unittest.mock import MagicMock, patch

import pytest

from app.models.training_item import TrainingItemSource
from app.services.solve_contract import SolveContract
from app.services.training_item_content import (
    LichessTacticMetadata,
    _dispatch,
    _lichess_tactic_payload,
    get_content_batch,
)


def _stub_tactic(
    *,
    training_item_id: int = 1,
    moves: str = "e2e4 d7d5",
    puzzle_id: str = "abc123",
    rating: int = 1500,
    game_url: str = "https://lichess.org/game/abc",
    themes: list | None = None,
) -> MagicMock:
    t = MagicMock()
    t.training_item_id = training_item_id
    t.moves = moves
    t.puzzle_id = puzzle_id
    t.rating = rating
    t.game_url = game_url
    t.themes = themes or []
    return t


def test_lichess_payload_splits_moves_into_plies() -> None:
    tactic = _stub_tactic(moves="e2e4 d7d5 e4d5 d8d5")
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    assert isinstance(payload.contract, SolveContract)
    assert list(payload.contract.plies) == ["e2e4", "d7d5", "e4d5", "d8d5"]


def test_lichess_payload_maps_metadata_fields() -> None:
    tactic = _stub_tactic(puzzle_id="xyz99", rating=1800, game_url="https://lichess.org/g/xyz")
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    assert isinstance(payload.metadata, LichessTacticMetadata)
    assert payload.metadata.display_id == "xyz99"
    assert payload.metadata.rating == 1800
    assert payload.metadata.game_url == "https://lichess.org/g/xyz"


def test_lichess_metadata_to_api_dict_has_source_type_discriminant() -> None:
    tactic = _stub_tactic()
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    api = payload.metadata.to_api_dict()
    assert api["sourceType"] == "LICHESS_TACTIC"
    assert api["displayId"] == "abc123"
    assert api["rating"] == 1500


@pytest.mark.parametrize("source_type", [TrainingItemSource.SCRAPED_POSITIONAL, TrainingItemSource.DECOY])
def test_dispatch_raises_for_unimplemented_source_types(source_type: TrainingItemSource) -> None:
    ti = MagicMock()
    ti.source_type = source_type
    with pytest.raises(NotImplementedError):
        _dispatch(ti)


def test_get_content_batch_with_empty_list_returns_empty_dict() -> None:
    result = get_content_batch([])
    assert result == {}
