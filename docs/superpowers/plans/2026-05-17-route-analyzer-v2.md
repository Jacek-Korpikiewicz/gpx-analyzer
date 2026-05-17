# Route Analyzer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the route analyzer as a general-purpose, responsive, single-HTML cycling route analysis tool with GPX upload, configurable climb detection, custom markers, and import/export.

**Architecture:** Single self-contained HTML file. All logic in vanilla JS. GPX parsing via native DOMParser. Leaflet for maps, Chart.js for elevation chart. State managed in a central `appState` object, persisted to localStorage on every change. Demo route (Sudovia RIDE100) embedded as a base64-encoded GPX string.

**Tech Stack:** HTML/CSS/JS, Leaflet 1.9.4, Chart.js 4.4.0, CartoDB Dark Matter tiles, localStorage API.

**Spec:** `docs/superpowers/specs/2026-05-17-route-analyzer-v2-design.md`

**Source file:** `C:/Users/PC/Downloads/sudovia-ride100/index.html`

**Demo data:** `C:/Users/PC/Downloads/sudovia-ride100/route_data.json` (embedded at build time by `build.js`)

**Build script:** `C:/Users/PC/Downloads/sudovia-ride100/build.js` — injects demo route data into index.html template

---

## File Map

| File | Purpose |
|------|---------|
| `index.html` | The complete app — CSS + HTML + JS in one file |
| `build.js` | Dev-only script: embeds demo GPX data into index.html |
| `route_data.json` | Pre-extracted Sudovia route points (used by build.js) |

The final deliverable is `index.html`. `build.js` and `route_data.json` are development aids only.

---

## Task 1: App Shell — HTML structure + CSS + responsive layout

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write the full HTML skeleton with all containers**

The file should contain:
- `<head>` with CDN links (Leaflet CSS, Leaflet JS, Chart.js), Google Fonts (Inter), and all CSS
- Landing overlay (`#landing`) with drag-and-drop zone + demo button
- Dashboard layout: `#map` + `.panel` (hidden until route loaded)
- Header with route name, settings gear, export button
- Panel sections: stats, elevation chart, climbs list, hard ascents list, markers list
- Settings drawer (`#settings`) — hidden by default
- Export modal (`#exportModal`) — hidden by default
- Toast container for notifications

CSS must handle:
- Desktop: map 60% left, panel 40% right
- Mobile (<768px): map 45vh top, panel as bottom sheet with drag handle
- Settings: slide-from-right on desktop, full-screen overlay on mobile
- Landing: centered card with drag zone
- Dark theme matching current design (--bg, --panel, --card, --border, --accent vars)

- [ ] **Step 2: Verify shell renders correctly**

Open `index.html` in browser. Should see:
- Landing overlay with upload zone and "Try Demo" button
- Dark background, proper fonts loading

- [ ] **Step 3: Commit**

```bash
cd C:/Users/PC/Downloads/sudovia-ride100
git init && git add index.html && git commit -m "feat: app shell with responsive layout and all containers"
```

---

## Task 2: Core State Management + LocalStorage

**Files:**
- Modify: `index.html` (add `<script>` section)

- [ ] **Step 1: Implement appState object and persistence**

```javascript
const appState = {
  gpxText: null,        // raw GPX string
  routeName: '',
  points: [],           // [{lat, lon, ele, dist}]
  settings: {
    climb: { minGrad: 2.5, minLength: 400, minGain: 20 },
    ascent: { minGrad: 7, minLength: 50 }
  },
  markers: [],          // [{id, type, name, km, lat, lon}]
  mapView: { center: [54.2, 23.0], zoom: 11 }
};

function saveState() { /* localStorage.setItem with try/catch for QuotaExceededError */ }
function loadState() { /* parse from localStorage, validate, return true/false */ }
function clearState() { /* remove from localStorage */ }
```

- [ ] **Step 2: Implement state restore on page load**

On DOMContentLoaded:
- Call `loadState()`
- If returns true → parse stored GPX → go to Active state
- If returns false → show Landing

- [ ] **Step 3: Verify persistence works**

Open page, set a value in console (`appState.routeName = 'test'; saveState()`), refresh, check it restores.

- [ ] **Step 4: Commit**

```bash
git add index.html && git commit -m "feat: state management with localStorage persistence"
```

---

## Task 3: GPX Parsing + Route Loading

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement GPX parser**

```javascript
function parseGPX(gpxText) {
  // DOMParser → extract trkpt lat/lon/ele
  // Return { name, points: [{lat, lon, ele}] }
  // Throw on invalid/empty GPX
}
```

- [ ] **Step 2: Implement route processing**

```javascript
function processRoute(parsed) {
  // Calculate cumulative distances (haversine)
  // Smooth elevation (window=5)
  // Store in appState.points
  // Calculate totalDist, totalGain, minEle, maxEle
  // Return stats object
}
```

- [ ] **Step 3: Implement file upload handler**

```javascript
function handleFileUpload(file) {
  // Validate extension (.gpx)
  // If file.size > 10MB: show warning toast (but continue)
  // FileReader → readAsText
  // parseGPX → processRoute
  // Route name fallback: GPX <name> tag → filename (minus .gpx) → "Untitled Route"
  // Update appState, saveState
  // Transition to Active state
  // Show error toast on failure (invalid XML, no trackpoints, etc.)
}
```

Wire up:
- Drag-and-drop on landing zone
- File input click
- Validate file extension (.gpx) and parse result

- [ ] **Step 4: Implement demo route loader**

```javascript
function loadDemo() {
  // Decode embedded demo data (from build.js injection point)
  // Same flow as upload but from embedded data
}
```

- [ ] **Step 5: Verify upload works**

Open page → drop a GPX file → should transition from Landing to Active (map/panel visible, landing hidden).

- [ ] **Step 6: Commit**

```bash
git add index.html && git commit -m "feat: GPX parsing and route loading with upload UI"
```

---

## Task 4: Map Rendering + Route Display

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement map initialization**

```javascript
function initMap() {
  // Create Leaflet map in #map
  // CartoDB Dark Matter tiles
  // Zoom control top-right
  // Restore mapView from appState if available
  // Save map center/zoom to appState on moveend
}
```

- [ ] **Step 2: Implement route rendering**

```javascript
function renderRoute() {
  // Clear existing layers
  // Draw route polyline (cyan, weight 3.5)
  // Add start/finish marker (green dot)
  // Fit bounds with padding
}
```

- [ ] **Step 3: Verify map displays route correctly**

Upload GPX → map shows route on dark tiles, auto-fits bounds.

- [ ] **Step 4: Commit**

```bash
git add index.html && git commit -m "feat: map rendering with route polyline"
```

---

## Task 5: Elevation Chart + Selection

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement elevation chart**

```javascript
function renderElevationChart() {
  // Downsample points to ~500 for chart
  // Chart.js line chart with area fill
  // X-axis: km, Y-axis: elevation
  // Hover: show marker on map
  // Custom plugin: selection highlight band
}
```

- [ ] **Step 2: Implement click-drag selection**

```javascript
// mousedown/mousemove/mouseup on canvas
// getChartIndex from pixel position via x-scale
// updateSelection: show info box, highlight on map
// Purple-shaded segments (normal/climb/ascent colors)
// Touch events: touchstart/touchmove/touchend with same logic
```

- [ ] **Step 3: Verify chart renders and selection works**

Upload GPX → elevation chart shows → drag to select range → see info box + map highlight.

- [ ] **Step 4: Commit**

```bash
git add index.html && git commit -m "feat: elevation chart with drag selection"
```

---

## Task 6: Climb + Hard Ascent Detection

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement configurable climb detection**

```javascript
function detectClimbs(points, settings) {
  // Uses settings.climb.minGrad, minLength, minGain
  // Same algorithm as current version but parameterized
  // Returns array of climb objects
}
```

- [ ] **Step 2: Implement configurable hard ascent detection**

```javascript
function detectHardAscents(points, settings) {
  // Uses settings.ascent.minGrad, minLength
  // Returns array of ascent objects
}
```

- [ ] **Step 3: Implement rendering (map + panel list)**

```javascript
function renderClimbs(climbs) {
  // Colored polyline segments on map
  // Numbered markers at climb start
  // Panel list items (clickable → zoom)
}

function renderHardAscents(ascents) {
  // Dashed red polyline segments on map
  // Panel list items (clickable → zoom)
}
```

- [ ] **Step 4: Implement full analysis pipeline**

```javascript
function runAnalysis() {
  // detectClimbs + detectHardAscents with current settings
  // Clear old layers, re-render
  // Update panel lists
}
```

- [ ] **Step 5: Verify climbs/ascents display correctly**

Upload GPX → climbs highlighted on map + listed in panel → click climb → map zooms.

- [ ] **Step 6: Commit**

```bash
git add index.html && git commit -m "feat: configurable climb and hard ascent detection"
```

---

## Task 7: Settings Panel

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement settings drawer open/close**

```javascript
function openSettings() { /* add .open class, handle mobile full-screen */ }
function closeSettings() { /* remove .open class */ }
```

- [ ] **Step 2: Implement climb detection sliders**

For each setting (minGrad, minLength, minGain for climbs; minGrad, minLength for ascents):
- Range input with live value label
- Bind to appState.settings
- On change (debounced 200ms): update state, saveState, runAnalysis

- [ ] **Step 3: Implement "Reset to defaults" + "Reset all" buttons**

```javascript
function resetSettings() {
  appState.settings = { /* defaults */ };
  updateSliderUI();
  saveState();
  runAnalysis();
}

function resetAll() {
  // Confirm dialog
  clearState();
  location.reload(); // returns to Landing
}
```

- [ ] **Step 4: Add "Import markers" button to settings panel**

In the Custom Markers section of settings, add an "Import markers" file input that triggers `importMarkers()` from Task 9. Wire it up as a placeholder that will be implemented in Task 9.
```

- [ ] **Step 5: Verify settings work**

Open settings → move slider → climbs update in real-time on map and panel. "Reset all" clears everything and returns to landing.

- [ ] **Step 6: Commit**

```bash
git add index.html && git commit -m "feat: settings panel with detection threshold sliders"
```

---

## Task 8: Custom Markers

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement marker data model**

```javascript
// Marker: { id: uuid, type: string, name: string, km: number, lat: number, lon: number }
// Types: 'feed', 'regroup', 'sprint', 'photo', 'danger', 'custom'
// Stored in appState.markers[]
```

- [ ] **Step 2: Implement "Add marker by map click" mode**

```javascript
function startMapClickMode() {
  closeSettings();
  map.getContainer().style.cursor = 'crosshair';
  map.once('click', function(e) {
    // Snap to nearest track point
    // Show type picker popup at that location
    // On type select: create marker, add to state, render, save
    // Reset cursor
  });
  // ESC cancels
}
```

- [ ] **Step 3: Implement "Add marker by km" input**

```javascript
function addMarkerByKm(km, type, name) {
  // Find interpolated point at km distance
  // Create marker object
  // Add to appState.markers, saveState, render
}
```

- [ ] **Step 4: Implement marker rendering on map + panel list**

```javascript
function renderMarkers() {
  // For each marker: Leaflet marker with type-colored icon + label
  // Panel list: type icon, name, km, edit/delete buttons
}
```

- [ ] **Step 5: Implement edit/delete**

- Delete: remove from array, re-render, save
- Edit: inline edit name/type in panel list, save

- [ ] **Step 6: Verify full marker flow**

Settings → Add marker → click map → pick type → marker appears on map + panel. Delete works. Persists on refresh.

- [ ] **Step 7: Commit**

```bash
git add index.html && git commit -m "feat: custom markers with map click and km input"
```

---

## Task 9: Import/Export

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement GPX export**

```javascript
function exportGPX() {
  // Build GPX XML string:
  // - <?xml?> header
  // - <gpx> with metadata (route name)
  // - <wpt> for each climb (name: "Climb N: length grad% +gain")
  // - <wpt> for each hard ascent (name: "Steep! length grad% +gain")
  // - <wpt> for each custom marker (name: marker.name, type in <type>)
  // - <trk><trkseg> with all track points
  // Trigger download as .gpx file
}
```

- [ ] **Step 2: Implement JSON markers export**

```javascript
function exportMarkers() {
  // JSON.stringify({ settings: appState.settings, markers: appState.markers })
  // Trigger download as .json file
}
```

- [ ] **Step 3: Implement export modal UI**

Header export button → shows modal with two buttons: "Export GPX (Wahoo-ready)" and "Export Markers (JSON)".

- [ ] **Step 4: Implement JSON markers import**

```javascript
function importMarkers(file) {
  // FileReader → JSON.parse
  // Show dialog: "Merge" or "Replace"
  // Merge: skip duplicates (same type + within 100m)
  // Replace: clear existing, load new
  // Re-render, save
}
```

- [ ] **Step 5: Verify export/import roundtrip**

Add markers → Export JSON → Clear markers → Import JSON → Markers restored.
Export GPX → Open in text editor → Valid GPX with waypoints.

- [ ] **Step 6: Commit**

```bash
git add index.html && git commit -m "feat: GPX and JSON import/export"
```

---

## Task 10: Mobile Bottom Sheet + Touch Events + Mobile Settings

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Implement draggable bottom sheet**

```javascript
// On mobile: panel becomes position:fixed bottom sheet
// Drag handle at top
// Three positions: collapsed (just header), half (45vh), full
// Touch drag to resize
// CSS transitions for smooth animation
```

- [ ] **Step 2: Implement mobile settings as full-screen overlay**

On mobile (<768px), settings panel opens as a full-screen overlay (position:fixed, inset:0, z-index above everything) with a back/close button at top-left. Not a second bottom sheet.

- [ ] **Step 3: Implement touch selection on elevation chart**

```javascript
// Map touchstart/touchmove/touchend to same logic as mouse events
// Prevent page scroll when interacting with chart (e.preventDefault on touchmove)
```

- [ ] **Step 4: Verify on mobile viewport**

DevTools → responsive mode → 375px width. Landing works, upload works, bottom sheet drags, chart selection works with touch, settings opens as full overlay.

- [ ] **Step 5: Commit**

```bash
git add index.html && git commit -m "feat: mobile bottom sheet, touch support, mobile settings overlay"
```

---

## Task 11: Build Script + Demo Data + Deploy

**Files:**
- Create: `build.js`
- Modify: `index.html` (add demo data placeholder)

- [ ] **Step 1: Add demo data injection point to index.html**

Add a placeholder comment in the JS: `const DEMO_DATA = null; // INJECT_DEMO_DATA`

- [ ] **Step 2: Write build.js**

```javascript
// Read index.html
// Read route_data.json
// Replace placeholder with: const DEMO_DATA = [actual JSON];
// Also embed original GPX as base64 for full export compatibility
// Write to index.html (overwrite)
```

- [ ] **Step 3: Run build and verify demo button works**

```bash
node build.js
```

Open index.html → Click "Try Demo" → Sudovia route loads.

- [ ] **Step 4: Push to GitHub**

```bash
cp C:/Users/PC/Downloads/sudovia-ride100/index.html C:/Users/PC/AppData/Local/Temp/sudovia-ride100/index.html
cd C:/Users/PC/AppData/Local/Temp/sudovia-ride100
git add index.html && git commit -m "feat: route analyzer v2 — responsive, upload, settings, markers"
git push
```

- [ ] **Step 5: Verify live site**

Check https://jacek-korpikiewicz.github.io/sudovia-ride100/ loads and works.

- [ ] **Step 6: Commit build.js to project repo**

```bash
cd C:/Users/PC/Downloads/sudovia-ride100
git add build.js && git commit -m "chore: add build script for demo data injection"
```

---

## Summary

| Task | What | Depends On |
|------|------|-----------|
| 1 | App shell + CSS + responsive | — |
| 2 | State management + localStorage | 1 |
| 3 | GPX parsing + upload | 2 |
| 4 | Map rendering | 3 |
| 5 | Elevation chart + selection | 4 |
| 6 | Climb/ascent detection | 5 |
| 7 | Settings panel | 6 |
| 8 | Custom markers | 7 |
| 9 | Import/export | 6, 8 |
| 10 | Mobile bottom sheet + touch | 5, 7 |
| 11 | Build script + deploy | 9, 10 |
