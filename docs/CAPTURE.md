# Local screen reading - 0.5.0

Only Player minimap and Match timer can be configured or read. Saved profiles are filtered to these fields. Native commands reject other text region requests. Timer OCR uses Windows.Media.Ocr, enhanced contrast, optional angle/slant correction and one optional retry. No network requests collect game data.

GDI captures only the foreground Deadlock window (deadlock.exe or project8.exe). Setup previews use binary RGBA transport. Full screenshots are temporary; the profile stores region coordinates, OCR settings, calibration, a 12 by 12 scene signature and the selected small marker image locally.

Whole marker mode samples an image patch up to 64 by 64 pixels. It matches weighted luminance correlation and RGB appearance at the corresponding minimap scale. A coarse grid search and pixel-level refinement report the manually selected center. Search capture dimensions are bounded to 384 by 384; up to eight candidates are returned so temporal validation can reject ambiguity. Optional rotated matching checks eight directions. A low-detail or oversized template is rejected. Single-colour tracking is retained as an explicit legacy alternative.

The native matcher supports a bounded local-search hint, but the live reader deliberately searches the whole minimap each batch so competing markers remain visible to ambiguity checks. The default is five batches per second with no overlapping requests. Timer OCR runs at most once per second by default. Reading backs off when the game is unavailable.

Setup: draw minimap/timer regions, verify, choose Whole marker appearance, draw a tight marker box with a thin border, Use this marker, adjust the enlarged center crosshair, verify in game, save. Main-map calibration is a frozen observation that can be dragged and adjusted inline; saving changes only its alignment.

Synthetic fixtures establish algorithm behavior, not guaranteed recognition of every live icon animation, overlay, HUD font or display mode. Recapture the marker when its appearance changes. Compare game frame times with reading paused/running on your own PC.
