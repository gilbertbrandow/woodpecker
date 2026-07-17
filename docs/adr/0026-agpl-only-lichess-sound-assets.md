# AGPL-only Lichess sound assets — exclude CC BY-NC-SA themes

We bundle Lichess sound files for the board sound feature. Of the ten Lichess sound themes, two are excluded: `instrument` and `other` are missing required files (`Move`, `Capture`, `Check`, `Error`, `Victory`), and `lisp` (by EdinburghCollective) is licensed CC BY-NC-SA 4.0. The NC clause prohibits commercial use; including it now would require removing it if Woodpecker ever monetises, which would silently break saved user preferences. The remaining seven themes (`standard`, `piano`, `robot`, `woodland`, `futuristic`, `nes`, `sfx`) are all AGPLv3+, compatible with Woodpecker's MIT-licensed open source codebase.

## Considered Options

- **Include `lisp`** — one more theme for users, but requires removing it if the app ever charges money
- **Exclude all non-standard themes** — simpler, but offers no meaningful theme choice; rejected because the selector is a stated product requirement
