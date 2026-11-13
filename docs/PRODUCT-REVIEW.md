# Product review progress — 2026-11-13

## Scope and evidence
SpiritLocker is a Windows Tauri 2 desktop application with React 19, TypeScript, Zustand persistence, native screen capture/OCR, optional game-memory reading, and separate notification/compass windows. Findings below come from source inspection and existing automated checks. They are not a complete security assessment or live-game certification.

## Strengths
- Existing tests exercise roster analytics, clock validation, notifications, orientation and screen tracking.
- Native capture processing is dispatched away from the UI thread.
- Game reader is optional and defaults off.
- Bounded roster snapshots and local screen processing limit retained data.
- Existing architecture can support incremental improvements.

## Priorities and findings
| Severity | Finding and user impact | Action and status | Risk / verification |
|---|---|---|---|
| High | README incorrectly denied game-memory access | Corrected privacy statement | Verify against native reader integration whenever it changes |
| High | Malformed saved settings can produce invalid display scaling | Basic display values and toggles now validated | Existing tests and production build pass; deeper capture validation pending |
| High | No signed update installation pipeline | Use GitHub release-page fallback; never execute downloaded assets automatically | Full upgrade test and release asset compatibility validation pending |
| Medium | Updates previously checked only on opening Desktop settings | Added a nonblocking startup check and persistent per-version postponement | Live GitHub/desktop interaction testing pending |
| Medium | Update notification can distract during a match | Startup notice waits while Game reader reports a match | Requires enabled, functioning Game reader |
| Medium | Setup README describes unavailable template controls | Rewrite remaining setup instructions before community release | Compare every instruction with the current UI |
| Medium | No GitHub Actions release pipeline | Recommended Windows CI, tests, version consistency check, NSIS artifact build and reviewed draft releases | Do not publish a stable release until clean-machine installation is verified |
| Medium | Screen setup has only partial visual validation | Check 800x600 through 2560x1440 and Windows 100/125/150% scaling | Automated tests do not prove layout or recognition quality |
| Medium | Reader depends on evolving game internals | Require live-game compatibility checks after game patches | Do not claim anti-cheat approval |
| Low | Dense component source and layered CSS complicate maintenance | Refactor only alongside behavior-focused tests | Avoid unrelated formatting churn |

## Update behavior
Production builds check GitHub Releases on startup without awaiting the result before rendering. Desktop settings provides a manual check. Development checks are disabled. Stable numeric versions are compared by component, with build metadata ignored and prereleases excluded. A ten-second timeout and status messages handle common failures. Later remembers the exact postponed tag locally. Release notes render as text.

Updates open the fixed repository release page in the browser. Portable users quit from the tray and replace the executable. Installer users must use the appropriate Windows installer. No automatic download, signature verification, installation or restart is implemented. Code signing keys have not been configured. The current checker does not validate architecture-specific release assets or expose download size.

## Release readiness
- [x] Windows portable production build path exists
- [x] Existing automated tests pass
- [x] License present (GNU General Public License v3.0 (GPLv3) code license; assets have separate ownership)
- [x] Basic release comparison tests exist
- [ ] Live GitHub response, offline and rate-limit integration tests
- [ ] Full audit of capture preference validation and malformed saved state
- [ ] Hands-on screen setup, overlays and match-end recovery
- [ ] Clean-machine installer and upgrade verification
- [ ] Dependency vulnerability and license review
- [ ] Current game compatibility verification
- [ ] Accurate complete README and contribution/issue guidance
- [ ] Release workflow with versioned, reviewed artifacts

Community stable-release readiness is not established. The remaining checks are substantive and must not be represented as complete.
