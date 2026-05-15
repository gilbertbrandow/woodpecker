# Session-only pending state for new-user onboarding

After Lichess OAuth completes for a new allowed user, they must choose a Display Name before a `users` row is created. Rather than persisting a "pending" record to the database, we store the Lichess username and avatar URL in the Flask session only. The onboarding endpoint reads from session, creates the user with the chosen Display Name, and replaces the session state with a `user_id`. If the session is lost before onboarding completes (e.g. server restart), the user simply re-authenticates with Lichess and starts the one-screen flow again.

We chose this over a `pending_users` table because the pending state only needs to survive a single browser interaction and the issue explicitly rules out adding inactive users to the main users table or building a partial account-status system. The cost of re-doing onboarding after a session loss is negligible.
