# Min requires max in Target Solve Window

The min bound of a Target Solve Window is only valid when a max is also set; they cannot be set independently. This was chosen over making both bounds independently nullable because a min without a max ("solve at least this slowly, with no ceiling") maps to no real training goal — it would be a floor with no context. The max is the primary target (it was the only bound before this feature); the min is an optional floor that only makes sense within a named range.

Concretely: if max is null, min must also be null. Setting a max first is the only way to unlock the min.
