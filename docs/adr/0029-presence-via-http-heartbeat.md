# Presence via HTTP heartbeat ping

User Presence (whether a user is currently active in the app) is tracked by a `GET /auth/ping` endpoint that the frontend calls every 2 minutes via a `usePresencePing` hook, combined with an immediate ping on `visibilitychange` (tab becoming visible). The backend's existing `before_request` hook updates `last_seen_at` on every authenticated request (debounced to 1 minute); the Presence boolean is derived at query time as `last_seen_at > now − 5 minutes`.

We considered three alternatives: (1) **piggybacking on real API calls only** — rejected because users actively training on the board page may go minutes without triggering a backend call, causing false-offline flickers for the most active users; (2) **Server-Sent Events or WebSockets** — rejected as disproportionate infrastructure cost for a decorative presence indicator at Woodpecker's scale; (3) **Redis sorted sets** (Slack/Discord-style) — rejected because it would add a Redis dependency for no meaningful gain over Postgres at current user counts.

The 5-minute online threshold (2.5× the ping interval) tolerates one missed ping without a false-offline flicker. `last_seen_at` is never the source of truth for Presence in storage — only the timestamp is stored; the boolean is always derived fresh at query time.
