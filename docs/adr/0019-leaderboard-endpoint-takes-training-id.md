# Leaderboard endpoint accepts trainingId, not scheduleId

The dashboard leaderboard endpoint (`GET /api/leaderboard?trainingId=123&runIndex=2`) takes a `trainingId` even though the query fans out to all users enrolled in that training's schedule. The dashboard always has `trainingId` in context (from the URL) but not `scheduleId`. Requiring the frontend to fetch the schedule just to form the leaderboard request would add a round-trip and expose an implementation detail. The backend resolves `scheduleId` from `trainingId` internally.
