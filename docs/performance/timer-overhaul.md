# Timer reliability and performance

The timer now runs independently from marker tracking. Normal plausible readings refresh immediately; missed OCR frames preserve the previous accepted observation. Large jumps and new match resets need confirmation. The display never invents timer values between screen observations.

Windows OCR now uses one persistent worker and engine. Empty marker-only requests do not initialize OCR. Timer preparation is a small grayscale/padded crop; angle correction, slant correction, contrast histograms and fallback passes were removed. Exact unchanged crops can reuse their recognized text for at most 3 seconds, with a fresh capture timestamp. Capture surfaces are reused on their owning threads, timer captures skip unused map signatures, and foreground process identification is cached for 500 ms while foreground window and process IDs are still checked.

## Measurements

Three-second browser samples at 1280×800, with simulated tracking updates at 15 Hz. Values are browser task time; these are not in-game FPS measurements.

| Workload | Before | After |
|---|---:|---:|
| Idle map | 95 ms | 76 ms |
| Moving map | 587 ms | 203 ms |
| Idle compass | 130 ms | 35 ms |
| Moving compass | 227 ms | 149 ms |
| Four notification cards | 4 ms | 4 ms |

Actual Windows OCR on a tight saved 150×70 timer crop: the old pipeline with a new engine per read averaged 11.301 ms; the new pipeline with a reused engine averaged 1.044 ms, excluding screen capture. Preparation alone fell from 1.547 ms to 0.040 ms. The fixture was correctly recognized as 07:09 in every measured iteration.

The largest browser cost was moving map rendering, followed by the moving compass. Clock updates now affect the clock component instead of the whole workspace. The compass caches eligible POIs and stops repainting settled frames, hidden previews sleep, and icon settings are sent only when changed. Notifications use new timer samples and expiry events instead of idle polling.

Native tracking fixture checks reported about 1.94 ms for Complex global matching and 0.53 ms for Simple detection plus map signature. Those exclude GDI capture and UI rendering.

Raw measurements are in timer-overhaul.json. Live reliability still depends on the selected HUD crop and Windows capture; a real game session was not used for these measurements.
