# Compass and icon layers

Open App settings → Compass overlay to enable the HUD, choose its display and position, or unlock dragging. Lock placement (or close settings) to pass clicks through to the game. The locked overlay is visible only while Deadlock is the foreground game. Explicit placement mode remains visible outside the game so it can be moved. Use borderless/windowed mode.

Show compass directions can be disabled for icons and distances only. Height scale changes the size of icons, text and spacing uniformly while the bar width remains fixed. The compass retains its last real position, heading and timer when tracking is lost; placement samples are never retained as real readings.

Open Layers on the tactical map to expand the docked sidebar. Map and compass checkboxes are independent. Each icon-type cog controls tint, map size, compass size and base compass range. Expand an icon type (or search for a location) to override an individual placed icon. Individual locations inherit unspecified settings from their icon type. Tint can be disabled to restore original artwork. Restore icon defaults removes type customizations; Inherit icon defaults removes location overrides.

Overall range in the compass settings is a multiplier. At 100%, an icon uses its own base range. At 200%, an icon configured for 1500 u is visible up to 3000 u. Distances are straight-line map units derived from the catalog radius, not walking-route distances or meters. Icons shrink and fade relative to their effective range, fade at the compass edges, and favor nearer icons when bearings overlap. Known first-spawn times dim camp icons before their initial spawn; camp-clear state is not inferred.

Validation: focused projection, range-scaling, inheritance, uniform-scaling and migration checks; browser interaction checks for the docked sidebar, popups, location overrides, direction toggle and fixed-width height scaling; TypeScript/native compilation and release build. Preview images are isolated browser renders, not live game captures.

Native diagnostics confirmed the main and compass windows respond after startup. The locked compass was hidden while the companion was the foreground process. The final original executable also passed a fresh startup check.
