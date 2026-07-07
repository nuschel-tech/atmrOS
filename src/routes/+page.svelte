<script lang="ts">
  import { onMount } from 'svelte';
  import { initHud } from '$lib/hud';
  import '$lib/hud.css';

  onMount(() => {
    // Boot sequence + animated HUD. Client-only, runs once after mount.
    initHud();
  });
</script>

<svelte:head>
  <title>atmrOS // SYSTEM BOOT</title>
</svelte:head>

<div id="boot"></div>

<!-- CURSOR -->
<div id="cur"></div>

<!-- CANVAS LAYERS -->
<canvas id="grid-canvas"></canvas>
<canvas id="particle-canvas"></canvas>

<!-- CRT EFFECTS -->
<div id="crt"></div>
<div id="vignette"></div>
<div id="flicker"></div>

<!-- MAIN UI -->
<div id="ui">

  <div class="bracket b-tl"></div>
  <div class="bracket b-tr"></div>
  <div class="bracket b-bl"></div>
  <div class="bracket b-br"></div>

  <div id="topbar">
    <span class="tb-item"><span class="dot"></span>SYSTEM ONLINE</span>
    <span class="tb-sep"></span>
    <span class="tb-item" id="tb-time">--:--:--</span>
    <span class="tb-sep"></span>
    <span class="tb-item pink">atomar.org</span>
    <span class="tb-sep"></span>
    <span class="tb-item" id="tb-node">NODE//0001</span>
  </div>

  <!-- LEFT PANEL -->
  <div class="panel" id="panel-left">
    <div class="panel-title">// GEO_LOCK</div>
    <div class="panel-row"><span class="k">LAT</span><span class="v cyan" id="lat">48.2891</span></div>
    <div class="panel-row"><span class="k">LON</span><span class="v cyan" id="lon">11.9014</span></div>
    <div class="panel-row"><span class="k">REGION</span><span class="v">BAYERN_DE</span></div>
    <div class="panel-row"><span class="k">SATS</span><span class="v green" id="sats">11</span></div>
    <div style="height:1.2rem"></div>
    <div class="panel-title">// SIGNAL</div>
    <div class="panel-row"><span class="k">GSM</span><span class="v amber" id="gsm">▮▮▮▮▯</span></div>
    <div class="panel-row"><span class="k">WIFI</span><span class="v green" id="wifi">SCAN</span></div>
    <div class="panel-row"><span class="k">UPLINK</span><span class="v green">ACTIVE</span></div>
  </div>

  <!-- RIGHT PANEL -->
  <div class="panel" id="panel-right">
    <div class="panel-title">// DATA_STREAM</div>
    <div class="panel-row"><span class="v pink" id="pkts">00000</span><span class="k">PACKETS</span></div>
    <div class="panel-row"><span class="v" id="nodes">0</span><span class="k">NODES</span></div>
    <div class="panel-row"><span class="v cyan" id="area">0.0</span><span class="k">KM² MAPPED</span></div>
    <div style="height:1.2rem"></div>
    <div class="panel-title">// SOURCES</div>
    <div class="panel-row"><span class="v green">SYNC</span><span class="k">OSM</span></div>
    <div class="panel-row"><span class="v green">SYNC</span><span class="k">WIGLE</span></div>
    <div class="panel-row"><span class="v amber">WAIT</span><span class="k">OPENCELLID</span></div>
  </div>

  <!-- CENTER -->
  <div id="center">
    <div class="sys-tag">// SYSTEM INITIALIZING</div>
    <div id="logo" data-text="atmrOS"><span class="lower">atmr</span><span class="os">OS</span></div>
    <div class="subtitle">Real World · Open Data · Community Grid</div>
    <div class="divider-row">
      <div class="line"></div>
      <div class="label">Coming Soon</div>
      <div class="line"></div>
    </div>
    <div id="feed"><span class="prompt">root@atmros:~$</span> <span id="feed-text"></span><span class="blink">█</span></div>
  </div>

  <!-- RADAR -->
  <svg id="radar" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(227,28,141,0.2)" stroke-width="0.5"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(227,28,141,0.15)" stroke-width="0.5"/>
    <circle cx="50" cy="50" r="16" fill="none" stroke="rgba(227,28,141,0.15)" stroke-width="0.5"/>
    <line x1="50" y1="2" x2="50" y2="98" stroke="rgba(227,28,141,0.1)" stroke-width="0.5"/>
    <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(227,28,141,0.1)" stroke-width="0.5"/>
    <line id="sweep" x1="50" y1="50" x2="50" y2="2" stroke="var(--pink)" stroke-width="1"/>
    <circle id="blip1" cx="68" cy="32" r="1.5" fill="var(--cyan)"/>
    <circle id="blip2" cx="34" cy="60" r="1.5" fill="var(--green)"/>
  </svg>

  <!-- PROGRESS -->
  <div id="progress-wrap">
    <div class="prog-head"><span>SYSTEM_BUILD</span><span class="pct">61%</span></div>
    <div class="prog-track"><div class="prog-fill"></div></div>
  </div>

  <!-- BOTTOM -->
  <div id="bottombar">
    <span class="item"><span class="hl">atmrOS</span> v0.1.0-alpha</span>
    <span class="item">// A <span class="hl">MULTAENHAVO</span> PROJECT</span>
    <span class="item">© 2026 · MULTAENHAVO · NICO THOMAS HENKEL</span>
  </div>

</div>
