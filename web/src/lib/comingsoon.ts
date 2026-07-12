// Öffentliches Gesicht bis zum Launch. Voll selbst-enthalten (inline CSS, keine
// externen Assets, keine /_astro-Abhängigkeit) — die Middleware liefert genau
// dieses HTML für jeden gesperrten Request. KEIN Hinweis auf /unlock.

export function comingSoonHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>atmrOS — SYSTEM WIRD HOCHGEFAHREN</title>
<style>
  :root{
    --pink:#e31c8d;--bg:#08090c;--bg2:#0e1116;--line:#20242d;
    --t0:#e8ecf2;--t1:#aab2bf;--t2:#5b6370;
    --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    background:
      radial-gradient(1200px 600px at 50% -10%, #12161d 0%, var(--bg) 60%),
      var(--bg);
    color:var(--t0);font-family:var(--mono);overflow:hidden;
    display:flex;align-items:center;justify-content:center;min-height:100vh;
  }
  /* dezentes Grid im Hintergrund */
  body::before{
    content:"";position:fixed;inset:0;pointer-events:none;opacity:.35;
    background-image:
      linear-gradient(var(--line) 1px,transparent 1px),
      linear-gradient(90deg,var(--line) 1px,transparent 1px);
    background-size:44px 44px;
    -webkit-mask-image:radial-gradient(circle at 50% 40%,#000 0%,transparent 75%);
            mask-image:radial-gradient(circle at 50% 40%,#000 0%,transparent 75%);
  }
  .wrap{position:relative;z-index:1;width:min(720px,92vw);text-align:center;padding:24px}
  .badge{
    display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.18em;
    color:var(--pink);border:1px solid var(--line);border-radius:999px;padding:6px 12px;
    text-transform:uppercase;
  }
  .badge .dot{width:7px;height:7px;border-radius:50%;background:var(--pink);
    box-shadow:0 0 0 0 rgba(227,28,141,.6);animation:pulse 1.8s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(227,28,141,.55)}
    70%{box-shadow:0 0 0 10px rgba(227,28,141,0)}100%{box-shadow:0 0 0 0 rgba(227,28,141,0)}}
  h1{font-size:clamp(30px,7vw,64px);letter-spacing:.02em;margin:22px 0 6px;font-weight:800}
  h1 .os{color:var(--pink)}
  .status{font-size:clamp(12px,2.6vw,15px);color:var(--t1);letter-spacing:.32em;margin:0 0 26px}
  .status .cursor{display:inline-block;width:9px;height:1.1em;background:var(--pink);
    margin-left:4px;vertical-align:-2px;animation:blink 1.05s step-end infinite}
  @keyframes blink{50%{opacity:0}}
  .bar{height:3px;background:var(--bg2);border:1px solid var(--line);border-radius:999px;overflow:hidden;margin:0 auto;width:min(420px,80vw)}
  .bar i{display:block;height:100%;width:38%;background:linear-gradient(90deg,transparent,var(--pink),transparent);
    animation:scan 2.6s linear infinite}
  @keyframes scan{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}
  .lines{margin:26px auto 0;max-width:520px;text-align:left;color:var(--t2);font-size:12px;line-height:1.9}
  .lines b{color:var(--t1);font-weight:400}
  .ticker{position:fixed;left:0;right:0;bottom:0;z-index:2;border-top:1px solid var(--line);
    background:rgba(8,9,12,.85);backdrop-filter:blur(6px);overflow:hidden;white-space:nowrap}
  .ticker .track{display:inline-block;padding:9px 0;font-size:11px;letter-spacing:.22em;
    color:var(--t2);animation:marquee 26s linear infinite}
  .ticker .track span{margin:0 26px}
  .ticker .hz{color:var(--pink)}
  @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  .foot{margin-top:22px;font-size:11px;color:var(--t2);letter-spacing:.12em}
  @media(prefers-reduced-motion:reduce){
    .badge .dot,.bar i,.status .cursor,.ticker .track{animation:none}
  }
</style>
</head>
<body>
  <main class="wrap">
    <span class="badge"><span class="dot"></span>MULTAENHAVO · INFRASTRUKTUR-INDEX</span>
    <h1>atmr<span class="os">OS</span></h1>
    <p class="status">SYSTEM WIRD HOCHGEFAHREN<span class="cursor"></span></p>
    <div class="bar"><i></i></div>
    <div class="lines">
      <div>&gt; verschmelze Geodatenquellen … <b>bereit</b></div>
      <div>&gt; indiziere Infrastruktur Bayern … <b>läuft</b></div>
      <div>&gt; kalibriere Profiler … <b>läuft</b></div>
      <div>&gt; öffentlicher Zugang … <b>gesperrt</b></div>
    </div>
    <div class="foot">Das ehrliche ctOS. Jede Anzeige trägt ihre Quelle.</div>
  </main>
  <div class="ticker"><div class="track">
    <span class="hz">// ACHTUNG</span><span>ZUGANG BESCHRÄNKT</span>
    <span>SENDEMASTEN</span><span>STROMNETZ</span><span>UMSPANNWERKE</span>
    <span>LADESÄULEN</span><span class="hz">// SYSTEM OFFLINE</span>
    <span>SENSORIK KALIBRIERT</span><span>ARCHIV VERSIEGELT</span>
    <span class="hz">// ACHTUNG</span><span>ZUGANG BESCHRÄNKT</span>
    <span>SENDEMASTEN</span><span>STROMNETZ</span><span>UMSPANNWERKE</span>
    <span>LADESÄULEN</span><span class="hz">// SYSTEM OFFLINE</span>
    <span>SENSORIK KALIBRIERT</span><span>ARCHIV VERSIEGELT</span>
  </div></div>
</body>
</html>`;
}
