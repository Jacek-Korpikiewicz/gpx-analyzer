# Route Analyzer v2 — Design Spec

## Overview
Upgrade the Sudovia RIDE100 route analyzer into a general-purpose, responsive cycling route analysis tool. Single self-contained HTML file. No build step for end users.

## Features
1. **Responsive layout** — desktop side-panel + mobile bottom-sheet
2. **GPX upload** — any user can upload their own route
3. **Settings panel** — configurable climb/ascent detection thresholds + custom marker system
4. **Import/Export** — GPX with waypoints (Wahoo-ready) + JSON markers
5. **LocalStorage persistence** — remembers route, markers, and settings

---

## Architecture

Single HTML file with embedded JS/CSS. Dependencies loaded from CDNs:
- Leaflet (map + CartoDB Dark Matter tiles)
- Chart.js (elevation profile)

### Three App States

1. **Landing** — no route loaded. Shows drag-and-drop upload area + file picker + "Try demo route" button. Demo loads the embedded Sudovia RIDE100 data.
2. **Active** — route loaded. Full dashboard with map, elevation chart, climbs, ascents, markers.
3. **Returning user** — localStorage has saved data. Skips landing, restores previous session.

---

## Layout

### Desktop (>768px)
- Map: left 60%, full height
- Panel: right 40%, scrollable, contains stats + elevation chart + climbs + ascents + markers

### Mobile (<768px)
- Map: top 45vh
- Panel: bottom draggable sheet. Swipe up for full height, swipe down to collapse to stats header only.
- Elevation chart: full-width, touch events for drag selection.

### Header
- Route name (from GPX `<name>` metadata or filename)
- Settings button (gear icon) — opens settings drawer
- Export button (download icon) — opens export options

---

## Settings Panel

Opens as a slide-over drawer from right (desktop) or bottom sheet (mobile).

### Section 1: Climb Detection
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| Min gradient | Slider | 2–5% | 2.5% |
| Min length | Slider | 100–500m | 400m |
| Min elevation gain | Slider | 10–50m | 20m |

### Section 2: Hard Ascents
| Parameter | Control | Range | Default |
|-----------|---------|-------|---------|
| Min gradient | Slider | 5–12% | 7% |
| Min length | Slider | 30–200m | 50m |

### Section 3: Custom Markers
- List of placed markers showing: type icon, name, km position
- "Add marker" button:
  - Activates map-click mode (next click on map places marker), OR
  - User enters km value manually in an input field
- Marker types (presets): Feed Zone, Regroup, Sprint, Photo, Danger, Custom (free text)
- Each marker has: edit and delete buttons
- Markers appear on map as labeled icons and in the panel list

### Behavior
- Changes to detection sliders re-run analysis in real-time (no "apply" button)
- "Reset to defaults" button at bottom of settings

---

## Import/Export

### Export (header button, two options)
1. **Export GPX** — full route track + waypoints for all climbs, hard ascents, and custom markers. Compatible with Wahoo ELEMNT devices.
2. **Export Markers Only** — JSON file containing custom markers + detection settings.

### Import (in settings panel)
- "Import markers" button
- Accepts JSON file (from Export Markers above)
- User chooses: merge with existing markers OR replace all

---

## LocalStorage Persistence

Saved automatically on every change:
- Raw GPX text of last loaded route
- Detection settings (all slider values)
- Custom markers (type, name, position)
- Map view state (center, zoom)

On page load: check localStorage. If data exists, restore and go to Active state. If not, show Landing.

No explicit save button. User can clear via "Reset all" in settings or browser cache.

---

## Existing Features (Retained)
- Dark CartoDB map tiles with cyan route line
- Climb segments highlighted on map (green/yellow/orange/red by steepness category)
- Hard ascent segments highlighted (dashed pink/red)
- Numbered climb markers at climb start
- Elevation chart with click-drag selection showing stats + purple-shaded map highlight
- Climb and ascent lists in panel (clickable to zoom map)
- Route summary stats (distance, elevation gain)

---

## Error Handling
- **Invalid/empty GPX:** Show inline error on landing ("Could not parse GPX file — ensure it contains track points"). Stay on landing state.
- **Corrupted localStorage:** If JSON parse fails or data is incomplete, clear storage and show landing. No crash.
- **LocalStorage full:** If `setItem` throws QuotaExceededError, show brief toast "Storage full — changes won't persist". App continues working in-memory.
- **Route name fallback:** GPX `<name>` → filename (minus extension) → "Untitled Route"

## Custom Markers — Detailed Flow
- "Add marker" button in settings reveals two options: "Click on map" or "Enter km"
- **Map click mode:** Settings drawer closes, cursor changes to crosshair. Next click on route (snaps to nearest track point) places marker. A type picker popup appears at the marker. ESC or clicking off-route cancels.
- **Enter km mode:** Input field + type picker inline in settings. Marker placed at the interpolated track point closest to that distance.
- **Merge on import:** Duplicates (same type + within 100m of existing) are skipped. Non-duplicates are added.

## Performance
- Detection re-runs debounced at 200ms after last slider change.
- No explicit file size limit, but files >10MB show a warning toast. Analysis proceeds regardless.

## Tech Constraints
- Single HTML file, no external files or build step
- All dependencies from CDNs (Leaflet, Chart.js)
- Client-side only, no server
- GPX parsed with native DOMParser

## Mobile Settings Panel
- On mobile, settings opens as a full-screen overlay (not a second bottom sheet), with a back/close button at top. This avoids layering two sheets.
