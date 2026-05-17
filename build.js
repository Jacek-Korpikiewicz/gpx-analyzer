const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const dataPath = path.join(__dirname, 'route_data.json');
const gpxPath = path.join(__dirname, 'SUDOVIA 2026 RIDE100.gpx');

let html = fs.readFileSync(htmlPath, 'utf8');
const routeData = fs.readFileSync(dataPath, 'utf8');
const gpxText = fs.readFileSync(gpxPath, 'utf8');

// Encode GPX as base64 for full export compatibility
const gpxBase64 = Buffer.from(gpxText).toString('base64');

// Inject demo data: replace the placeholder
const demoObj = JSON.stringify({ points: JSON.parse(routeData), gpxBase64, name: 'Sudovia 2026 RIDE100' });
html = html.replace(
  'const DEMO_DATA = null; // INJECT_DEMO_DATA',
  `const DEMO_DATA = ${demoObj}; // INJECT_DEMO_DATA`
);

fs.writeFileSync(htmlPath, html);
console.log('Build complete. Demo data injected.');
console.log('File size:', (fs.statSync(htmlPath).size / 1024).toFixed(0), 'KB');
