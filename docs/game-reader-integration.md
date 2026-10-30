# DeadChaps reader integration

Backup commit before integration: ad452ad.
Upstream: https://github.com/Chaps-Competitive-LTD/deadchaps-reader
Pinned commit: 186c042839465d901baae984ad8b7da9d992f025 (core 1.0.13).

## Use

Settings → Client → Game reader → Use game reader. Process reading defaults off. Once enabled, the native core runs on its own background thread with Slow discovery scans by default. It opens Deadlock for read access only; no injection, game writes, or network calls are added.

The player's Steam account is obtained from Steam's current-user ActiveProcess/ActiveUser registry setting. A numeric account ID or SteamID64 can be supplied manually if that setting is unavailable. Only the local player's identified team can trigger automatic side selection: team 2 → Hidden King, team 3 → Arch Mother. Using the side button manually disables automatic side selection.

The integration prefers a fresh observed objectives.clock value and its pause state. Clock readings older than 2.5 seconds are rejected. No local clock interpolation is used. The existing OCR reader supplies a fallback while memory data is unavailable; OCR is suspended when the reader has a fresh clock or confirms the player is outside a match. Position and direction continue to use the screen tracker.

The compass hides outside a confirmed match, and also while match discovery is unresolved when Hide compass outside a match is enabled. Placement mode remains visible. The upstream reader cannot reliably distinguish Sandbox from the hideout, and intentionally does not publish objective timers for Street Brawl; OCR remains available where a match is recognized but its clock is absent.

Match-end signals, named matches, live rules, and upstream hideout classification are combined. A reconnect must produce fresh data before stale previous-session fields can be used. Paused clocks retain their actual value with fresh read timestamps. A negative pre-match clock displays as 0:00, but reminders are suppressed until the countdown ends. New match IDs or match exits clear the timer so notifications rearm.

## Performance and limits

The initial discovery pass can scan several GB of game memory. It is not guaranteed to be cheaper than the existing OCR pipeline during discovery. Later reads reuse discovered addresses. The local cadence patch refreshes those small known-address player/rules reads once per second, while preserving the upstream throttling and full-pass spacing. Missing data and game updates that invalidate memory layouts fall back to the existing screen reader.

The native relay exposes only a compact clock, side, match-status and reader-health summary. Full player lists, friends, and history are not sent to the frontend. Upstream network callbacks are no-ops. The core may save its small ended-match cache in the app's own configuration folder.

## License and reproducibility

Vendored source is under vendor/deadchaps-reader. INTEGRATION.md there lists the three local cadence/process-name adjustments. Cargo builds the pinned core together with this app; no extra executable or runtime download is required. License terms and Required Notice are included in THIRD-PARTY-NOTICES.txt and embedded in the Game reader settings page. Upstream is licensed under PolyForm Noncommercial 1.0.0; commercial use requires separate permission from its author.

Unit checks use saved reader-shaped views to validate team mapping, paused/stale clocks, finished matches and compass gating. Live game attachment and the current game's memory layout still need in-game confirmation.

## Match roster extension
The local core patch also records players_read_unix_ms when the roster is read. The application bridge exports a bounded, sanitized roster for the Match tab and rejects stale data. See match/README.md for analytics rules and verification.
