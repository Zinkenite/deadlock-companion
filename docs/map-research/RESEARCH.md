# Deadlock map marker research

Checked: 27 October 2026. Latest tracked game evidence: client build **6821**, dated 26 October 2026. This research package contains **913 fixed reference points**, **3 lane splines**, **151 minimap assets**, and **3 map image layers**. It does not claim that every marker is currently alive or available in a match.

Open [the interactive placement preview](map-preview.html) to inspect the points and icons. It works directly from this folder without a server. It includes search, layer toggles, zoom, pan, source coordinates and the saved game icon gallery. The app itself has not been changed by this research step.

## What was backed up

The pre-research app is saved in `../../backups/Deadlock-Companion-before-map-research-2026-10-26-223801.zip`: 109 entries, including the root executable, source, assets, frontend build, lockfiles and build configuration. Rebuildable dependency folders and Rust build caches were excluded. This is a project/app backup; it does not include the separate Windows WebView user profile.

## Sources and freshness

The fresh `/v1/assets/map` response is byte-for-byte identical to `public/map-metadata.json` already used by the app. Replacing that JSON alone would therefore leave the current placement problem in place.

The API service source was pinned to commit `03e6bc15ddbbc0b7c90950472d42357afcf70b0f`; Valve file tracking was pinned to `d251cf9d9a796061c90f58724230b7e17b97121b`. Exact source URLs, revisions, snapshots and downloaded asset hashes are saved alongside this report. The public API is community maintained and the map response has no build identifier, so its geometry cannot be certified as independently re-extracted for build 6821. A final comparison in Explore NYC or against the matching installed map is needed for that stronger claim.

Primary implementation evidence:

- [API map conversion and marker anchor contract](https://github.com/deadlock-api/deadlock-api/blob/03e6bc15ddbbc0b7c90950472d42357afcf70b0f/api/src/services/assets/versions/map/mod.rs)
- [World-space objective and camp extraction](https://github.com/deadlock-api/deadlock-api/blob/03e6bc15ddbbc0b7c90950472d42357afcf70b0f/api/src/services/assets/versions/map/city_never_sleeps.rs)
- [Valve minimap icon styles](https://github.com/SteamTracking/GameTracking-Deadlock/blob/d251cf9d9a796061c90f58724230b7e17b97121b/game/citadel/pak01_dir/panorama/styles/hud_minimap.css)
- [Valve minimap panel composition](https://github.com/SteamTracking/GameTracking-Deadlock/blob/d251cf9d9a796061c90f58724230b7e17b97121b/game/citadel/pak01_dir/panorama/layout/hud_minimap.xml)
- [Tracked game build](https://github.com/SteamTracking/GameTracking-Deadlock/blob/d251cf9d9a796061c90f58724230b7e17b97121b/game/citadel/steam.inf)
- [Current map API](https://api.deadlock-api.com/v1/assets/map), [icon API](https://api.deadlock-api.com/v1/assets/icons)

## Correct placement

Use the current square `mid` map artwork with world radius `R = 10752`. For a world point `(X,Y,Z)`, its normalized image point is:

```
x = 0.5 + X / (2 * R)
y = 0.5 - Y / (2 * R)

screenX = mapLeft + x * displayedMapWidth
screenY = mapTop  + y * displayedMapHeight
```

The icon must be centered on that point. Draw it at `(screenX - iconWidth/2, screenY - iconHeight/2)`. Apply the same map pan, zoom and orientation to all points. Preserve image aspect ratio. Keep the player's capture alignment separate: moving a player calibration must not move the fixed landmarks.

Camps and `entities` already expose center-point normalized coordinates. Computing from their original world positions avoids the four-decimal rounding used by some entity fields. Preserve Z for height information; negative Z alone does not identify a particular tunnel network, and elevated camps must not automatically disappear from the street view.

**Objectives use a different API anchor.** Their `left_relative` and `top_relative` describe the top-left of a large historical HUD marker footprint. For normal objective footprints add `0.05` to both values to obtain the display center. For a core footprint add `0.15` horizontally and `0.04` vertically. Edge clamping means the core result can still differ from its original world-space point. The catalog uses the original extracted world positions instead.

`src/MapRenderer.tsx` currently draws a small diamond directly at those top-left fields. This is a confirmed offset bug. For example, `team0_tier1_3` is drawn around `(0.45, 0.5333)` while its world reference projects to `(0.5, 0.583333)`. That is roughly 51 pixels in each direction on a 1024-pixel map.

Two additional source limitations matter: API `core` points are base spawn-area centroids, not another Patron structure; and tier-1 references come from `info_super_trooper_spawn`, so they require comparison with the actual Guardian entity before being described as exact building centers. I have preserved those names and caveats in the catalog.

## Fixed references available

Counts below describe this retrieved snapshot, not simultaneously active objects.

| Group | Reference count | Artwork or treatment |
| --- | ---: | --- |
| Patrons | 2 | Native final-boss artwork; phase-specific health layers available |
| Walkers | 6 | Native tier-2 objective glyph and health artwork |
| Guardian lane references | 6 | Native tier-1 glyph; verify exact Guardian center |
| Base spawn areas | 2 | Labelled companion symbol; not a separate building |
| Small / medium / large camps | 4 / 25 / 11 | Native small / medium / large icons |
| Vault camps | 11 | Native vault icon |
| Shops | 9 | Native shop icon; source contains 6 lane, 2 secret, 1 base record |
| Teleporters | 4 | Native directional/active icons; exit targets retained |
| Bridge buff locations | 2 | Native generic spawn icon; typed power-up variants available |
| Possible urn spawns / delivery pads | 6 / 2 | Native urn and friendly/enemy delivery artwork |
| Possible unstable rift locations | 2 | Native KOTH/rift asset |
| Base sentries | 8 | Labelled companion symbols until exact matching glyph is confirmed |
| Bounce pads / climb ropes | 17 / 17 | Labelled companion symbols; pad landing targets retained |
| Steam vents / cosmic veils | 47 / 30 | Labelled companion symbols |
| Golden statues / ordinary crates / tough crates | 166 / 423 / 74 | Labelled companion symbols |
| Healing snacks / Bell Tower bells | 36 / 3 | Labelled companion symbols |
| Zipline paths | 3 paths, separate from the 913 points | Original origins and P0/P1/P2 arrays retained |

No dedicated native minimap icon was verified for the rows described as companion symbols. The preview makes that explicit instead of assigning unrelated game art. Trigger origins for movement and concealment features are points; they do not provide the full trigger area or visible prop silhouette.

## Icons and live markers

Use the downloaded game assets by their exact paths. `asset-manifest.json` records source URLs and SHA-256 hashes. `hud-icon-reference.json` maps 94 current CSS image references to their native paths; 86 have direct matches in the saved minimap collection. Two more use `_png.vtex` naming aliases (`powerup_souls` and `minimap_icon_koth`) already present as PNG exports. The remaining references are outside the minimap collection, such as a hero transformation portrait, a leech icon, skull and height arrows.

Relevant native families include:

| Family | Native exported filenames |
| --- | --- |
| Camps | `neutral_small_psd.png`, `neutral_medium_psd.png`, `neutral_large_psd.png`, `neutral_vault_psd.png`; up/down variants also available |
| Objectives | `objective_icon_t1.svg`, `objective_icon_t2.svg`; `boss_health*` rings, fills and second-phase Patron variants |
| Mid Boss / Rejuvenator | `super_neutral_marker_psd.png`, `rejuv_crystal_psd.png` |
| Shops / Broker | `minimap_shop_psd.png`, `minimap_icon_broker.svg` |
| Teleporters / stairs | `minimap_teleporter_go_right.svg`, `minimap_teleporter_highlight.svg`, `icon_stairs.svg`, `icon_stairs_mid.svg` |
| Urn | `soul_jar_marker_psd.png`, `soul_jar_marker_return_psd.png`, enemy and pulse variants |
| Power-ups / rift | `gold_crate_marker_psd.png`, `powerup_weapon.svg`, `powerup_health.svg`, `powerup_magic.svg`, `powerup_movement.svg`, `powerup_souls.png`, `minimap_icon_koth.png` |
| Players / units / pings | Self/friendly/enemy markers and arrows; NPC markers; zipline markers; hero flags; speech markers |
| Other dynamic objects | Unsecured souls, escort markers, guided arrow, summoned knight, gravestone, doorway and chess-piece artwork |

Asset presence does not prove that an icon is active in the standard map or that every legacy/ability icon is currently used. Use the current HUD CSS/XML plus actual game context for composition, faction tint, health, rotation and visibility. A live hero marker normally also needs that hero's minimap portrait. The preview intentionally does not fabricate hero or objective-health readings.

Fixed positions cannot reveal current hero/trooper positions, carried urn movement, dropped souls, summoned objects, pings, camp clearance, building destruction, or actual respawn times. Those need visible observations or manual input. Potential spawn locations must be labelled as such; a match clock alone cannot establish whether an object has been taken.

## Gaps to resolve before claiming a complete current map

- **Mid Boss:** explicitly excluded from the API camp array; exact position is not supplied. Extract the actual map entity rather than guessing `(0.5,0.5)`.
- **Shrines and base Guardians:** no separate positions in this response. Do not substitute base spawn centroids.
- **Stairs and tunnel entrances:** correct icons are available, but entrance points and connectivity are absent. Height alone cannot reconstruct tunnel topology.
- **Base shop completeness:** one base-shop record is supplied despite two teams; confirm whether a separate current map entity is missing.
- **Broker and mode objectives:** current styles include these icons; their location and applicability need matching map/mode data.
- **Guardian centers and trigger extents:** compare the source reference against actual structure origins or bounds.

The reliable way to close these gaps is to extract the matching installed `dl_midtown` map entity lump with Source 2 Viewer, preserving entity class, target name, origin, bounds and destinations. Match the game build and map/image hashes, then compare several widely separated landmarks in Explore NYC. Do not patch gaps using coordinates copied from old screenshots.

## Applying this to the app

1. Correct the objective anchors using world-space points and keep base-area references distinct from structures.
2. Add independent layers for objectives, camps, shops/events, movement and loot. Use hover details and default the dense loot layers off.
3. Load the genuine icons once and cache static map layers. Draw icons at a readable screen size while using the same world-to-map transform for every layer.
4. Provide street/mid-tunnel/rat-tunnel artwork choices; add per-feature floor membership only after topology is verified. Keep all-level viewing available.
5. Persist provenance and source/build dates. Refresh image and geometry together, validate bounds/counts/assets, and retain the last known good bundle if an update fails. Unversioned API data should be labelled with retrieval time and its verification limits.

## Verification performed

All 913 catalog IDs are unique; all positions are finite and inside the map; every supplied camp is present; every assigned icon resolves to a saved file. All 154 requested assets downloaded. The source map response matches the app's existing snapshot. The offline preview's embedded script and local references were checked. These are data and syntax checks, not a live in-game alignment verification.

Files: `marker-catalog.json`, `asset-manifest.json`, `hud-icon-reference.json`, `source-revisions.json`, `validation.json`, `sources/`, `assets/`, and `map-preview.html`. Game artwork remains Valve's property; the app's code licence does not transfer artwork rights.
