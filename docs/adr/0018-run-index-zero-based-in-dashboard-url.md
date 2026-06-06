# runIndex is 0-based in the dashboard URL

The dashboard URL encodes the selected Run as `runIndex` (e.g. `/app?trainingId=123&runIndex=0`), matching the backend's 0-based `run_index` column rather than the 1-based label shown to users. We chose consistency with the backend model over a friendlier URL because it removes an off-by-one translation layer at every API boundary and avoids bugs when the frontend passes the param directly to backend endpoints. User-facing labels ("Run 1", "Run 2") are a display concern applied at render time.
