# Map integration verification — 27 October 2026

Integrated 913 static references across 24 point categories, with three optional zipline paths and 16 verified map/icon files. The pre-integration ZIP remains in `backups/`.

Completed checks:

- Source-to-app bundling: 913 unique finite in-bounds points; downloaded source asset hashes verified before copying.
- TypeScript compilation and Vite production build.
- Existing screen-reader and view checks: 10 passed. Existing readings/settings migration checks: 7 passed.
- Browser workflow: default layers; show/hide all; icon-size, layer and tunnel persistence across reload; search locating a hidden-layer feature; legacy objective preference respected; Escape closes the panel; all marker icons load without errors.
- Window sizes 1440×960, 960×720 and 960×600. Screenshots inspected for the default map and smaller layer panel; its height is constrained to the map and its contents scroll.
- Reference glyphs stay readable during zoom. Features outside the visible map are culled; unchanged frames are not repainted, and background layers are cached.

The browser check can be rerun with `node scripts/verify-map.cjs` after building the frontend, using a Playwright installation and Chromium supplied through `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` if they are not available through normal dependency lookup.

This work does not add live objective availability. Original research limitations and unconfirmed positions are retained. No live game alignment or CPU/GPU benchmark was performed in this integration step.

Desktop release result: the final Tauri release build passed. The root `Deadlock Companion.exe` was replaced and its SHA-256 matched the built executable. An isolated-profile startup check kept the app running for eight seconds without an early exit. The three previously open root-launcher copies were closed to replace the file.

Separate icon sizes: each of the five groups now has a saved size control. Existing global size migrates to all groups. Production build and browser persistence/independence checks passed.

Map tooltips use Sinner's Sacrifice and first-spawn times. Camp markers fade before their spawn time while the round timer is current; stale or missing timer readings do not fade icons. Team-colored icon boxes and availability text were removed.

Map hover now shows the first-spawn time for each camp type. Camps fade before their spawn minute when the game timer is fresh; missing or stale timer values leave them fully visible. Native objective-icon team boxes and the old availability disclaimer are removed.

