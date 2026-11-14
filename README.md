# SpiritLocker

SpiritLocker is an unofficial Windows companion for Valve's Deadlock. Keep a tactical map, match roster, and timer reminders on a second screen while you play.

[Download the latest release](https://github.com/Zinkenite/deadlock-companion/releases/latest) · [Report a bug](https://github.com/Zinkenite/deadlock-companion/issues)

## Features

- **Tactical map:** Browse camps, shops, objectives, loot, and tunnels. Toggle layers, search for locations, and add your own markers.
- **Match roster:** With the optional Game reader enabled, see both teams, player performance, and the team soul lead or deficit.
- **Player tracking:** Select your minimap and player marker so SpiritLocker can show your position on the tactical map. Enable **Follow player on match start** in **Settings > Map & display** if you want the map to center on you automatically.
- **Bell Tower notification:** Get an alert when SpiritLocker detects the Bell Tower looting ring on your minimap. Set it up in **Screen setup > Bell Tower alert**.
- **Compass overlay:** See nearby map locations on an in-game compass. Enable and position it in **Settings > Compass overlay**.
- **Timer reminders:** Schedule custom match-clock notifications with optional sound and spoken text.

## Download and run

1. Download **SpiritLocker.exe** from the latest GitHub release. If GitHub asks you to sign in, use an account with access to the repository.
2. Run the portable executable on Windows with Microsoft Edge WebView2 installed. The executable is unsigned.
3. To upgrade, quit SpiritLocker from the system tray, replace the executable, and reopen it. Your saved settings stay on this PC.

**Settings > Desktop > App updates** checks for stable releases at launch and on demand. Automatic checks need anonymous access to the GitHub release feed. If that feed requires sign-in, check the releases page in your browser.

## First setup

The tactical map is ready when you open the app. Fresh installs come with preset minimap and match timer regions, so you can skip Screen setup if the preset matches your HUD. Screen setup stays available if you want to adjust either region.

- **Match roster:** Open **Settings > Game reader** and enable the reader.
- **Optional HUD adjustments:** Open **Screen setup**, then capture the game or load a screenshot with the same HUD layout. Draw around the whole minimap for tracking, or around just the clock digits and colon for timer reading. Under **Tracking & timer**, select your marker colour or test the timer, then choose **Save and start reading**. Use **Calibrate position** on the map if the tracked location needs alignment.
- **Reminders and compass:** Open the respective overlay pages in **Settings** to enable and preview them.

## Data and compatibility

Screen capture and OCR run locally. The optional Game reader is off by default and uses the bundled DeadChaps reader to read the running game's memory for match and roster data. Game updates can affect compatibility. Map markers are static references and do not indicate live objective availability. Preferences are stored locally, and update checks contact GitHub.

## Build from source

On Windows, install Node.js 22+, Rust with the MSVC toolchain, Visual Studio C++ Build Tools, and WebView2.

~~~sh
npm ci
npm test
npm run desktop
~~~

Build the portable executable with `npm run tauri -- build --no-bundle`. It lands in `src-tauri/target/release/SpiritLocker.exe`. Use `npm run package` to build an NSIS installer.

See [validation notes](docs/VALIDATION.md), [map data provenance](docs/map-research/RESEARCH.md), and [Game reader integration](docs/game-reader-integration.md).

## License

SpiritLocker code is licensed under the [GNU General Public License v3.0](LICENSE). Third-party code and game artwork have separate terms. See [asset credits](docs/ASSETS.json) and the [bundled reader license](vendor/deadchaps-reader/LICENSE.md). SpiritLocker is a community project and is not affiliated with Valve.
