// Öffentliches Gesicht bis zum Launch — Material 3 Expressive.
//
// Farbrollen kommen aus der Dynamic-Color-Engine (m3-color.generated.ts,
// erzeugt aus dem Marken-Seed via `npm run tokens`) — hier zur Build-Zeit in
// das selbst-enthaltene HTML interpoliert. Roboto self-hosted über /fonts
// (Middleware gibt /fonts auch im gesperrten Zustand frei; DSGVO: kein
// Google-Fonts-Request). KEIN Hinweis auf /unlock.

import { M3_DARK as T } from "./m3-color.generated";

export function comingSoonHtml(): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>atmrOS — System wird hochgefahren</title>
<style>
  @font-face{font-family:"Roboto";src:url("/fonts/roboto-latin-400-normal.woff2") format("woff2");font-weight:400;font-display:swap}
  @font-face{font-family:"Roboto";src:url("/fonts/roboto-latin-500-normal.woff2") format("woff2");font-weight:500;font-display:swap}
  @font-face{font-family:"Roboto";src:url("/fonts/roboto-latin-700-normal.woff2") format("woff2");font-weight:700;font-display:swap}
  @font-face{font-family:"Roboto";src:url("/fonts/roboto-latin-900-normal.woff2") format("woff2");font-weight:900;font-display:swap}
  :root{
    /* M3-Farbrollen — generiert aus dem Marken-Seed (Dynamic Color, dark) */
    --primary:${T.primary};
    --on-primary:${T.onPrimary};
    --primary-container:${T.primaryContainer};
    --on-primary-container:${T.onPrimaryContainer};
    --secondary:${T.secondary};
    --secondary-container:${T.secondaryContainer};
    --on-secondary-container:${T.onSecondaryContainer};
    --tertiary:${T.tertiary};
    --tertiary-container:${T.tertiaryContainer};
    --surface:${T.surface};
    --surface-container-low:${T.surfaceContainerLow};
    --surface-container:${T.surfaceContainer};
    --surface-container-high:${T.surfaceContainerHigh};
    --on-surface:${T.onSurface};
    --on-surface-variant:${T.onSurfaceVariant};
    --outline:${T.outline};
    --outline-variant:${T.outlineVariant};
    /* M3-Expressive-Motion: federnd mit Überschwung */
    --spring:cubic-bezier(0.34,1.56,0.64,1);
    --emphasized:cubic-bezier(0.2,0,0,1);
    --font:"Roboto","Segoe UI",system-ui,-apple-system,sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%}
  body{
    background:
      radial-gradient(1100px 700px at 82% -12%, color-mix(in srgb, var(--primary-container) 26%, transparent) 0%, transparent 65%),
      radial-gradient(900px 620px at -10% 108%, color-mix(in srgb, var(--tertiary-container) 30%, transparent) 0%, transparent 60%),
      var(--surface);
    color:var(--on-surface);
    font-family:var(--font);
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;overflow-x:hidden;
  }

  /* --- dekorative Expressive-Shapes (8-Petal-Cookie) ---------------------- */
  .shape{position:fixed;pointer-events:none;z-index:0}
  .shape svg{display:block;width:100%;height:100%}
  .shape-a{width:min(46vmin,420px);height:min(46vmin,420px);top:-9%;right:-7%;
    color:var(--primary-container);opacity:.45;animation:spin 80s linear infinite}
  .shape-b{width:min(24vmin,220px);height:min(24vmin,220px);bottom:-6%;left:-4%;
    color:var(--secondary-container);opacity:.55;animation:spin 60s linear infinite reverse}
  @keyframes spin{to{transform:rotate(360deg)}}

  /* --- Layout ------------------------------------------------------------- */
  .wrap{position:relative;z-index:1;width:min(680px,92vw);padding:40px 8px 56px;text-align:center}

  /* Assist-Chip oben */
  .badge{
    display:inline-flex;align-items:center;gap:10px;
    padding:8px 18px;border-radius:999px;
    background:var(--surface-container);
    border:1px solid var(--outline-variant);
    color:var(--on-surface-variant);
    font-size:13px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;
    animation:pop .7s var(--spring) both;
  }
  .badge .dot{width:9px;height:9px;border-radius:50%;background:var(--primary);
    animation:pulse 2s var(--emphasized) infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--primary) 55%, transparent)}
    70%{box-shadow:0 0 0 12px transparent}100%{box-shadow:0 0 0 0 transparent}}

  /* Display-Typo — groß, rund, expressiv */
  h1{
    margin:30px 0 6px;
    font-size:clamp(64px,15vw,124px);
    font-weight:800;letter-spacing:-.03em;line-height:.95;
    animation:pop .8s .06s var(--spring) both;
  }
  h1 .os{color:var(--primary)}
  .headline{
    margin:0 0 34px;font-size:clamp(17px,3.4vw,22px);font-weight:500;
    color:var(--on-surface-variant);
    animation:pop .8s .12s var(--spring) both;
  }

  /* --- Wavy Progress (M3-Expressive-Signature) ---------------------------- */
  .progress{
    width:min(340px,78vw);height:22px;margin:0 auto 40px;position:relative;
    animation:pop .8s .18s var(--spring) both;
  }
  .progress svg{display:block;width:100%;height:100%;overflow:visible}
  .wave{stroke:var(--primary);stroke-width:4.5;stroke-linecap:round;fill:none;
    animation:wave 1.1s linear infinite}
  @keyframes wave{to{transform:translateX(-44px)}}
  .progress .stop{position:absolute;right:-4px;top:50%;width:5px;height:5px;
    border-radius:50%;background:var(--primary);transform:translateY(-50%)}

  /* --- Status als Tonal-Cards --------------------------------------------- */
  .cards{display:flex;flex-direction:column;gap:10px;width:min(440px,88vw);margin:0 auto 36px;text-align:left}
  .card{
    display:flex;align-items:center;gap:14px;
    background:var(--surface-container);
    border-radius:22px;padding:15px 18px;
    animation:pop .7s var(--spring) both;
  }
  .card:nth-child(1){animation-delay:.24s}.card:nth-child(2){animation-delay:.32s}
  .card:nth-child(3){animation-delay:.40s}.card:nth-child(4){animation-delay:.48s}
  .card .lead{flex:0 0 auto;width:14px;height:14px;background:var(--secondary)}
  .card.run .lead{background:var(--primary);animation:morph 2.6s var(--emphasized) infinite}
  .card .lead{border-radius:5px}
  @keyframes morph{0%,100%{border-radius:5px;transform:rotate(0)}50%{border-radius:50%;transform:rotate(90deg)}}
  .card .txt{flex:1;font-size:15px;font-weight:500}
  .card .state{
    flex:0 0 auto;font-size:12px;font-weight:700;letter-spacing:.03em;
    padding:5px 13px;border-radius:999px;
    background:var(--secondary-container);color:var(--on-secondary-container);
  }
  .card.run .state{background:var(--primary-container);color:var(--on-primary-container)}
  .card.lock .state{background:var(--surface-container-high);color:var(--on-surface-variant)}
  .card.lock .lead{background:var(--outline)}

  /* --- Chips statt Ticker -------------------------------------------------- */
  .chips{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;width:min(560px,90vw);
    margin:0 auto 34px;animation:pop .7s .56s var(--spring) both}
  .chip{
    padding:8px 17px;border-radius:999px;font-size:13.5px;font-weight:500;
    color:var(--on-surface-variant);border:1px solid var(--outline-variant);
    background:transparent;
  }
  .chip.hot{background:var(--primary-container);color:var(--on-primary-container);border-color:transparent;font-weight:600}

  .foot{font-size:13.5px;color:var(--on-surface-variant);
    animation:pop .7s .64s var(--spring) both}
  .foot .src{color:var(--primary);font-weight:600}

  @keyframes pop{from{opacity:0;transform:translateY(26px) scale(.94)}
    to{opacity:1;transform:none}}

  /* Schmale Screens: Badge kompakter (sonst breiter als der Viewport) */
  @media(max-width:480px){
    .badge{font-size:11px;letter-spacing:.05em;padding:7px 14px}
    .card{padding:13px 15px;border-radius:19px}
    .card .txt{font-size:14px}
  }

  @media(prefers-reduced-motion:reduce){
    *{animation:none !important}
  }
</style>
</head>
<body>
  <!-- 8-Petal-Cookie-Shapes (M3 Expressive), langsam rotierend -->
  <div class="shape shape-a" aria-hidden="true"><svg viewBox="0 0 200 200">
    <path fill="currentColor" d="M160,100 Q190.5,137.5 142.4,142.4 Q137.5,190.5 100,160 Q62.5,190.5 57.6,142.4 Q9.5,137.5 40,100 Q9.5,62.5 57.6,57.6 Q62.5,9.5 100,40 Q137.5,9.5 142.4,57.6 Q190.5,62.5 160,100 Z"/>
  </svg></div>
  <div class="shape shape-b" aria-hidden="true"><svg viewBox="0 0 200 200">
    <path fill="currentColor" d="M160,100 Q190.5,137.5 142.4,142.4 Q137.5,190.5 100,160 Q62.5,190.5 57.6,142.4 Q9.5,137.5 40,100 Q9.5,62.5 57.6,57.6 Q62.5,9.5 100,40 Q137.5,9.5 142.4,57.6 Q190.5,62.5 160,100 Z"/>
  </svg></div>

  <main class="wrap">
    <span class="badge"><span class="dot"></span>MultaEnhavo · Infrastruktur-Index</span>

    <h1>atmr<span class="os">OS</span></h1>
    <p class="headline">System wird hochgefahren</p>

    <!-- Wavy Progress: Sinuswelle, endlos nach links laufend -->
    <div class="progress" role="progressbar" aria-label="System wird hochgefahren">
      <svg viewBox="0 0 340 22" preserveAspectRatio="none" aria-hidden="true">
        <g clip-path="url(#pclip)">
          <path class="wave" d="M-44,11 Q-33,2 -22,11 Q-11,20 0,11 Q11,2 22,11 Q33,20 44,11 Q55,2 66,11 Q77,20 88,11 Q99,2 110,11 Q121,20 132,11 Q143,2 154,11 Q165,20 176,11 Q187,2 198,11 Q209,20 220,11 Q231,2 242,11 Q253,20 264,11 Q275,2 286,11 Q297,20 308,11 Q319,2 330,11 Q341,20 352,11 Q363,2 374,11 Q385,20 396,11"/>
        </g>
        <clipPath id="pclip"><rect x="0" y="-6" width="332" height="34"/></clipPath>
      </svg>
      <span class="stop" aria-hidden="true"></span>
    </div>

    <div class="cards">
      <div class="card"><span class="lead"></span><span class="txt">Geodatenquellen verschmelzen</span><span class="state">bereit</span></div>
      <div class="card run"><span class="lead"></span><span class="txt">Infrastruktur Bayern indizieren</span><span class="state">läuft</span></div>
      <div class="card run"><span class="lead"></span><span class="txt">Profiler kalibrieren</span><span class="state">läuft</span></div>
      <div class="card lock"><span class="lead"></span><span class="txt">Öffentlicher Zugang</span><span class="state">gesperrt</span></div>
    </div>

    <div class="chips" aria-hidden="true">
      <span class="chip hot">Sendemasten</span>
      <span class="chip">Stromnetz</span>
      <span class="chip">Umspannwerke</span>
      <span class="chip hot">Ladesäulen</span>
      <span class="chip">Überwachung</span>
      <span class="chip">Tankstellen</span>
    </div>

    <p class="foot">Das ehrliche ctOS — <span class="src">jede Anzeige trägt ihre Quelle.</span></p>
  </main>
</body>
</html>`;
}
