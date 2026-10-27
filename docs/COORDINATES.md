# Main-map calibration

Calibration now happens directly in the tactical map panel. Click Calibrate, then drag the marker to your true location. The normal map supports cursor-centred smooth zoom during calibration; use Space + drag or right drag to pan without moving the marker.

A frozen source point is used: a recent raw observation, or the marker selected from a setup snapshot. Keep the character still. Save alignment commits offsets, scale and rotation; Cancel discards them. If the observation is old, refresh the minimap snapshot first and choose Save & calibrate on main map.

The transform uses normalized minimap coordinates. It applies coarse orientation, independent horizontal/vertical scales around the centre, fine rotation and offsets. Click/drag-to-pin computes translation while preserving scale and rotation. Out-of-map results are rejected rather than clipped.

The current observation is reprojected when alignment changes, without inventing a new capture timestamp. Camera pan/zoom is separate from calibration. The marker only interpolates between received samples and freezes when tracking is lost.

Map zoom uses eased camera targets and preserves the point under the cursor. Static artwork, lanes and objective locations are cached. The camera can paint more frequently during a brief zoom transition, returning to the selected regular/performance cadence afterward.
