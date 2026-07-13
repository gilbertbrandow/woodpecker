def parse_multi_filter(values: list[str]) -> tuple[str, list[str]]:
    """Extract operator from [op?, val1, val2] list produced by the frontend filter system.

    The frontend sends [op, ...values] where op is 'is' or 'is_not'.
    Old-format requests (no op prefix) are treated as op='is' for backward compat.
    """
    if not values:
        return 'is', []
    if values[0] in ('is', 'is_not'):
        return values[0], values[1:]
    return 'is', values
