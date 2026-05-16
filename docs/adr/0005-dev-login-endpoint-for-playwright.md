# Dev session script for Playwright / AI-assisted UI inspection

During development, Claude (via the Playwright MCP) needs to access the authenticated app shell to inspect and verify UI changes. The normal Lichess OAuth flow requires a human to complete the browser redirect — Playwright runs an isolated browser with its own cookie jar, so a prior login in the developer's regular browser does not carry over.

We added `backend/scripts/dev_session.py`, a standalone script that generates a properly signed Flask session cookie for a given Lichess username. It connects to the local DB directly (via psycopg2), looks up the user, and uses Flask's `SecureCookieSessionInterface` to produce a cookie value identical in format to one the app would naturally issue. The caller injects it into the Playwright browser via `document.cookie`. A `make -C backend dev-session USERNAME=<lichess_username>` target handles env var loading from `.env`.

We chose this over two alternatives:

- **HTTP endpoint on the Flask app** — even guarded by an env var, an auth bypass living in the HTTP layer is production code by another name. A misconfigured deploy, a copy-paste env file, or a future accident could expose it. The route would exist in the running app regardless of the guard. Wrong layer entirely.
- **Cookie forging via raw itsdangerous** — requires knowing and exposing `SECRET_KEY` to external tooling; breaks silently if Flask's signing format changes between versions.

The script has no network surface, is never imported by the app factory, and never appears in a running Flask process. It is a dev tool in the same category as `make seed-dev`.
