// M3-Expressive-Bausteine, die @material/web nicht liefert — als
// wiederverwendbare SVG-/Markup-Snippets. Genutzt von der Coming-soon-Seite
// und (ab Phase 3) vom Kern-UI. Styles dazu: styles/expressive.css.

/** 8-Petal-"Cookie"-Shape (Expressive-Formsprache). viewBox 0 0 200 200. */
export const PETAL_PATH =
  "M160,100 Q190.5,137.5 142.4,142.4 Q137.5,190.5 100,160 Q62.5,190.5 57.6,142.4 " +
  "Q9.5,137.5 40,100 Q9.5,62.5 57.6,57.6 Q62.5,9.5 100,40 Q137.5,9.5 142.4,57.6 " +
  "Q190.5,62.5 160,100 Z";

export function petalSvg(cssClass = ""): string {
  return `<svg viewBox="0 0 200 200"${cssClass ? ` class="${cssClass}"` : ""} aria-hidden="true">` +
    `<path fill="currentColor" d="${PETAL_PATH}"/></svg>`;
}

/** Wavy-Progress (M3E-Signature): endlos laufende Sinuswelle + Stop-Punkt.
    Breite/Höhe über CSS des Containers (.m3e-progress). */
export function wavySvg(): string {
  // Wellenlänge 44px, Amplitude 9px, genug Überlänge für die Loop-Animation.
  let d = "M-44,11";
  for (let x = -44; x <= 396; x += 44) {
    d += ` Q${x + 11},2 ${x + 22},11 Q${x + 33},20 ${x + 44},11`;
  }
  return (
    `<svg viewBox="0 0 340 22" preserveAspectRatio="none" aria-hidden="true">` +
    `<g clip-path="url(#m3e-wave-clip)"><path class="m3e-wave" d="${d}"/></g>` +
    `<clipPath id="m3e-wave-clip"><rect x="0" y="-6" width="332" height="34"/></clipPath>` +
    `</svg><span class="m3e-wave-stop" aria-hidden="true"></span>`
  );
}
