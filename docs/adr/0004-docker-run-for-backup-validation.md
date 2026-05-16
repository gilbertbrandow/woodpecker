# docker run for local backup validation

The backup validation script (`deploy/scripts/validate-db-backup.sh`) uses a plain `docker run postgres:16` rather than a Compose service definition, departing from the Compose-first convention used elsewhere in the deploy tooling.

Validation is a one-shot operator command, not a managed service. The container has no dependencies on other services and no need for a shared network. A Compose file would imply the container belongs to a service group, require a temporary override file, and add indirection with no operational benefit. `docker run` is simpler to read, keeps the full lifecycle (create → restore → persist → clean) in one script, and makes the isolation from the normal dev DB and production unambiguous.
