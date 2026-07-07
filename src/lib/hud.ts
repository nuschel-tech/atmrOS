// @ts-nocheck
/**
 * atmrOS HUD — boot sequence, animated grid/particle canvases, custom
 * cursor, radar sweep and the simulated live-data feed.
 *
 * Ported verbatim from the original standalone index.html. This is
 * imperative DOM code, so it lives outside Svelte reactivity and is
 * excluded from type-checking. Call initHud() once, from onMount.
 */
export function initHud() {
const bootEl = document.getElementById('boot');
const bootLines = [
  '<span class="pink">atmrOS</span> bootloader v0.1.0-alpha',
  'Copyright (c) 2026 MultaEnhavo // Nico Thomas Henkel',
  '',
  '[<span class="ok">  OK  </span>] Initializing kernel...',
  '[<span class="ok">  OK  </span>] Mounting /dev/grid',
  '[<span class="ok">  OK  </span>] Loading geospatial engine [PostGIS]',
  '[<span class="ok">  OK  </span>] Establishing uplink [IoT-SIM // multinet]',
  '[<span class="warn"> WAIT </span>] Acquiring GPS lock...',
  '[<span class="ok">  OK  </span>] GPS lock acquired // 11 satellites',
  '[<span class="ok">  OK  </span>] WiFi scanner armed [monitor mode]',
  '[<span class="ok">  OK  </span>] Cellular scanner armed',
  '[<span class="ok">  OK  </span>] Fog-of-war layer loaded',
  '[<span class="warn"> WAIT </span>] Syncing public data sources...',
  '[<span class="ok">  OK  </span>] OpenStreetMap // connected',
  '[<span class="ok">  OK  </span>] WiGLE // connected',
  '[<span class="ok">  OK  </span>] OpenSky Network // connected',
  '',
  '<span class="cyan">>> ctOS clone detected. this one is real.</span>',
  '<span class="bright">>> welcome to the grid.</span>',
  '',
  'launching interface<span class="blink">_</span>',
];

let bl = 0;
function bootStep() {
  if (bl < bootLines.length) {
    const div = document.createElement('div');
    div.className = 'boot-line';
    div.innerHTML = bootLines[bl];
    bootEl.appendChild(div);
    bl++;
    const delay = bootLines[bl-1].includes('WAIT') ? 400 :
                  bootLines[bl-1] === '' ? 120 : 90 + Math.random()*80;
    setTimeout(bootStep, delay);
  } else {
    setTimeout(() => {
      bootEl.classList.add('done');
      document.getElementById('ui').classList.add('live');
      startSystems();
    }, 600);
  }
}
setTimeout(bootStep, 400);

// ══════════════ CUSTOM CURSOR ══════════════
const cur = document.getElementById('cur');
let mx = -100, my = -100;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cur.style.left = mx+'px'; cur.style.top = my+'px';
});

// ══════════════ GRID CANVAS (perspective grid) ══════════════
const gc = document.getElementById('grid-canvas');
const gx = gc.getContext('2d');
let GW, GH;
function resizeGrid(){ GW = gc.width = innerWidth; GH = gc.height = innerHeight; }
resizeGrid(); addEventListener('resize', resizeGrid);

let gridOffset = 0;
function drawGrid(){
  gx.clearRect(0,0,GW,GH);
  gx.strokeStyle = 'rgba(227,28,141,0.06)';
  gx.lineWidth = 1;
  const spacing = 55;
  const ox = (mx - GW/2) * 0.01;
  const oy = (my - GH/2) * 0.01;
  gridOffset = (gridOffset + 0.15) % spacing;
  for(let x = -spacing; x < GW+spacing; x += spacing){
    gx.beginPath(); gx.moveTo(x+ox, 0); gx.lineTo(x+ox, GH); gx.stroke();
  }
  for(let y = -spacing; y < GH+spacing; y += spacing){
    const yy = y + gridOffset + oy;
    gx.beginPath(); gx.moveTo(0, yy); gx.lineTo(GW, yy); gx.stroke();
  }
  // glow near cursor
  if(mx > 0){
    const g = gx.createRadialGradient(mx,my,0,mx,my,150);
    g.addColorStop(0,'rgba(227,28,141,0.10)');
    g.addColorStop(1,'rgba(227,28,141,0)');
    gx.fillStyle = g; gx.fillRect(0,0,GW,GH);
  }
  requestAnimationFrame(drawGrid);
}
drawGrid();

// ══════════════ PARTICLE CANVAS (data nodes + connections) ══════════════
const pc = document.getElementById('particle-canvas');
const px = pc.getContext('2d');
let PW, PH;
function resizeP(){ PW = pc.width = innerWidth; PH = pc.height = innerHeight; }
resizeP(); addEventListener('resize', resizeP);

const nodes = [];
const NCOUNT = 55;
const COLORS = ['227,28,141','0,229,255','0,255,156'];
for(let i=0;i<NCOUNT;i++){
  nodes.push({
    x: Math.random()*PW, y: Math.random()*PH,
    vx: (Math.random()-0.5)*0.35, vy: (Math.random()-0.5)*0.35,
    r: Math.random()*1.5+0.5,
    c: COLORS[Math.floor(Math.random()*COLORS.length)],
    pulse: Math.random()*Math.PI*2
  });
}
function drawParticles(){
  px.clearRect(0,0,PW,PH);
  // connections
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i], b=nodes[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<130){
        px.beginPath();
        px.moveTo(a.x,a.y); px.lineTo(b.x,b.y);
        px.strokeStyle = `rgba(227,28,141,${(1-d/130)*0.13})`;
        px.lineWidth = 0.5; px.stroke();
      }
    }
  }
  // nodes
  nodes.forEach(n=>{
    // mouse repel
    const dx = n.x-mx, dy = n.y-my;
    const md = Math.sqrt(dx*dx+dy*dy);
    if(md<120){ n.vx += (dx/md)*0.04; n.vy += (dy/md)*0.04; }
    n.vx *= 0.985; n.vy *= 0.985;
    n.x += n.vx; n.y += n.vy;
    if(n.x<0||n.x>PW) n.vx*=-1;
    if(n.y<0||n.y>PH) n.vy*=-1;
    n.pulse += 0.04;
    const glow = (Math.sin(n.pulse)*0.4+0.6);
    px.beginPath();
    px.arc(n.x,n.y,n.r,0,Math.PI*2);
    px.fillStyle = `rgba(${n.c},${glow})`;
    px.fill();
    px.beginPath();
    px.arc(n.x,n.y,n.r*3,0,Math.PI*2);
    px.fillStyle = `rgba(${n.c},${glow*0.08})`;
    px.fill();
  });
  requestAnimationFrame(drawParticles);
}
drawParticles();

// ══════════════ LIVE SYSTEMS ══════════════
function startSystems(){
  // clock
  function tick(){
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    document.getElementById('tb-time').textContent =
      p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }
  tick(); setInterval(tick,1000);

  // fake live counters
  let pkts = 0, nodesC = 0, area = 0;
  setInterval(()=>{
    pkts += Math.floor(Math.random()*7)+1;
    document.getElementById('pkts').textContent = String(pkts).padStart(5,'0');
    if(Math.random()>0.7){ nodesC++; document.getElementById('nodes').textContent = nodesC; }
    area += Math.random()*0.03;
    document.getElementById('area').textContent = area.toFixed(1);
  }, 800);

  // jitter coordinates
  setInterval(()=>{
    const lat = (48.2891 + (Math.random()-0.5)*0.0008).toFixed(4);
    const lon = (11.9014 + (Math.random()-0.5)*0.0008).toFixed(4);
    document.getElementById('lat').textContent = lat;
    document.getElementById('lon').textContent = lon;
  }, 1500);

  // gsm signal flicker
  const gsmStates = ['▮▮▮▮▯','▮▮▮▯▯','▮▮▮▮▮','▮▮▯▯▯'];
  setInterval(()=>{
    document.getElementById('gsm').textContent = gsmStates[Math.floor(Math.random()*gsmStates.length)];
  }, 2000);

  // sats flicker
  setInterval(()=>{
    document.getElementById('sats').textContent = 9 + Math.floor(Math.random()*4);
  }, 3000);

  // radar sweep
  let sweepAngle = 0;
  const sweep = document.getElementById('sweep');
  function radarLoop(){
    sweepAngle = (sweepAngle + 2) % 360;
    sweep.setAttribute('transform', `rotate(${sweepAngle} 50 50)`);
    const b1 = document.getElementById('blip1');
    const b2 = document.getElementById('blip2');
    b1.style.opacity = (Math.sin(sweepAngle*0.0349)*0.5+0.5);
    b2.style.opacity = (Math.cos(sweepAngle*0.0349)*0.5+0.5);
    requestAnimationFrame(radarLoop);
  }
  radarLoop();

  // terminal feed
  const feedLines = [
    'scanning environment...',
    'new access point logged // MAC: 4A:2F:...',
    'cell tower detected // MCC:262 MNC:02',
    'gps track segment saved [1.4km]',
    'air quality sample // PM2.5: 8µg/m³',
    'uploading to wigle.net... done',
    'fog cleared // +0.3 km²',
    'sync openstreetmap... 3 nodes added',
    'awaiting next vector...',
    'the grid remembers.',
  ];
  let fi = 0, ci = 0;
  const ft = document.getElementById('feed-text');
  function typeFeed(){
    if(fi >= feedLines.length) fi = 0;
    const line = feedLines[fi];
    if(ci < line.length){
      ft.textContent = line.slice(0, ci+1);
      ci++;
      setTimeout(typeFeed, 35 + Math.random()*40);
    } else {
      ci = 0; fi++;
      setTimeout(typeFeed, 2500);
    }
  }
  typeFeed();
}
}
