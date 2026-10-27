# Validation - 0.5.0

Completed:

- 27 frontend tests for timer parsing/validation, read lifecycle and cancellation, map alignment, settings migration, smooth camera behavior, binary preview decoding, marker selection bounds/storage and temporal ambiguity checks.
- Native appearance tests: whole-shape center despite a bright off-center accent; custom center; two competing copies; absent/flat/invalid templates; fallback from a bad hint; template resampling and a quarter-turn rotation. Legacy marker detection, scene signature and preprocessing tests retained.
- Synthetic global-search benchmark at 384 by 384 averaged about 2.1 ms per call, excluding capture, OCR and UI. Default orientation only; optional rotation increases work.
- Marker-specific browser workflow: imported synthetic minimap, drawn template, center adjustment, threshold/persistence, selection controls at 960 by 720 and 960 by 600, followed by main-map drag calibration. Screenshot inspected. No tests were added or run for removed UI elements.
- Production frontend and native Windows portable builds.

Not verified: recognition of the user's actual in-game marker/timer, icon animations or occlusion, every display configuration, and actual game FPS/CPU/GPU impact. This release retains prior timer OCR preprocessing; rendered OCR fixtures are not proof of recognition for every game font.

Manual acceptance: select your actual marker with a thin border, set its center, compare candidates while stationary/moving, verify ambiguity rejection, calibrate on the main map, confirm stale behavior when the game loses focus, compare the timer and frame times with reading paused/running.
