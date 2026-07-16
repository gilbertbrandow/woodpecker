from typing import Literal, cast

FilterOp = Literal['is', 'is_not', 'set', 'not_set']


def parse_multi_filter(values: list[str]) -> tuple[FilterOp, list[str]]:
    """Extract operator from [op?, val1, val2] list produced by the frontend filter system.

    The frontend sends [op, ...values] where op is 'is', 'is_not', 'set', or 'not_set'.
    'set'/'not_set' are single-token (no values follow). Old-format requests (no op
    prefix) are treated as op='is' for backward compat.
    """
    if not values:
        return 'is', []
    if values[0] in ('set', 'not_set'):
        return cast(FilterOp, values[0]), []
    if values[0] in ('is', 'is_not'):
        return cast(FilterOp, values[0]), values[1:]
    return 'is', values
