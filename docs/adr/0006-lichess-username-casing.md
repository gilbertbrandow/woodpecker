# Lichess username casing: canonical in User/Waitlist, lowercase in Whitelist

Lichess usernames are stored with the canonical casing returned by the Lichess API in the `users` and `waitlist` tables, and looked up with exact-case SQL. The `whitelist` table is the exception: entries are normalised to lowercase on write, and `whitelist_service` lowercases the input before every query. This asymmetry is intentional.

We store canonical casing in `users` because that is what Lichess considers authoritative. Normalising to lowercase would require a data migration for every existing user row and would break in-flight sessions tied to stored usernames. The Whitelist is operator-managed (small, append-only, no existing rows at the time the decision was made), so normalising there is safe and removes the operator burden of matching case exactly when running `whitelist-add`.

**Consequence:** any code that resolves a Lichess username against the `users` or `waitlist` tables must use the username exactly as returned by the Lichess API — no `.lower()`, no normalisation. Only `whitelist_service` is permitted to normalise, and it does so internally. Applying `.lower()` at the `auth_service` level is the known failure mode (incident: duplicate accounts created in production for users with mixed-case Lichess usernames).
