# SpiritLocker 0.5.0

Windows companion using local screen reading for the minimap and match timer only. Quit the old companion from its tray before starting the new portable executable. Saved timer regions and alignment are retained; other HUD regions are discarded.

## Changes

- Map and clock workspace. Removed compact view, slogans, extra reading panels, souls, health, hero/team and match metadata collection.
- Whole marker appearance selection with zoom/pan/resize handles, adjustable center, match threshold and optional eight-direction matching. Legacy single-colour tracking remains available for existing profiles.
- Small image template (at most 64 by 64 pixels), bounded minimap search (at most 384 by 384 pixels), default 5 Hz. No overlapping read requests.
- Existing timer contrast, angle/slant correction, one bounded retry and local Windows OCR are retained. The clock never advances between observations.
- Main-map drag calibration and smooth cursor-anchored zoom remain.

## Setup

1. Open Screen setup. Capture the game after the three-second delay or load a screenshot with the same HUD layout. Select Player minimap and Match timer, drawing each region. Wheel zooms, Space + drag pans, and the gold handles refine the box.
2. In Verify text & marker, select Whole marker appearance. Draw a tight box around your whole player icon, including a thin border; click Use this marker. The selection must be at least four source pixels across and no more than one fifth of the minimap in either direction.
3. Click the enlarged preview to adjust the center crosshair. The tracker reports this point within the matched icon, rather than the centroid of one bright colour. Enable rotated matching only if your icon rotates; it checks eight directions and costs more work. Moving/animated shapes or substantial HUD scale changes may require selecting a new template.
4. Read HUD in 3 seconds verifies the candidates with Deadlock focused. Ambiguous markers, missing matches, large jumps and changed minimap scenes are rejected; tracking needs three consistent observations.
5. Select Match timer to tune its OCR and inspect the processed input. Save and start reading. Use Save & calibrate on main map or Calibrate position to drag your frozen observation to its actual map location. Save alignment commits the change.

Use Reset readings between matches to reset clock validation. Stale readings are marked. Captures are local and temporary; the selected small marker image, regions and alignment are saved on this PC. The optional Game reader uses the bundled DeadChaps reader to read the running game process for match state and roster statistics. It is disabled by default. Screen capture and OCR are local. Game reader compatibility after game updates requires verification. Deadlock must be foreground for capture.

## Performance and validation

Synthetic full-map appearance searches averaged about 2.1 ms at 384 by 384 on this host, excluding capture, timer OCR and rendering. This is not a measurement of in-game frame-time impact. Default matching uses one orientation; optional rotation checks eight.

See docs/VALIDATION.md for tested coverage and limits. Verify recognition with your actual in-game marker and timer.

## Build

Node.js 22+, Rust MSVC, Microsoft C++ desktop tools and WebView2 are required. Run npm ci, npm test, npm run build and npm run desktop. Portable native build: npm run tauri -- build --no-bundle. Native tests: cargo test --release in src-tauri.

The executable is unsigned. Map/icon artwork belongs to Valve; see docs/ASSETS.json. Objective locations are static references. The GNU General Public License v3.0 (GPLv3) code license does not grant artwork rights.

## Integrated map references

Use **Layers** in the top-right of the map to choose objectives, camps, shops/events, movement or loot. Dense loot layers start hidden. Layer choices, tunnel artwork and icon size are saved. Search for a location in Layers to center the map on it; hover over a marker for details and teleporter/bounce-pad destinations.

The map uses the 913 researched static references and the genuine game icons where available. Objectives now use center positions derived from the source world coordinates. Possible urn/rift spawns are reference locations, and availability is not tracked. Features without a verified native glyph use companion symbols. Exact Mid Boss, shrine and stair positions remain pending. Player screen tracking and calibration are separate from these fixed references.

The included source bundle is documented in `docs/map-research/RESEARCH.md`; copied app assets and hashes are recorded in `public/map-assets/manifest.json`. To regenerate the app bundle from the checked research package, run `node scripts/sync-map-assets.mjs`. See `docs/map-integration/VALIDATION.md` for checks on this integration.
