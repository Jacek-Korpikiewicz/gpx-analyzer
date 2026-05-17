const fs = require('fs');
const routeData = fs.readFileSync('C:/Users/PC/Downloads/route_data.json', 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sudovia 2026 RIDE100 — Route Analyzer</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0f1117;
    --panel: #161921;
    --card: #1c1f2b;
    --border: #2a2d3a;
    --text: #e1e4ed;
    --text-dim: #8b8fa3;
    --accent: #00d4ff;
    --accent-dim: rgba(0,212,255,0.15);
    --green: #4ade80;
    --yellow: #facc15;
    --orange: #fb923c;
    --red: #f87171;
  }
  body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); height: 100vh; overflow: hidden; display: flex; flex-direction: column; }

  header {
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }
  header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
  header h1 span { color: var(--accent); }
  header .badge {
    background: var(--accent-dim);
    color: var(--accent);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .dashboard { display: flex; flex: 1; overflow: hidden; }
  #map { flex: 3; min-width: 0; }

  .panel {
    flex: 2;
    max-width: 480px;
    min-width: 360px;
    background: var(--panel);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text-dim);
    margin-bottom: 10px;
  }

  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .stat-card .value { font-size: 24px; font-weight: 700; letter-spacing: -1px; color: var(--accent); }
  .stat-card .label { font-size: 11px; color: var(--text-dim); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

  .elevation-container {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  #elevationChart { width: 100%; height: 160px; }

  .climbs-list { display: flex; flex-direction: column; gap: 6px; }
  .climb-item {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .climb-item:hover { border-color: var(--accent); background: rgba(0,212,255,0.05); }
  .climb-number {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; flex-shrink: 0; color: #000;
  }
  .climb-details { flex: 1; min-width: 0; }
  .climb-details .climb-stats { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
  .climb-details .climb-name { font-size: 13px; font-weight: 600; }
  .climb-category {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;
  }
  .cat-easy { background: rgba(52,211,153,0.15); color: #34d399; }
  .cat-moderate { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .cat-hard { background: rgba(249,115,22,0.15); color: #f97316; }
  .cat-steep { background: rgba(239,68,68,0.15); color: #ef4444; }


  .hover-marker { z-index: 1000 !important; }

  .panel::-webkit-scrollbar { width: 6px; }
  .panel::-webkit-scrollbar-track { background: transparent; }
  .panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .leaflet-control-attribution { font-size: 9px !important; }

  .elevation-container { position: relative; }
  .selection-info {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(22,25,33,0.95);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
    pointer-events: none;
    z-index: 10;
    display: none;
  }
  .selection-info .sel-value { color: #f0abfc; font-weight: 600; }
  .selection-hint {
    text-align: center;
    font-size: 10px;
    color: var(--text-dim);
    margin-top: 6px;
    opacity: 0.7;
  }
</style>
</head>
<body>
<header>
  <h1>Sudovia 2026 <span>RIDE100</span></h1>
  <div class="badge">102 KM</div>
  <div class="badge">1 508 M GAIN</div>
</header>
<div class="dashboard">
  <div id="map"></div>
  <div class="panel" id="panel">
    <div>
      <div class="section-title">Route Summary</div>
      <div class="stats-grid" id="statsGrid"></div>
    </div>
    <div>
      <div class="section-title">Elevation Profile</div>
      <div class="elevation-container">
        <canvas id="elevationChart"></canvas>
        <div class="selection-info" id="selectionInfo"></div>
      </div>
      <div class="selection-hint">Click &amp; drag on chart to select a range. Click to clear.</div>
    </div>
    <div>
      <div class="section-title">Climbs</div>
      <div class="climbs-list" id="climbsList"></div>
    </div>
    <div>
      <div class="section-title">Hard Ascents (7%+)</div>
      <div class="climbs-list" id="hardAscentsList"></div>
    </div>
  </div>
</div>

<script>
const raw = ${routeData};
const R_EARTH = 6371000;

function haversine(a, b) {
  const dLat = (b[0]-a[0])*Math.PI/180, dLon = (b[1]-a[1])*Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2;
  return R_EARTH * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// Build cumulative distance + smoothed elevation
const points = [];
let cumDist = 0;
for (let i = 0; i < raw.length; i++) {
  if (i > 0) cumDist += haversine(raw[i-1], raw[i]);
  points.push({ lat: raw[i][0], lon: raw[i][1], ele: raw[i][2], dist: cumDist });
}

const W = 5;
const smoothed = points.map((p, i) => {
  let sum = 0, count = 0;
  for (let j = Math.max(0, i-W); j <= Math.min(points.length-1, i+W); j++) { sum += points[j].ele; count++; }
  return { ...p, ele: sum / count };
});

const totalDist = smoothed[smoothed.length-1].dist;
const elevations = smoothed.map(p => p.ele);
const minEle = Math.min(...elevations);
const maxEle = Math.max(...elevations);
let totalGain = 0, totalLoss = 0;
for (let i = 1; i < smoothed.length; i++) {
  const d = smoothed[i].ele - smoothed[i-1].ele;
  if (d > 0) totalGain += d; else totalLoss += Math.abs(d);
}

// ── Climb Detection ──
// Uses rolling 200m windows to measure gradient, tolerates flat/gentle
// sections up to 300m within a climb. This catches long rolling climbs
// where the overall average dips below 3% due to brief flat patches.
function detectClimbs() {
  // Pre-compute rolling gradient over 200m windows
  function gradOver(startIdx, meters) {
    let endIdx = startIdx;
    while (endIdx < smoothed.length - 1 && (smoothed[endIdx].dist - smoothed[startIdx].dist) < meters) endIdx++;
    const d = smoothed[endIdx].dist - smoothed[startIdx].dist;
    if (d < 10) return 0;
    return ((smoothed[endIdx].ele - smoothed[startIdx].ele) / d) * 100;
  }

  const climbs = [];
  let i = 0;
  while (i < smoothed.length - 1) {
    // Find climb start: look for 200m window with >= 2.5% grade, or any point-to-point >= 3%
    let climbStart = -1;
    for (let j = i; j < smoothed.length - 1; j++) {
      const g200 = gradOver(j, 200);
      if (g200 >= 2.5) { climbStart = j; break; }
      // Also check short steep: 100m window >= 6%
      const g100 = gradOver(j, 100);
      if (g100 >= 6) { climbStart = j; break; }
    }
    if (climbStart === -1) break;

    // Extend climb: allow flat/gentle sections up to 300m before ending
    let climbEnd = climbStart + 1;
    let flatRun = 0;
    let highestEle = smoothed[climbStart].ele;
    let highestIdx = climbStart;
    for (let k = climbStart + 1; k < smoothed.length - 1; k++) {
      const segDist = smoothed[k+1].dist - smoothed[k].dist;
      if (segDist < 0.5) continue;
      const grad = ((smoothed[k+1].ele - smoothed[k].ele) / segDist) * 100;

      if (smoothed[k].ele > highestEle) {
        highestEle = smoothed[k].ele;
        highestIdx = k;
      }

      if (grad < 0.5) {
        flatRun += segDist;
        if (flatRun > 300) break;
      } else {
        flatRun = 0;
        climbEnd = k + 1;
      }
    }

    // Use highest point as the true climb end
    if (highestIdx > climbStart) climbEnd = highestIdx;

    const climbDist = smoothed[climbEnd].dist - smoothed[climbStart].dist;
    const eleGain = smoothed[climbEnd].ele - smoothed[climbStart].ele;
    if (eleGain <= 2) { i = climbEnd + 1; continue; }

    const avgGrad = (eleGain / climbDist) * 100;
    const qualifies = (climbDist >= 500 && eleGain >= 25) ||
                      (avgGrad >= 2.5 && climbDist >= 400 && eleGain >= 20) ||
                      (avgGrad >= 3 && climbDist >= 200) ||
                      (avgGrad >= 6 && climbDist >= 100);

    if (qualifies) {
      let maxGrad = 0;
      for (let k = climbStart; k < climbEnd; k++) {
        let ahead = k;
        while (ahead < climbEnd && (smoothed[ahead].dist - smoothed[k].dist) < 50) ahead++;
        if (ahead <= k) continue;
        const g = ((smoothed[ahead].ele - smoothed[k].ele) / (smoothed[ahead].dist - smoothed[k].dist)) * 100;
        if (g > maxGrad) maxGrad = g;
      }

      let category, catClass;
      if (avgGrad >= 10) { category = 'Steep'; catClass = 'cat-steep'; }
      else if (avgGrad >= 7) { category = 'Hard'; catClass = 'cat-hard'; }
      else if (avgGrad >= 5) { category = 'Moderate'; catClass = 'cat-moderate'; }
      else { category = 'Easy'; catClass = 'cat-easy'; }

      climbs.push({
        start: climbStart, end: climbEnd,
        distFromStart: smoothed[climbStart].dist,
        length: climbDist, gain: eleGain,
        avgGrad, maxGrad, category, catClass,
        lat: smoothed[climbStart].lat, lon: smoothed[climbStart].lon
      });
    }
    i = climbEnd + 1;
  }
  return climbs;
}

const climbs = detectClimbs();

// ── Hard Ascents (7%+ over 100m) ──
function detectHardAscents() {
  const ascents = [];
  let i = 0;
  while (i < smoothed.length - 1) {
    // Find start of 7%+ section
    let start = -1;
    for (let j = i; j < smoothed.length - 1; j++) {
      const segDist = smoothed[j+1].dist - smoothed[j].dist;
      if (segDist < 0.5) continue;
      const grad = ((smoothed[j+1].ele - smoothed[j].ele) / segDist) * 100;
      if (grad >= 7) { start = j; break; }
    }
    if (start === -1) break;

    // Extend while gradient stays >= 5% (allow brief dips within steep section)
    let end = start + 1;
    let flatRun = 0;
    for (let k = start + 1; k < smoothed.length - 1; k++) {
      const segDist = smoothed[k+1].dist - smoothed[k].dist;
      if (segDist < 0.5) continue;
      const grad = ((smoothed[k+1].ele - smoothed[k].ele) / segDist) * 100;
      if (grad < 5) {
        flatRun += segDist;
        if (flatRun > 50) break;
      } else {
        flatRun = 0;
        end = k + 1;
      }
    }

    const dist = smoothed[end].dist - smoothed[start].dist;
    const gain = smoothed[end].ele - smoothed[start].ele;
    if (dist >= 50 && gain > 0) {
      const avgGrad = (gain / dist) * 100;
      if (avgGrad >= 7) {
        let maxGrad = 0;
        for (let k = start; k < end; k++) {
          let ahead = k;
          while (ahead < end && (smoothed[ahead].dist - smoothed[k].dist) < 30) ahead++;
          if (ahead <= k) continue;
          const g = ((smoothed[ahead].ele - smoothed[k].ele) / (smoothed[ahead].dist - smoothed[k].dist)) * 100;
          if (g > maxGrad) maxGrad = g;
        }
        ascents.push({
          start, end,
          distFromStart: smoothed[start].dist,
          length: dist, gain, avgGrad, maxGrad,
          lat: smoothed[start].lat, lon: smoothed[start].lon
        });
      }
    }
    i = end + 1;
  }
  return ascents;
}

const hardAscents = detectHardAscents();

// ── Map ──
const map = L.map('map', { zoomControl: false }).setView([54.15, 23.05], 11);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const routeCoords = smoothed.map(p => [p.lat, p.lon]);
const routeLine = L.polyline(routeCoords, { color: '#00d4ff', weight: 3.5, opacity: 0.85 }).addTo(map);
map.fitBounds(routeLine.getBounds().pad(0.05));

// Start/finish
const startIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#4ade80;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(74,222,128,0.6)"></div>',
  iconSize: [16,16], iconAnchor: [8,8]
});
L.marker([smoothed[0].lat, smoothed[0].lon], { icon: startIcon }).addTo(map).bindPopup('<b>Start / Finish</b>');

// Climb markers + highlighted segments
const catColors = { 'cat-easy': '#34d399', 'cat-moderate': '#fbbf24', 'cat-hard': '#f97316', 'cat-steep': '#ef4444' };
const climbMarkers = [];
const climbLines = [];
climbs.forEach((c, idx) => {
  const col = catColors[c.catClass];

  // Draw colored polyline over the climb segment
  const climbCoords = [];
  for (let k = c.start; k <= c.end; k++) {
    climbCoords.push([smoothed[k].lat, smoothed[k].lon]);
  }
  const climbLine = L.polyline(climbCoords, { color: col, weight: 5, opacity: 0.95 }).addTo(map);
  climbLine.bindPopup('<b>Climb '+(idx+1)+'</b><br>'+c.length.toFixed(0)+'m at '+c.avgGrad.toFixed(1)+'%<br>+'+c.gain.toFixed(0)+'m — '+c.category);
  climbLines.push(climbLine);

  // Numbered marker at climb start
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:26px;height:26px;background:'+col+';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;box-shadow:0 0 8px '+col+'80;border:2px solid rgba(255,255,255,0.3)">'+(idx+1)+'</div>',
    iconSize: [26,26], iconAnchor: [13,13]
  });
  const marker = L.marker([c.lat, c.lon], { icon }).addTo(map);
  marker.bindPopup('<b>Climb '+(idx+1)+'</b><br>'+c.length.toFixed(0)+'m at '+c.avgGrad.toFixed(1)+'%<br>+'+c.gain.toFixed(0)+'m — '+c.category);
  climbMarkers.push(marker);
});

// Hard ascent segments on map
const hardAscentLines = [];
hardAscents.forEach(function(a, idx) {
  const coords = [];
  for (let k = a.start; k <= a.end; k++) {
    coords.push([smoothed[k].lat, smoothed[k].lon]);
  }
  const line = L.polyline(coords, { color: '#ff3366', weight: 6, opacity: 0.95, dashArray: '8 4' }).addTo(map);
  line.bindPopup('<b>Hard Ascent</b><br>'+a.length.toFixed(0)+'m at '+a.avgGrad.toFixed(1)+'%<br>+'+a.gain.toFixed(0)+'m (max '+a.maxGrad.toFixed(1)+'%)');
  hardAscentLines.push(line);
});

// Hover marker
const hoverIcon = L.divIcon({
  className: 'hover-marker',
  html: '<div style="width:10px;height:10px;background:#fff;border:2px solid #00d4ff;border-radius:50%;box-shadow:0 0 10px rgba(0,212,255,0.8)"></div>',
  iconSize: [10,10], iconAnchor: [5,5]
});
const hoverMarker = L.marker([0,0], { icon: hoverIcon, interactive: false }).addTo(map);
hoverMarker.setOpacity(0);

// ── Stats ──
document.getElementById('statsGrid').innerHTML =
  '<div class="stat-card"><div class="value">'+(totalDist/1000).toFixed(1)+'</div><div class="label">Distance (km)</div></div>' +
  '<div class="stat-card"><div class="value">'+Math.round(totalGain).toLocaleString()+'</div><div class="label">Elevation Gain (m)</div></div>';

// ── Elevation Chart with Selection ──
const step = Math.max(1, Math.floor(smoothed.length / 500));
const chartPoints = smoothed.filter((_, i) => i % step === 0 || i === smoothed.length - 1);

// Selection state
let selStartIdx = null;
let selEndIdx = null;
let isDragging = false;
let selectionLine = null;
const selInfoEl = document.getElementById('selectionInfo');

// Chart.js plugin for drawing selection highlight
const selectionPlugin = {
  id: 'selectionHighlight',
  beforeDraw: function(chart) {
    if (selStartIdx === null || selEndIdx === null) return;
    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const lo = Math.min(selStartIdx, selEndIdx);
    const hi = Math.max(selStartIdx, selEndIdx);
    const xLeft = xScale.getPixelForValue(lo);
    const xRight = xScale.getPixelForValue(hi);
    // Draw selection band
    ctx.save();
    ctx.fillStyle = 'rgba(240,171,252,0.12)';
    ctx.fillRect(xLeft, yScale.top, xRight - xLeft, yScale.bottom - yScale.top);
    // Draw selection borders
    ctx.strokeStyle = 'rgba(240,171,252,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xLeft, yScale.top);
    ctx.lineTo(xLeft, yScale.bottom);
    ctx.moveTo(xRight, yScale.top);
    ctx.lineTo(xRight, yScale.bottom);
    ctx.stroke();
    ctx.restore();
  }
};

const ctx = document.getElementById('elevationChart').getContext('2d');
const elevChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: chartPoints.map(p => (p.dist/1000).toFixed(1)),
    datasets: [{
      data: chartPoints.map(p => p.ele),
      fill: true,
      backgroundColor: 'rgba(0,212,255,0.08)',
      borderColor: '#00d4ff',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHitRadius: 8,
      tension: 0.3
    }]
  },
  plugins: [selectionPlugin],
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1f2b',
        borderColor: '#2a2d3a',
        borderWidth: 1,
        titleColor: '#8b8fa3',
        bodyColor: '#e1e4ed',
        titleFont: { size: 10 },
        bodyFont: { size: 12, weight: 'bold' },
        padding: 8,
        displayColors: false,
        callbacks: {
          title: function(items) { return 'km ' + items[0].label; },
          label: function(item) { return Math.round(item.raw) + ' m'; }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#8b8fa3', font: { size: 9 }, maxTicksLimit: 8, callback: function(v,i) { return chartPoints[i] ? Math.round(chartPoints[i].dist/1000) : ''; } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#8b8fa3', font: { size: 9 }, maxTicksLimit: 5 },
        min: Math.floor(minEle / 10) * 10 - 10
      }
    },
    onHover: function(event, elements) {
      if (isDragging) return;
      if (elements.length > 0) {
        const idx = elements[0].index;
        const p = chartPoints[idx];
        hoverMarker.setLatLng([p.lat, p.lon]);
        hoverMarker.setOpacity(1);
      } else {
        hoverMarker.setOpacity(0);
      }
    }
  }
});

// Helper: get chart data index from mouse event
function getChartIndex(event) {
  var rect = canvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var xScale = elevChart.scales.x;
  if (!xScale) return null;
  var idx = Math.round(xScale.getValueForPixel(x));
  if (idx < 0) idx = 0;
  if (idx >= chartPoints.length) idx = chartPoints.length - 1;
  // Check if within chart area
  if (x < xScale.left || x > xScale.right) return null;
  return idx;
}

// Helper: find nearest smoothed index for a chartPoints index
function chartToSmoothedRange(lo, hi) {
  const startDist = chartPoints[lo].dist;
  const endDist = chartPoints[hi].dist;
  let sIdx = 0, eIdx = smoothed.length - 1;
  for (let k = 0; k < smoothed.length; k++) {
    if (smoothed[k].dist >= startDist) { sIdx = k; break; }
  }
  for (let k = sIdx; k < smoothed.length; k++) {
    if (smoothed[k].dist >= endDist) { eIdx = k; break; }
  }
  return { sIdx, eIdx };
}

function updateSelection() {
  if (selStartIdx === null || selEndIdx === null) {
    selInfoEl.style.display = 'none';
    if (selectionLine) { selectionLine.forEach(function(l) { map.removeLayer(l); }); selectionLine = null; }
    elevChart.update('none');
    return;
  }
  const lo = Math.min(selStartIdx, selEndIdx);
  const hi = Math.max(selStartIdx, selEndIdx);
  if (lo === hi) {
    selInfoEl.style.display = 'none';
    if (selectionLine) { selectionLine.forEach(function(l) { map.removeLayer(l); }); selectionLine = null; }
    elevChart.update('none');
    return;
  }

  const pStart = chartPoints[lo];
  const pEnd = chartPoints[hi];
  const dist = (pEnd.dist - pStart.dist) / 1000;

  // Calculate gain/loss over the selection
  var range = chartToSmoothedRange(lo, hi);
  let gain = 0, loss = 0;
  for (let k = range.sIdx + 1; k <= range.eIdx; k++) {
    const d = smoothed[k].ele - smoothed[k-1].ele;
    if (d > 0) gain += d; else loss += Math.abs(d);
  }
  const avgGrad = dist > 0 ? ((pEnd.ele - pStart.ele) / (dist * 1000)) * 100 : 0;

  selInfoEl.style.display = 'block';
  selInfoEl.innerHTML =
    '<span class="sel-value">' + (pStart.dist/1000).toFixed(1) + ' → ' + (pEnd.dist/1000).toFixed(1) + ' km</span><br>' +
    'Dist: <span class="sel-value">' + dist.toFixed(1) + ' km</span><br>' +
    'Gain: <span class="sel-value">+' + Math.round(gain) + 'm</span> Loss: <span class="sel-value">-' + Math.round(loss) + 'm</span><br>' +
    'Avg: <span class="sel-value">' + avgGrad.toFixed(1) + '%</span>';

  // Highlight on map — split into segments colored by type
  if (selectionLine) {
    selectionLine.forEach(function(l) { map.removeLayer(l); });
  }
  selectionLine = [];

  // Build a type map for each smoothed point in range
  function pointType(k) {
    for (var a = 0; a < hardAscents.length; a++) {
      if (k >= hardAscents[a].start && k <= hardAscents[a].end) return 'ascent';
    }
    for (var c = 0; c < climbs.length; c++) {
      if (k >= climbs[c].start && k <= climbs[c].end) return 'climb';
    }
    return 'normal';
  }

  var selColors = { normal: '#e879f9', climb: '#a855f7', ascent: '#7c3aed' };
  var segType = pointType(range.sIdx);
  var segStart = range.sIdx;

  function flushSegment(fromK, toK, type) {
    var segCoords = [];
    for (var m = fromK; m <= toK; m++) {
      segCoords.push([smoothed[m].lat, smoothed[m].lon]);
    }
    if (segCoords.length >= 2) {
      var line = L.polyline(segCoords, { color: selColors[type], weight: 7, opacity: 0.85 }).addTo(map);
      selectionLine.push(line);
    }
  }

  for (var k = range.sIdx + 1; k <= range.eIdx; k++) {
    var t = pointType(k);
    if (t !== segType) {
      flushSegment(segStart, k, segType);
      segType = t;
      segStart = k;
    }
  }
  flushSegment(segStart, range.eIdx, segType);

  elevChart.update('none');
}

// Mouse events on canvas
const canvas = elevChart.canvas;
canvas.addEventListener('mousedown', function(e) {
  const idx = getChartIndex(e);
  if (idx === null) return;
  // If we already have a selection and click, clear it
  if (selStartIdx !== null && selEndIdx !== null && !isDragging) {
    selStartIdx = null;
    selEndIdx = null;
    updateSelection();
  }
  selStartIdx = idx;
  selEndIdx = idx;
  isDragging = true;
  hoverMarker.setOpacity(0);
});

canvas.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  const idx = getChartIndex(e);
  if (idx === null) return;
  selEndIdx = idx;
  updateSelection();
});

canvas.addEventListener('mouseup', function(e) {
  if (!isDragging) return;
  isDragging = false;
  const idx = getChartIndex(e);
  if (idx !== null) selEndIdx = idx;
  // If start === end, treat as clear
  if (selStartIdx === selEndIdx) {
    selStartIdx = null;
    selEndIdx = null;
  }
  updateSelection();
});

canvas.addEventListener('mouseleave', function() {
  if (isDragging) {
    isDragging = false;
    updateSelection();
  }
});

// ── Climbs List ──
const climbsListEl = document.getElementById('climbsList');
climbs.forEach(function(c, idx) {
  const div = document.createElement('div');
  div.className = 'climb-item';
  const col = catColors[c.catClass];
  const lenStr = c.length >= 1000 ? (c.length/1000).toFixed(1)+'km' : Math.round(c.length)+'m';
  div.innerHTML =
    '<div class="climb-number" style="background:'+col+'">'+(idx+1)+'</div>' +
    '<div class="climb-details">' +
      '<div class="climb-name">km '+(c.distFromStart/1000).toFixed(1)+' — '+lenStr+'</div>' +
      '<div class="climb-stats">+'+Math.round(c.gain)+'m &nbsp;|&nbsp; avg '+c.avgGrad.toFixed(1)+'% &nbsp;|&nbsp; max '+c.maxGrad.toFixed(1)+'%</div>' +
    '</div>' +
    '<div class="climb-category '+c.catClass+'">'+c.category+'</div>';
  div.addEventListener('click', function() {
    var startPt = smoothed[c.start];
    var endPt = smoothed[c.end];
    var bounds = L.latLngBounds([[startPt.lat, startPt.lon], [endPt.lat, endPt.lon]]);
    map.fitBounds(bounds.pad(0.5));
    climbMarkers[idx].openPopup();
  });
  climbsListEl.appendChild(div);
});

// ── Hard Ascents List ──
const hardAscentsListEl = document.getElementById('hardAscentsList');
hardAscents.forEach(function(a, idx) {
  const div = document.createElement('div');
  div.className = 'climb-item';
  const lenStr = a.length >= 1000 ? (a.length/1000).toFixed(1)+'km' : Math.round(a.length)+'m';
  div.innerHTML =
    '<div class="climb-number" style="background:#ff3366;color:#fff;font-size:10px">!</div>' +
    '<div class="climb-details">' +
      '<div class="climb-name">km '+(a.distFromStart/1000).toFixed(1)+' — '+lenStr+'</div>' +
      '<div class="climb-stats">+'+Math.round(a.gain)+'m &nbsp;|&nbsp; avg '+a.avgGrad.toFixed(1)+'% &nbsp;|&nbsp; max '+a.maxGrad.toFixed(1)+'%</div>' +
    '</div>' +
    '<div class="climb-category cat-steep" style="background:rgba(255,51,102,0.15);color:#ff3366">'+a.avgGrad.toFixed(0)+'%</div>';
  div.addEventListener('click', function() {
    var startPt = smoothed[a.start];
    var endPt = smoothed[a.end];
    var bounds = L.latLngBounds([[startPt.lat, startPt.lon], [endPt.lat, endPt.lon]]);
    map.fitBounds(bounds.pad(0.5));
    hardAscentLines[idx].openPopup();
  });
  hardAscentsListEl.appendChild(div);
});

<\/script>
</body>
</html>`;

fs.writeFileSync('C:/Users/PC/Downloads/sudovia-ride100.html', html);
console.log('Written! Size:', (fs.statSync('C:/Users/PC/Downloads/sudovia-ride100.html').size / 1024).toFixed(0), 'KB');
