Pinned upstream: https://github.com/Chaps-Competitive-LTD/deadchaps-reader/tree/186c042839465d901baae984ad8b7da9d992f025
Version: 1.0.13. License: PolyForm Noncommercial 1.0.0; see LICENSE.md.

Local changes: known player/rules addresses refresh every 1 second instead of 5; game-process discovery checks every 3 seconds instead of 15; project8.exe is accepted as Deadlock's older process name. Full-memory scan spacing, below-normal priority and read-only process access are retained. Slow scan mode is the default in the host app. No network hooks are supplied.

The host links the core reader and exposes only a small timer/team/match summary. Steam ActiveUser is read from the current user's Steam registry setting, with an optional account ID override. Full rosters, friends and match history are not sent to the frontend.
