# Background prod DB tunnel with PID file

The production DB tunnel runs as a background SSH process (started with `make -C deploy db-tunnel-start`, stopped with `db-tunnel-stop`) rather than as a foreground blocking command. A PID file at `deploy/.db-tunnel.pid` tracks the process so `db-tunnel-stop` can kill it cleanly and unexpose the DB port on EC2.

The foreground approach (Ctrl-C to close) is more common but requires two terminals and cannot be automated. The background approach was chosen to support LLM-driven prod inspection: an agent can open the tunnel, run queries via `db-query`, and close the tunnel in a single session without interactive shell management.
