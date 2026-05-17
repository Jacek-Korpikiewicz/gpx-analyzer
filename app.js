// Demo data lazy-loaded on demand from demo-data.js

// Constants
let DEFAULT_SETTINGS = { climbGrad:3.5, climbLen:400, ascentGrad:7, ascentLen:80 };

function computeAdaptiveDefaults(pts){
 // Calculate gradient distribution over 200m windows
 const grads=[];
 for(let i=0;i<pts.length-1;i++){
  let j=i;
  while(j<pts.length-1&&(pts[j].dist-pts[i].dist)<200) j++;
  if(j===i) continue;
  const d=pts[j].dist-pts[i].dist;
  if(d<50) continue;
  const g=((pts[j].ele-pts[i].ele)/d)*100;
  if(g>0) grads.push(g);
 }
 if(grads.length<10) return DEFAULT_SETTINGS;

 grads.sort((a,b)=>a-b);
 const p50=grads[Math.floor(grads.length*0.5)];
 const p75=grads[Math.floor(grads.length*0.75)];
 const p90=grads[Math.floor(grads.length*0.9)];
 const totalDist=pts[pts.length-1].dist/1000;
 let totalGain=0;
 for(let i=1;i<pts.length;i++){const d=pts[i].ele-pts[i-1].ele;if(d>0) totalGain+=d;}
 const gainPerKm=totalGain/totalDist;

 // Adaptive thresholds:
 // Climb gradient: use p75 as baseline — only the top quarter of uphills count
 const climbGrad=Math.round(Math.max(2, Math.min(6, p75))*10)/10;
 // Min length: longer to filter noise
 const climbLen=Math.round(Math.max(200, Math.min(1000, 700-gainPerKm*12))/25)*25;
 // Kicker: use p90 — only the steepest 10% of efforts
 const ascentGrad=Math.round(Math.max(5, Math.min(15, p90))*10)/10;
 // Kicker length: keep tight
 const ascentLen=Math.round(Math.max(40, Math.min(200, 120-gainPerKm*2))/5)*5;

 return {climbGrad,climbLen,ascentGrad,ascentLen};
}
const SETTING_KEYS = ['climbGrad','climbLen','ascentGrad','ascentLen'];
const MARKER_ICONS = {'Feed Zone':'\u{1F34C}','Coffee Stop':'\u2615','Regroup':'\u{1F91D}','Sprint':'\u26A1','Photo':'\u{1F4F7}','Danger':'\u26A0\uFE0F','Custom':'\u{1F4CD}'};

// State
let state = {
 gpxText: null,
 routeName: 'Untitled Route',
 trackPoints: [],
 settings: {...DEFAULT_SETTINGS},
 markers: [],
 mapView: null,
 climbs: [],
 ascents: []
};

let map, routeLayer, climbLayers=[], ascentLayers=[], markerLayers=[];
let startFinishMarkers=[];
let hitArea=null, scrubMarker=null, chartSampled=[], chartStep=1;
let chart = null;
let debounceTimer = null;
let placingMarker = false;

// Utils
function haversine(lat1,lon1,lat2,lon2){
 const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
 const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function smoothElevations(pts, w=5){
 const half=Math.floor(w/2);
 return pts.map((p,i)=>{
  let sum=0,count=0;
  for(let j=Math.max(0,i-half);j<=Math.min(pts.length-1,i+half);j++){sum+=pts[j].rawEle;count++;}
  return {...p, ele:sum/count};
 });
}

let _toastTimer=null;
function toast(msg, warn=false){
 const t=document.getElementById('toast');
 t.textContent=msg;
 t.className='toast'+(warn?' warn':'')+' show';
 if(_toastTimer) clearTimeout(_toastTimer);
 _toastTimer=setTimeout(()=>{t.classList.remove('show');_toastTimer=null;},3000);
}

// GPX Parsing
function parseGPX(text){
 const parser=new DOMParser();
 const doc=parser.parseFromString(text,'application/xml');
 const nameEl=doc.querySelector('trk>name')||doc.querySelector('metadata>name');
 const name=nameEl?nameEl.textContent:'';
 const trkpts=doc.querySelectorAll('trkpt');
 const pts=[];
 let cumDist=0;
 trkpts.forEach((tp,i)=>{
  const lat=parseFloat(tp.getAttribute('lat'));
  const lon=parseFloat(tp.getAttribute('lon'));
  const eleEl=tp.querySelector('ele');
  const ele=eleEl?parseFloat(eleEl.textContent):0;
  if(i>0) cumDist+=haversine(pts[i-1].lat,pts[i-1].lon,lat,lon);
  pts.push({lat,lon,rawEle:ele,ele:ele,dist:cumDist,idx:i});
 });
 return {name, points:smoothElevations(pts)};
}

// Analysis
function detectClimbs(pts, cfg){
 const {climbGrad, climbLen}=cfg;
 const climbs=[];
 const WINDOW_SIZE=200;
 const MAX_FLAT_DIST=300;
 let i=0;
 while(i<pts.length-1){
  // Find start using rolling window
  let startIdx=-1;
  for(let j=i;j<pts.length;j++){
   let endJ=j;
   while(endJ<pts.length-1 && (pts[endJ].dist-pts[j].dist)<WINDOW_SIZE) endJ++;
   const d=pts[endJ].dist-pts[j].dist;
   if(d>0){
    const g=((pts[endJ].ele-pts[j].ele)/d)*100;
    if(g>=climbGrad){startIdx=j;break;}
   }
  }
  if(startIdx<0) break;
  // Extend climb
  let endIdx=startIdx+1;
  let flatDist=0;
  let highestIdx=startIdx;
  for(let j=startIdx+1;j<pts.length;j++){
   const seg=pts[j].dist-pts[j-1].dist;
   const segGrad=seg>0?((pts[j].ele-pts[j-1].ele)/seg)*100:0;
   if(segGrad<0) flatDist+=seg; else flatDist=0;
   if(flatDist>MAX_FLAT_DIST) break;
   endIdx=j;
   if(pts[j].ele>pts[highestIdx].ele) highestIdx=j;
  }
  endIdx=highestIdx;
  const length=pts[endIdx].dist-pts[startIdx].dist;
  const gain=pts[endIdx].ele-pts[startIdx].ele;
  const grad=(length>0)?(gain/length)*100:0;
  if(grad>=climbGrad && length>=climbLen && gain>0){
   climbs.push({startIdx,endIdx,length,gain,grad,startDist:pts[startIdx].dist,endDist:pts[endIdx].dist});
  }
  i=endIdx+1;
 }
 return climbs;
}

function detectHardAscents(pts, cfg){
 const {ascentGrad, ascentLen}=cfg;
 const ascents=[];
 let i=0;
 while(i<pts.length-1){
  const seg=pts[i+1].dist-pts[i].dist;
  const g=seg>0?((pts[i+1].ele-pts[i].ele)/seg)*100:0;
  if(g>=ascentGrad){
   let start=i, end=i+1;
   while(end<pts.length-1){
    const s2=pts[end+1].dist-pts[end].dist;
    const g2=s2>0?((pts[end+1].ele-pts[end].ele)/s2)*100:0;
    if(g2>=ascentGrad) end++; else break;
   }
   const length=pts[end].dist-pts[start].dist;
   const gain=pts[end].ele-pts[start].ele;
   const grad=(length>0)?(gain/length)*100:0;
   if(length>=ascentLen && gain>0){
    ascents.push({startIdx:start,endIdx:end,length,gain,grad,startDist:pts[start].dist,endDist:pts[end].dist});
   }
   i=end+1;
  } else i++;
 }
 return ascents;
}

function categorizeClimb(lengthMeters, avgGradientPercent){
 const score=lengthMeters*avgGradientPercent;
 if(score>=80000) return {cat:'HC',color:'#991b1b',badge:'bg:rgba(153,27,27,0.2);color:#fca5a5'};
 if(score>=64000) return {cat:'Cat 1',color:'#ef4444',badge:'bg:rgba(239,68,68,0.15);color:#ef4444'};
 if(score>=32000) return {cat:'Cat 2',color:'#f97316',badge:'bg:rgba(249,115,22,0.15);color:#f97316'};
 if(score>=16000) return {cat:'Cat 3',color:'#fbbf24',badge:'bg:rgba(251,191,36,0.15);color:#fbbf24'};
 if(score>=8000) return {cat:'Cat 4',color:'#34d399',badge:'bg:rgba(52,211,153,0.15);color:#34d399'};
 return {cat:'',color:'#6b7280',badge:'bg:rgba(107,114,128,0.15);color:#9ca3af'};
}

function getColorMode(){
 const el=document.querySelector('input[name="colorMode"]:checked');
 return el?el.value:'pro';
}

function climbColorHex(grad, length){
 if(getColorMode()==='casual'){
  if(grad>=8) return '#ef4444';
  if(grad>=5) return '#fbbf24';
  return '#34d399';
 }
 const {color}=categorizeClimb(length||500, grad);
 return color;
}

// Map
function initMap(){
 map=L.map('map',{zoomControl:false,contextmenu:false});
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
  attribution:'&copy; OSM &copy; CARTO',subdomains:'abcd',maxZoom:19
 }).addTo(map);
 L.control.zoom({position:'topright'}).addTo(map);
 setupMapClick();
}

function renderRoute(){
 if(routeLayer) map.removeLayer(routeLayer);
 startFinishMarkers.forEach(m=>map.removeLayer(m));
 startFinishMarkers=[];
 const latlngs=state.trackPoints.map(p=>[p.lat,p.lon]);
 routeLayer=L.polyline(latlngs,{color:'#00d4ff',weight:3,opacity:0.8,interactive:true}).addTo(map);
 // Invisible wide polyline for easier hover/click targeting
 if(hitArea) map.removeLayer(hitArea);
 hitArea=L.polyline(latlngs,{color:'transparent',weight:20,opacity:0,interactive:true}).addTo(map);
 hitArea.bindTooltip('',{sticky:true,direction:'top',offset:[0,-10],className:'route-tooltip'});
 hitArea.on('mousemove',function(e){
  const pt=snapToRoute(e.latlng.lat,e.latlng.lng);
  if(pt){
   const km=(pt.dist/1000).toFixed(1);
   const totalDist=state.trackPoints[state.trackPoints.length-1].dist;
   const pct=((pt.dist/totalDist)*100).toFixed(0);
   hitArea.setTooltipContent(km+' km ('+pct+'%)');
  }
 });
 hitArea.on('contextmenu',function(e){
  L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);
  const pt=snapToRoute(e.latlng.lat,e.latlng.lng);
  if(pt) showMarkerPicker(pt,e);
 });
 // Right-click on route to add marker
 routeLayer.on('contextmenu',function(e){
  L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);
  const pt=snapToRoute(e.latlng.lat,e.latlng.lng);
  if(pt) showMarkerPicker(pt,e);
 });
 // Start/Finish markers
 const startIcon=L.divIcon({className:'',html:'<div style="width:12px;height:12px;background:#34d399;border-radius:50%;border:2px solid #fff"></div>',iconSize:[12,12],iconAnchor:[6,6]});
 const endIcon=L.divIcon({className:'',html:'<div style="width:12px;height:12px;background:#ef4444;border-radius:50%;border:2px solid #fff"></div>',iconSize:[12,12],iconAnchor:[6,6]});
 const sm=L.marker(latlngs[0],{icon:startIcon}).addTo(map).bindPopup('Start');
 const em=L.marker(latlngs[latlngs.length-1],{icon:endIcon}).addTo(map).bindPopup('Finish');
 startFinishMarkers=[sm,em];
 if(state.mapView) map.setView(state.mapView.center,state.mapView.zoom);
 else map.fitBounds(routeLayer.getBounds(),{padding:[20,20]});
 map.on('moveend',()=>{state.mapView={center:map.getCenter(),zoom:map.getZoom()};saveState();});
}

function renderClimbsOnMap(){
 climbLayers.forEach(l=>map.removeLayer(l));
 climbLayers=[];
 state.climbs.forEach((c,i)=>{
  const col=climbColorHex(c.grad, c.length);
  const cat=categorizeClimb(c.length, c.grad);
  const catLabel=(getColorMode()==='pro'&&cat.cat)?' · '+cat.cat:'';
  const tipText='Climb '+(i+1)+catLabel+' — '+(c.length/1000).toFixed(1)+'km · '+c.grad.toFixed(1)+'% · +'+Math.round(c.gain)+'m';
  const latlngs=state.trackPoints.slice(c.startIdx,c.endIdx+1).map(p=>[p.lat,p.lon]);
  const layer=L.polyline(latlngs,{color:col,weight:5,opacity:0.9,interactive:true}).addTo(map);
  layer.bindTooltip(tipText,{sticky:true,direction:'top',offset:[0,-12],className:'route-tooltip'});
  layer._climbIdx=i;
  (function(ci){layer.on('mouseover',()=>highlightFeature('climb',ci));layer.on('mouseout',()=>clearHighlight());})(i);
  climbLayers.push(layer);
  const icon=L.divIcon({className:'',html:'<div style="width:24px;height:24px;background:'+col+';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;box-shadow:0 0 6px '+col+'80;border:2px solid rgba(255,255,255,0.3)">'+(i+1)+'</div>',iconSize:[24,24],iconAnchor:[12,12]});
  const marker=L.marker(latlngs[0],{icon}).addTo(map);
  marker.bindTooltip(tipText,{direction:'top',offset:[0,-14],className:'route-tooltip'});
  marker.bindPopup('<b>Climb '+(i+1)+catLabel+'</b><br>'+(c.length/1000).toFixed(1)+'km · '+c.grad.toFixed(1)+'% · +'+Math.round(c.gain)+'m');
  climbLayers.push(marker);
 });
}

function renderAscentsOnMap(){
 ascentLayers.forEach(l=>map.removeLayer(l));
 ascentLayers=[];
 state.ascents.forEach((a,i)=>{
  const latlngs=state.trackPoints.slice(a.startIdx,a.endIdx+1).map(p=>[p.lat,p.lon]);
  const layer=L.polyline(latlngs,{color:'#ffb05a',weight:6,opacity:0.9,dashArray:'8 6',interactive:true}).addTo(map);
  layer.bindTooltip('Kicker '+(i+1)+' — '+Math.round(a.length)+'m · '+a.grad.toFixed(1)+'% · +'+Math.round(a.gain)+'m',{sticky:true,direction:'top',offset:[0,-12],className:'route-tooltip'});
  (function(ki){layer.on('mouseover',()=>highlightFeature('kicker',ki));layer.on('mouseout',()=>clearHighlight());})(i);
  ascentLayers.push(layer);
  // Numbered marker
  const icon=L.divIcon({className:'',html:'<div style="width:20px;height:20px;background:#ff3366;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;box-shadow:0 0 6px rgba(255,51,102,0.5);border:1.5px solid rgba(255,255,255,0.3)">'+(i+1)+'</div>',iconSize:[20,20],iconAnchor:[10,10]});
  const marker=L.marker(latlngs[0],{icon}).addTo(map);
  const kickTip='Kicker '+(i+1)+' — '+Math.round(a.length)+'m · '+a.grad.toFixed(1)+'% · +'+Math.round(a.gain)+'m';
  marker.bindTooltip(kickTip,{direction:'top',offset:[0,-12],className:'route-tooltip'});
  marker.bindPopup('<b>Kicker '+(i+1)+'</b><br>'+Math.round(a.length)+'m · '+a.grad.toFixed(1)+'% · +'+Math.round(a.gain)+'m');
  ascentLayers.push(marker);
 });
}

function renderMarkersOnMap(){
 markerLayers.forEach(l=>map.removeLayer(l));
 markerLayers=[];
 state.markers.forEach(m=>{
  const icon=L.divIcon({className:'',html:`<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">${MARKER_ICONS[m.type]||'📍'}</div>`,iconSize:[24,24],iconAnchor:[12,12]});
  const marker=L.marker([m.lat,m.lon],{icon}).addTo(map);
  marker.bindPopup('<b>'+escHtml(m.type)+'</b><br>'+escHtml(m.name||'')+'<br>'+(m.dist/1000).toFixed(1)+' km');
  markerLayers.push(marker);
 });
}

// Chart
const climbBandsPlugin={
 id:'climbBands',
 beforeDraw(chart){
  if(!state.trackPoints.length) return;
  const ctx=chart.ctx;
  const xScale=chart.scales.x;
  const yScale=chart.scales.y;
  const sam=chartSampled;
  function distToChartIdx(dist){
   for(let j=0;j<chartSampled.length;j++){if(chartSampled[j].dist>=dist) return j;}
   return chartSampled.length-1;
  }
  // Draw climb bands
  if(state.climbs) state.climbs.forEach((c,i)=>{
   const x1=xScale.getPixelForValue(distToChartIdx(c.startDist));
   const x2=xScale.getPixelForValue(distToChartIdx(c.startDist+c.length));
   const col=climbColorHex(c.grad,c.length);
   const isHi=_highlighted&&_highlighted.type==='climb'&&_highlighted.idx===i;
   ctx.fillStyle=col+(isHi?'40':'18');
   ctx.fillRect(x1,yScale.top,x2-x1,yScale.bottom-yScale.top);
   ctx.strokeStyle=col;
   ctx.lineWidth=isHi?3:1.5;
   ctx.beginPath();ctx.moveTo(x1,yScale.bottom);ctx.lineTo(x2,yScale.bottom);ctx.stroke();
   if(isHi){ctx.beginPath();ctx.moveTo(x1,yScale.top);ctx.lineTo(x2,yScale.top);ctx.stroke();}
  });
  // Draw kicker bands
  if(state.ascents) state.ascents.forEach((a,i)=>{
   const x1=xScale.getPixelForValue(distToChartIdx(a.startDist));
   const x2=xScale.getPixelForValue(distToChartIdx(a.startDist+a.length));
   const isHi=_highlighted&&_highlighted.type==='kicker'&&_highlighted.idx===i;
   ctx.fillStyle=isHi?'rgba(255,176,90,0.35)':'rgba(255,176,90,0.2)';
   ctx.fillRect(x1,yScale.top,x2-x1,yScale.bottom-yScale.top);
   ctx.strokeStyle='#ffb05a';
   ctx.lineWidth=isHi?3:2;
   ctx.beginPath();ctx.moveTo(x1,yScale.top);ctx.lineTo(x2,yScale.top);ctx.stroke();
   if(isHi){ctx.beginPath();ctx.moveTo(x1,yScale.bottom);ctx.lineTo(x2,yScale.bottom);ctx.stroke();}
  });
 }
};

function renderChart(){
 const ctx=document.getElementById('elevChart').getContext('2d');
 const pts=state.trackPoints;
 // Downsample to ~500 points for performance
 const step=Math.max(1,Math.floor(pts.length/500));
 const sampled=pts.filter((_,i)=>i%step===0||i===pts.length-1);
 // Store index mapping for band lookups
 chartSampled=sampled;
 chartStep=step;
 const labels=sampled.map(p=>(p.dist/1000).toFixed(1));
 const data=sampled.map(p=>p.ele);
 if(chart) chart.destroy();
 chart=new Chart(ctx,{
  type:'line',
  data:{labels,datasets:[{
   data,fill:true,
   borderColor:'#c8ff5a',
   backgroundColor:function(ctx){
    const g=ctx.chart.ctx.createLinearGradient(0,0,0,ctx.chart.height);
    g.addColorStop(0,'rgba(200,255,90,0.15)');
    g.addColorStop(1,'rgba(200,255,90,0.01)');
    return g;
   },
   borderWidth:1.5,pointRadius:0,tension:0.3
  }]},
  plugins:[climbBandsPlugin],
  options:{
   responsive:true,maintainAspectRatio:false,
   plugins:{legend:{display:false},tooltip:{
    backgroundColor:'#161a14',borderColor:'#2d3424',borderWidth:1,
    titleFont:{size:10,family:'JetBrains Mono'},bodyFont:{size:11,family:'JetBrains Mono',weight:'bold'},
    titleColor:'#7a7f6e',bodyColor:'#c8ff5a',padding:8,displayColors:false,
    callbacks:{title:items=>`km ${items[0].label}`,label:item=>`${Math.round(item.raw)} m`}
   }},
   scales:{
    x:{display:true,ticks:{maxTicksLimit:10,font:{size:9,family:'JetBrains Mono'},color:'#4a4f42'},grid:{color:'rgba(31,36,24,0.4)',lineWidth:1}},
    y:{ticks:{font:{size:9,family:'JetBrains Mono'},color:'#4a4f42',maxTicksLimit:6},grid:{color:'rgba(31,36,24,0.4)',lineWidth:1}}
   },
   interaction:{mode:'index',intersect:false},
   onHover:function(event,elements){
    if(elements.length>0){
     const idx=elements[0].index;
     const sam=chartSampled.length?chartSampled:state.trackPoints;
     if(idx>=0&&idx<sam.length){
      const p=sam[idx];
      // Scrub marker on map
      if(!scrubMarker){
       const icon=L.divIcon({className:'',html:'<div style="width:10px;height:10px;background:#c8ff5a;border:2px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(200,255,90,0.8)"></div>',iconSize:[10,10],iconAnchor:[5,5]});
       scrubMarker=L.marker([p.lat,p.lon],{icon,interactive:false,zIndexOffset:9999}).addTo(map);
      } else {
       scrubMarker.setLatLng([p.lat,p.lon]);
       scrubMarker.setOpacity(1);
      }
      // Check if cursor is over a kicker or climb band (kickers first — they're shorter and overlap)
      const curDist=p.dist;
      let found=false;
      if(state.ascents) for(let ki=0;ki<state.ascents.length;ki++){
       const a=state.ascents[ki];
       if(curDist>=a.startDist&&curDist<=a.startDist+a.length){highlightFeature('kicker',ki);found=true;break;}
      }
      if(!found&&state.climbs) for(let ci=0;ci<state.climbs.length;ci++){
       const c=state.climbs[ci];
       if(curDist>=c.startDist&&curDist<=c.startDist+c.length){highlightFeature('climb',ci);found=true;break;}
      }
      if(!found) clearHighlight();
     }
    } else {
     if(scrubMarker) scrubMarker.setOpacity(0);
     clearHighlight();
    }
   }
  }
 });
}


// ── Unified highlight system ──
// type: 'climb' or 'kicker', idx: index in state.climbs/ascents
let _highlighted=null;

function getPolylineForFeature(type, idx){
 // Each feature has a polyline (even indices) and a marker (odd indices) in the layers array
 const layers=type==='climb'?climbLayers:ascentLayers;
 const layer=layers[idx*2];
 return (layer&&layer.setStyle)?layer:null;
}

function highlightFeature(type, idx){
 if(_highlighted && _highlighted.type===type && _highlighted.idx===idx) return;
 clearHighlight();
 _highlighted={type,idx};
 const item=type==='climb'?state.climbs[idx]:state.ascents[idx];
 if(!item) return;

 // 1. Map: thicken the polyline
 const layer=getPolylineForFeature(type,idx);
 if(layer){
  if(type==='climb') layer.setStyle({weight:9,opacity:1});
  else layer.setStyle({weight:10,opacity:1});
 }

 // 2. List: highlight the row
 const listId=type==='climb'?'climbList':'ascentList';
 const rows=document.getElementById(listId).querySelectorAll(type==='climb'?'.climb-item':'.ascent-item');
 if(rows[idx]) rows[idx].classList.add('highlighted');

 // 3. Chart: redraw with highlighted band (store which is highlighted, plugin reads it)
 if(chart) chart.update('none');
}

function clearHighlight(){
 if(!_highlighted) return;
 const {type,idx}=_highlighted;

 // Map: restore
 const layer=getPolylineForFeature(type,idx);
 if(layer){
  if(type==='climb') layer.setStyle({weight:5,opacity:0.9});
  else layer.setStyle({weight:6,opacity:0.9,dashArray:'8 6'});
 }

 // List: unhighlight
 const listId=type==='climb'?'climbList':'ascentList';
 const rows=document.getElementById(listId).querySelectorAll(type==='climb'?'.climb-item':'.ascent-item');
 if(rows[idx]) rows[idx].classList.remove('highlighted');

 _highlighted=null;
 if(chart) chart.update('none');
}

// Panel rendering
function renderPanel(){
 const pts=state.trackPoints;
 const totalDist=pts[pts.length-1].dist;
 let totalGain=0;
 for(let i=1;i<pts.length;i++){const d=pts[i].ele-pts[i-1].ele;if(d>0) totalGain+=d;}
 document.getElementById('statDist').textContent=(totalDist/1000).toFixed(1);
 document.getElementById('statGain').textContent=Math.round(totalGain);
 document.getElementById('routeName').innerHTML='<span class="punchy">punchy</span>AF / '+escHtml(state.routeName);
 // Climb/kicker gain stats
 const climbGain=state.climbs.reduce((s,c)=>s+c.gain,0);
 const kickerGain=state.ascents.reduce((s,a)=>s+a.gain,0);
 document.getElementById('statClimbGain').textContent=Math.round(climbGain)+'m';
 document.getElementById('statKickerGain').textContent=Math.round(kickerGain)+'m';
 document.getElementById('statClimbPct').textContent=totalGain>0?'('+Math.round(climbGain/totalGain*100)+'%)':'';
 document.getElementById('statKickerPct').textContent=totalGain>0?'('+Math.round(kickerGain/totalGain*100)+'%)':'';
 renderClimbList();
 renderAscentList();
 renderMarkerList();
}

function renderClimbList(){
 const el=document.getElementById('climbList');
 if(!state.climbs.length){el.innerHTML='<div class="empty-state">No climbs detected</div>';return;}
 const mode=getColorMode();
 el.innerHTML=state.climbs.map((c,i)=>{
  const col=climbColorHex(c.grad, c.length);
  const cat=categorizeClimb(c.length,c.grad);
  const badge=(mode==='pro'&&cat.cat)?`<span class="cat-badge" style="color:${cat.badge.split(';')[1].replace('color:','')};border-color:${cat.badge.split(';')[1].replace('color:','')}">${cat.cat}</span>`:'';
  const startEle=Math.round(state.trackPoints[c.startIdx].ele);
  const endEle=Math.round(state.trackPoints[c.endIdx].ele);
  const lenStr=c.length>=1000?(c.length/1000).toFixed(1)+'km':Math.round(c.length)+'m';
  return `<div class="climb-item" data-idx="${i}" style="border-left:3px solid ${col};background:transparent">
   <div class="grad-big" style="color:${col}">${lenStr}</div>
   <div class="climb-info">
    <div class="climb-name" style="color:${col}">Climb ${i+1} @ ${c.grad.toFixed(1)}% ${badge}</div>
    <div class="climb-stats">P: ${(c.startDist/1000).toFixed(1)}km · C: +${Math.round(c.gain)}m</div>
   </div>
  </div>`;}).join('');
 el.querySelectorAll('.climb-item').forEach(item=>{
  const idx=parseInt(item.dataset.idx);
  item.addEventListener('click',()=>{
   const c=state.climbs[idx];
   const latlngs=state.trackPoints.slice(c.startIdx,c.endIdx+1).map(p=>[p.lat,p.lon]);
   map.fitBounds(L.latLngBounds(latlngs),{padding:[40,40]});
  });
  item.addEventListener('mouseenter',()=>highlightFeature('climb',idx));
  item.addEventListener('mouseleave',()=>clearHighlight());
 });
}

function renderAscentList(){
 const el=document.getElementById('ascentList');
 if(!state.ascents.length){el.innerHTML='<div class="empty-state">No kickers detected</div>';return;}
 el.innerHTML=state.ascents.map((a,i)=>{
  const barPct=Math.min(100,a.grad/12*100);
  return `<div class="ascent-item" data-idx="${i}" style="border-left:3px solid #ffb05a;background:transparent">
   <div class="grad-big" style="color:#ffb05a">${a.grad.toFixed(1)}%</div>
   <div class="ascent-info" style="flex:1">
    <div class="ascent-name" style="color:#ffb05a">Kicker ${i+1}</div>
    <div class="ascent-stats">P: ${(a.startDist/1000).toFixed(1)}km · L: ${Math.round(a.length)}m · C: +${Math.round(a.gain)}m</div>
    <div class="diff-bar"><div class="diff-bar-fill" style="width:${barPct}%;background:#ffb05a"></div></div>
   </div>
  </div>`;}).join('');
 el.querySelectorAll('.ascent-item').forEach(item=>{
  const idx=parseInt(item.dataset.idx);
  item.addEventListener('click',()=>{
   const a=state.ascents[idx];
   const latlngs=state.trackPoints.slice(a.startIdx,a.endIdx+1).map(p=>[p.lat,p.lon]);
   map.fitBounds(L.latLngBounds(latlngs),{padding:[40,40]});
  });
  item.addEventListener('mouseenter',()=>highlightFeature('kicker',idx));
  item.addEventListener('mouseleave',()=>clearHighlight());
 });
}

function renderMarkerList(){
 const el=document.getElementById('markerList');
 if(!state.markers.length){el.innerHTML='<div class="empty-state">No custom markers</div>';return;}
 el.innerHTML=state.markers.map((m,i)=>`
  <div class="marker-item">
   <div class="marker-info">
    <div class="marker-name">${MARKER_ICONS[m.type]||'📍'} ${escHtml(m.type)}${m.name?' - '+escHtml(m.name):''}</div>
    <div class="marker-stats">${(m.dist/1000).toFixed(1)} km</div>
   </div>
   <div class="marker-actions">
    <button data-del="${i}" title="Delete"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
   </div>
  </div>`).join('');
 el.querySelectorAll('[data-del]').forEach(btn=>{
  btn.addEventListener('click',e=>{
   e.stopPropagation();
   state.markers.splice(parseInt(btn.dataset.del),1);
   saveState();renderMarkerList();renderMarkersOnMap();
  });
 });
}

// Process route: run analysis and render chart
function processRoute(){
 reanalyze();
 renderChart();
}

function reanalyze(){
 state.climbs=detectClimbs(state.trackPoints,state.settings);
 state.ascents=detectHardAscents(state.trackPoints,state.settings);
 renderClimbsOnMap();
 renderAscentsOnMap();
 renderPanel();
 renderMarkersOnMap();
 // Bring hit area to front so route tooltip still works over climb/kicker segments
 if(hitArea) hitArea.bringToFront();
 saveState();
}

// File handling
function handleFile(file, text, fromStorage){
 if(file&&file.size>10*1024*1024) toast('Large file (>10MB) — processing may be slow',true);
 if(!text&&!file) return;
 const process=(t)=>{
  try{
   const {name,points}=parseGPX(t);
   if(!points.length){toast('No track points found in GPX');return;}
   state.gpxText=t;
   state.routeName=name||file?.name?.replace('.gpx','')||'Untitled Route';
   state.trackPoints=points;
   // Compute adaptive defaults for fresh uploads (not from localStorage)
   if(!fromStorage){
    DEFAULT_SETTINGS=computeAdaptiveDefaults(points);
    state.settings={...DEFAULT_SETTINGS};
    updateAllSliders();
    // Classify route and inform user
    const totalDist=points[points.length-1].dist/1000;
    let tGain=0;for(let i=1;i<points.length;i++){const d=points[i].ele-points[i-1].ele;if(d>0)tGain+=d;}
    const gPerKm=tGain/totalDist;
    const routeType=gPerKm>15?'mountainous':gPerKm>8?'hilly':gPerKm>4?'rolling':'flat';
    toast('Detected '+routeType+' route — thresholds auto-tuned ('+DEFAULT_SETTINGS.climbGrad.toFixed(1)+'% / '+DEFAULT_SETTINGS.climbLen+'m)');
   }
   document.getElementById('landing').classList.add('hidden');
   document.getElementById('app').classList.add('active');
   setTimeout(()=>{
    if(!map) initMap();
    else map.invalidateSize();
    renderRoute();
    processRoute();
    setTimeout(()=>{ if(chart) chart.resize(); },200);
   },150);
  }catch(e){toast('Error parsing GPX: '+e.message);console.error(e);}
 };
 if(text) process(text);
 else{const r=new FileReader();r.onload=()=>process(r.result);r.readAsText(file);}
}

// LocalStorage
function saveState(){
 try{
  const s={gpxText:state.gpxText,routeName:state.routeName,settings:state.settings,markers:state.markers,mapView:state.mapView};
  localStorage.setItem('routeAnalyzer',JSON.stringify(s));
 }catch(e){
  if(e.name==='QuotaExceededError') toast('Storage full — settings may not persist',true);
 }
}

function loadState(){
 try{
  const s=JSON.parse(localStorage.getItem('routeAnalyzer'));
  if(!s) return false;
  if(s.settings){
   // Validate numeric settings before applying
   const validated={...DEFAULT_SETTINGS};
   SETTING_KEYS.forEach(key=>{
    const v=parseFloat(s.settings[key]);
    if(!isNaN(v)&&isFinite(v)) validated[key]=v;
   });
   state.settings=validated;
  }
  if(s.markers&&Array.isArray(s.markers)) state.markers=s.markers;
  if(s.mapView) state.mapView=s.mapView;
  if(s.routeName) state.routeName=s.routeName;
  // Apply settings to sliders
  updateAllSliders();
  if(s.gpxText){
   state.gpxText=s.gpxText;
   handleFile(null,s.gpxText,true);
   return true;
  }
 }catch(e){console.error('Load state error',e);}
 return false;
}

// Settings
function updateAllSliders(){
 SETTING_KEYS.forEach(key=>{
  const val=state.settings[key];
  const el=document.getElementById(key);
  const el2=document.getElementById(key+'2');
  const lbl=document.getElementById(key+'Val');
  const lbl2=document.getElementById(key+'Val2');
  if(el) el.value=val;
  if(el2) el2.value=val;
  if(lbl) lbl.value=val;
  if(lbl2) lbl2.value=val;
 });
}

function settingsChanged(){
 clearTimeout(debounceTimer);
 debounceTimer=setTimeout(()=>{
  // Read from whichever slider set is visible/current
  SETTING_KEYS.forEach(key=>{
   const el=document.getElementById(key);
   if(el) state.settings[key]=parseFloat(el.value);
  });
  updateAllSliders();
  if(state.trackPoints.length) reanalyze();
 },200);
}

// Settings panel toggle
function openSettings(){document.getElementById('settings-drawer').classList.add('open');document.getElementById('settings-overlay').classList.add('open');}
function closeSettingsPanel(){document.getElementById('settings-drawer').classList.remove('open');document.getElementById('settings-overlay').classList.remove('open');}

function resetToDefaults(){
 if(state.trackPoints.length) DEFAULT_SETTINGS=computeAdaptiveDefaults(state.trackPoints);
 state.settings={...DEFAULT_SETTINGS};
 updateAllSliders();
 if(state.trackPoints.length) reanalyze();
}

function resetAll(){
 if(!confirm('Clear everything and return to start?')) return;
 localStorage.removeItem('routeAnalyzer');
 location.reload();
}

// Export
function exportGPX(){
 const pts=state.trackPoints;
 let gpx='<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RouteAnalyzer">\n<metadata><name>'+escXml(state.routeName)+'</name></metadata>\n';
 // Waypoints
 state.climbs.forEach((c,i)=>{
  gpx+=`<wpt lat="${pts[c.startIdx].lat}" lon="${pts[c.startIdx].lon}"><name>${escXml('Climb '+(i+1)+': '+(c.length/1000).toFixed(1)+'km '+c.grad.toFixed(1)+'% +'+Math.round(c.gain)+'m')}</name></wpt>\n`;
 });
 state.ascents.forEach((a,i)=>{
  gpx+=`<wpt lat="${pts[a.startIdx].lat}" lon="${pts[a.startIdx].lon}"><name>${escXml('Kicker! '+Math.round(a.length)+'m '+a.grad.toFixed(1)+'% +'+Math.round(a.gain)+'m')}</name></wpt>\n`;
 });
 state.markers.forEach(m=>{
  gpx+=`<wpt lat="${m.lat}" lon="${m.lon}"><name>${escXml(m.type+(m.name?' - '+m.name:''))}</name></wpt>\n`;
 });
 gpx+='<trk><name>'+escXml(state.routeName)+'</name><trkseg>\n';
 pts.forEach(p=>{gpx+=`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.rawEle}</ele></trkpt>\n`;});
 gpx+='</trkseg></trk>\n</gpx>';
 download(gpx, state.routeName+'.gpx','application/gpx+xml');
}

function exportMarkers(){
 download(JSON.stringify(state.markers,null,2),state.routeName+'_markers.json','application/json');
}

function escXml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escHtml(s){return escXml(s);}
function download(content,name,type){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// Markers
function snapToRoute(lat,lon){
 let minD=Infinity,closest=null;
 state.trackPoints.forEach(p=>{
  const d=haversine(lat,lon,p.lat,p.lon);
  if(d<minD){minD=d;closest=p;}
 });
 return closest;
}

function addMarkerAtKmValue(km, type, inputEl){
 if(isNaN(km)||km<0){toast('Enter a valid km value');return;}
 const dist=km*1000;
 const pts=state.trackPoints;
 if(dist>pts[pts.length-1].dist){toast('km exceeds route length');return;}
 // Interpolate position
 let p1=pts[0],p2=pts[1];
 for(let i=0;i<pts.length-1;i++){
  if(pts[i].dist<=dist&&pts[i+1].dist>=dist){p1=pts[i];p2=pts[i+1];break;}
 }
 const ratio=(p2.dist-p1.dist)>0?(dist-p1.dist)/(p2.dist-p1.dist):0;
 const lat=p1.lat+(p2.lat-p1.lat)*ratio;
 const lon=p1.lon+(p2.lon-p1.lon)*ratio;
 state.markers.push({lat,lon,dist,type,name:''});
 state.markers.sort((a,b)=>a.dist-b.dist);
 saveState();renderMarkerList();renderMarkersOnMap();
 if(inputEl) inputEl.value='';
 toast('Marker added at '+km.toFixed(1)+' km');
}

function addMarkerAtKm(){
 const kmInput=document.getElementById('markerKmInput');
 addMarkerAtKmValue(parseFloat(kmInput.value), document.getElementById('markerTypeSelect').value, kmInput);
}

function startMapPlacement(){
 closeSettingsPanel();
 placingMarker=true;
 document.body.classList.add('crosshair-mode');
 document.getElementById('crosshairBanner').style.display='block';
}

function cancelPlacement(){
 placingMarker=false;
 document.body.classList.remove('crosshair-mode');
 document.getElementById('crosshairBanner').style.display='none';
 document.getElementById('marker-picker').classList.remove('show');
}

// Import markers
function importMarkers(file){
 const r=new FileReader();
 r.onload=()=>{
  try{
   const imported=JSON.parse(r.result);
   if(!Array.isArray(imported)){toast('Invalid markers file');return;}
   const action=confirm('Merge with existing markers? (Cancel to replace)')?'merge':'replace';
   if(action==='replace') state.markers=imported;
   else state.markers=state.markers.concat(imported);
   state.markers.sort((a,b)=>a.dist-b.dist);
   saveState();renderMarkerList();renderMarkersOnMap();
   toast('Markers imported');
  }catch(e){toast('Error parsing JSON');}
 };
 r.readAsText(file);
}

// Event listeners
document.addEventListener('DOMContentLoaded',()=>{
 // Landing
 const dropZone=document.getElementById('dropZone');
 const fileInput=document.getElementById('fileInput');
 dropZone.addEventListener('click',()=>fileInput.click());
 dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('dragover');});
 dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragover'));
 dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('dragover');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
 fileInput.addEventListener('change',()=>{if(fileInput.files[0])handleFile(fileInput.files[0]);});
 document.getElementById('demoBtn').addEventListener('click',()=>{
  if(typeof DEMO_DATA!=='undefined'&&DEMO_DATA){
   const gpxText=atob(DEMO_DATA.gpxBase64);
   handleFile(null,gpxText);
  } else {
   toast('Loading demo route...');
   const s=document.createElement('script');
   s.src='demo-data.js';
   s.onload=()=>{
    if(typeof DEMO_DATA!=='undefined'&&DEMO_DATA){
     const gpxText=atob(DEMO_DATA.gpxBase64);
     handleFile(null,gpxText);
    } else toast('Failed to load demo data.');
   };
   s.onerror=()=>toast('Failed to load demo data.');
   document.head.appendChild(s);
  }
 });

 // Settings
 document.getElementById('settingsBtn').addEventListener('click',openSettings);
 document.getElementById('closeSettings').addEventListener('click',closeSettingsPanel);
 document.getElementById('settings-overlay').addEventListener('click',closeSettingsPanel);
 // Slider + number input sync for both panels
 SETTING_KEYS.forEach(id=>{
  // Drawer sliders
  document.getElementById(id).addEventListener('input',function(){
   document.getElementById(id+'Val').value=this.value;
   settingsChanged();
  });
  // Drawer number inputs
  document.getElementById(id+'Val').addEventListener('input',function(){
   document.getElementById(id).value=this.value;
   settingsChanged();
  });
 });
 document.getElementById('resetDefaults').addEventListener('click',resetToDefaults);
 document.getElementById('resetAll').addEventListener('click',resetAll);

 // Markers (drawer)
 document.getElementById('addMarkerKm').addEventListener('click',addMarkerAtKm);
 document.getElementById('addMarkerMap').addEventListener('click',startMapPlacement);
 document.getElementById('importMarkersBtn').addEventListener('click',()=>document.getElementById('importMarkersFile').click());
 document.getElementById('importMarkersFile').addEventListener('change',e=>{if(e.target.files[0])importMarkers(e.target.files[0]);e.target.value='';});

 // Markers (right panel +Add)
 document.getElementById('addMarkerPanelBtn').addEventListener('click',()=>{
  const panel=document.getElementById('markerAddPanel');
  panel.style.display=panel.style.display==='none'?'block':'none';
 });
 document.getElementById('markerPanelConfirm').addEventListener('click',()=>{
  const km=parseFloat(document.getElementById('markerKmPanelInput').value);
  const type=document.getElementById('markerTypePanelSelect').value;
  addMarkerAtKmValue(km, type, document.getElementById('markerKmPanelInput'));
 });
 document.getElementById('markerPanelMapClick').addEventListener('click',()=>{
  document.getElementById('markerAddPanel').style.display='none';
  startMapPlacement();
 });

 // Export
 document.getElementById('exportBtn').addEventListener('click',()=>document.getElementById('export-modal').classList.add('open'));
 document.getElementById('exportPanelBtn').addEventListener('click',()=>exportGPX());
 document.getElementById('closeExport').addEventListener('click',()=>document.getElementById('export-modal').classList.remove('open'));
 document.getElementById('exportGpx').addEventListener('click',()=>{exportGPX();document.getElementById('export-modal').classList.remove('open');});
 document.getElementById('exportJson').addEventListener('click',()=>{exportMarkers();document.getElementById('export-modal').classList.remove('open');});

 // Left panel settings (sync to drawer and trigger update)
 SETTING_KEYS.forEach(key=>{
  // Left panel sliders
  document.getElementById(key+'2').addEventListener('input',function(){
   document.getElementById(key).value=this.value;
   document.getElementById(key+'Val2').value=this.value;
   document.getElementById(key+'Val').value=this.value;
   settingsChanged();
  });
  // Left panel number inputs
  document.getElementById(key+'Val2').addEventListener('input',function(){
   document.getElementById(key+'2').value=this.value;
   document.getElementById(key).value=this.value;
   document.getElementById(key+'Val').value=this.value;
   settingsChanged();
  });
 });
 document.getElementById('resetDefaults2').addEventListener('click',resetToDefaults);
 document.getElementById('resetAll2').addEventListener('click',resetAll);
 // Color mode toggle
 document.querySelectorAll('input[name="colorMode"]').forEach(r=>{
  r.addEventListener('change',()=>{ if(state.trackPoints.length) reanalyze(); });
 });

 // Tabs
 document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
   document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
   document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
   tab.classList.add('active');
   const tabMap={climbs:'tabClimbs',ascents:'tabAscents',markers:'tabMarkers'};
   document.getElementById(tabMap[tab.dataset.tab]).classList.add('active');
  });
 });

 // Map click for marker placement
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&placingMarker) cancelPlacement();});

 // Marker type picker
 document.querySelectorAll('#marker-picker button').forEach(btn=>{
  btn.addEventListener('click',()=>{
   const type=btn.dataset.type;
   const pt=window._pendingMarkerPoint;
   if(pt){
    state.markers.push({lat:pt.lat,lon:pt.lon,dist:pt.dist,type,name:''});
    state.markers.sort((a,b)=>a.dist-b.dist);
    saveState();renderMarkerList();renderMarkersOnMap();
    toast('Marker placed');
   }
   cancelPlacement();
  });
 });

 // Load saved state
 if(!loadState()){
  // Show landing
 }
});

// Deferred map click setup (after map init)
function setupMapClick(){
 map.on('click',e=>{
  // Dismiss picker if open
  if(document.getElementById('marker-picker').classList.contains('show')){
   document.getElementById('marker-picker').classList.remove('show');
   return;
  }
  if(!placingMarker) return;
  const pt=snapToRoute(e.latlng.lat,e.latlng.lng);
  if(!pt){toast('Could not snap to route');return;}
  showMarkerPicker(pt, e);
 });
}

function showMarkerPicker(pt, e){
 window._pendingMarkerPoint=pt;
 const picker=document.getElementById('marker-picker');
 const mapRect=document.getElementById('map').getBoundingClientRect();
 const point=map.latLngToContainerPoint([pt.lat,pt.lon]);
 picker.style.left=(mapRect.left+point.x+10)+'px';
 picker.style.top=(mapRect.top+point.y-60)+'px';
 picker.classList.add('show');
}

