# Match performance tab

The single Match workspace combines the tactical map on the left with live ranked stats on the right. The map stays mounted when navigating Settings or Screen setup. Its layer panel stays within the map pane. A compact summary strip shows soul difference, team K/D/A and reader state. Two team columns each contain six equal-height player cards, with a full-width tag row and inline metrics. Narrow stat panes show two tags plus overflow; detailed metrics and hero identity remain available in the card tooltip when compacted. No repeated title, subtitle, or in-tab clock. Verified without scrolling or clipping at 800×600, 1000×720, 1280×720 and 1440×960. Screenshots use simulated data.

Team ranking is a relative estimate: 45% combat efficiency ((kills + 0.65 × assists) / (deaths + 1)), 40% relative net worth, 15% relative level. Ratios compare with teammates, combat/economy extremes are capped, and ties are deterministic. The rank tooltip explains the formula. This is not an official rating.

Cards display three prioritized tags plus an overflow count with tooltips. Standout tags use distinct orange, violet, teal, blue and gold treatments. Unstoppable has the strongest visual tier. A one-time sheen marks arrivals; no continuous animation loop. Reduced motion and the app animation switch are honored.

## Tag rules

- First Blood / First Death: require a complete zero-kill baseline and an unambiguous first kill and death on opposing sides. No header banner. Late joining, missing players or batched first events do not invent firsts. Priority decreases after 10 match minutes.
- On Fire: 3 observed kills without dying, or 5 kills in the last 5 minutes.
- Unstoppable: 6 observed kills without dying; replaces On Fire.
- Dominating: over 75% of observed team kills participated in over 5 minutes, requiring at least 4 team kills and 4 contributions. On Fire and Dominating were swapped as requested.
- Under Pressure: 3 deaths in 4 minutes without a subsequent kill or assist. Death Streak: 4 consecutive observed deaths without a kill.
- Playmaker: at least 4 assists, 0.6 assists per match minute, and participation in at least half of team kills.
- Soul Leader: highest lobby worth, at least 5% above average, requiring 10 observed players and 60 match seconds. Tied spawn-time totals are not labeled.
- Fast Farmer: observed net-worth gain per minute over 1–5 minutes is over 25% above lobby average, held until below +15%. Requires 60 seconds of history for every observed player, and 2 minutes elapsed. SPM itself remains total net worth divided by elapsed match minutes.
- Starved: below 75% of assigned-lane average after 2 minutes; lobby fallback if lane is unknown. Clears at 80% to reduce flicker.
- Comeback: within 5 minutes of starvation, recover to 90% of peer average with a 3–5 minute gain of at least 1,500 souls or 20% of current peer average, whichever is larger; displays for 60 match seconds.
- Power Spike: first observed side to reach level 10 or 20, shown for 45 seconds. Does not award baselines already over the threshold.
- Level Lead: 2 levels above opposing lane average, or other teammates if lane is unknown; held to +1.5 levels. Level Deficit: 2 levels below lobby average.
- Bounty Target: observed streak of at least 3 kills and worth 20% above average; an estimate rather than a read game bounty value.
- Breadwinner: over 30% of observed team worth, requiring at least 5 teammates.

## Data and performance

The local reader exports at most 12 sanitized players with an actual roster observation timestamp, rejecting data older than 3.5 seconds. The analytics engine processes each timestamp once outside React rendering. It retains at most 12 histories, 5 minutes of combat events (maximum 360 entries each) and 5-second economy samples (maximum 62 each). No extra game scans, network polling or settings writes. The hidden Match view unmounts while the bounded engine continues to observe updates.

New match IDs, local-account changes, significant clock rollback, and an ended match starting at an earlier clock reset history. Pause windows use match time. Stale/disconnected data retains the last stats and clock without generating events. Ended matches retain the last summary. Gaps over 10 seconds reset rolling windows and streaks. Partial rosters are marked; comparisons use observed players.

Portraits and names now come from https://api.deadlock-api.com/v1/assets/heroes, cross-checked with the latest extracted game dataset at https://deadlock-data-api.iainfox.dev/heroes (captured 2026-10-27). This replaces the older hand-mapped snapshot. The current capture includes 65 names and 62 portraits; all playable heroes have portraits, while three development-only entries have no usable artwork. The small WebP portraits stay local with an ID fallback for unknown heroes. Source metadata and per-image hashes are in public/heroes/catalogue-source.json; attribution is in SOURCE.txt. Refresh manually with node scripts/update-hero-assets.mjs. No runtime asset fetches. The reader does not supply party/duo IDs or ultimate tiers; these are never guessed. Lane soul comparison uses the opposing lane average, not a guessed individual.

Focused tests cover first-event ambiguity, streaks and expiry, new tag thresholds, ranking including support contributions and ties, actual farming pace, comeback, pause/stale states, resets and bounded history. A two-hour simulated stream (7,200 updates × 12 players) took approximately 320 ms total including fixture cloning. This measures the analytics path, not total app/game CPU usage. Browser checks verify card/tag bounds, portraits, pause, ranking and keyboard navigation; native tests previously verified roster bounds/freshness/serialization. Live-game behavior was not personally observed during these checks.

Split-view browser verification covers current hero IDs (including Billy, Deadman Danny, Celeste and newer heroes), all 62 image decodes, the left/right map and stat bounds, 12 cards/tag clipping at 800×600, 1000×720 and 1440×960, layer panel containment, map zoom, three-tab keyboard navigation and uniform player border widths with no asymmetric inset shadow.

## Damage analytics
Hero damage is now available on the cards and feeds the ranking and win estimate. Valid readings are finite, nonnegative and at most 5,000,000. Missing values stay unknown. With six valid team readings and nonzero damage, ranking uses 35% combat efficiency, 35% economy, 15% levels and 15% damage (relative damage capped at 2× team average). Otherwise original ranking weights apply.

The win estimate adds a modest 0.4 weight for relative cumulative team damage and 0.3 for recent damage pace, only after 2 minutes. Cumulative damage comparisons require all 12 readings; recent comparisons require a continuous 60-second history for every player. Damage tags do not add further win-momentum points, avoiding double counting. This remains a heuristic, not a calibrated prediction.

New tags: Damage Leader (highest lobby total, at least 5,000 and 25% above average), Heavy Hitter (recent DPM over 800 and 35% above lobby; clears below +20%), Damage Carry (over 30% team damage, at least 4,000 personal and 10,000 team; clears below 28%), High Impact (hero damage per 1,000 net worth over 30% above lobby, at least 5,000 damage and 3,000 net worth; clears below +15%). Require 2 minutes elapsed, and complete damage readings for the relevant team/lobby. These are comparisons, not hero-adjusted ratings; healing and utility are not measured.

Every damage tag includes current evidence in its tooltip. Recent damage history retains 5 minutes at 5-second intervals, at most 62 samples per player. Gaps, missing readings, new identities and decreasing counters discard recent damage history; late joining does not infer past bursts. Pauses use match time. Focused tests cover new tags/evidence, history loss and reset, ranking, and complete versus missing damage in the estimate.
