// @material/web — selektiv geladene M3-Primitives (Web Components).
//
// Nur importieren, was wir wirklich nutzen (Bundle-Größe). Die Komponenten
// lesen die --md-sys-color-*-Tokens direkt — unsere Dynamic-Color-Engine
// (m3-color.generated.css) liefert exakt diese Namen, Theming ist damit
// automatisch. Hinweis: @material/web ist M3 classic im Maintenance-Mode;
// Expressive-Schicht (Shapes/Motion/wavy progress) liegt in m3e.ts/expressive.css.

import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/chips/chip-set.js";
import "@material/web/chips/filter-chip.js";
import "@material/web/chips/assist-chip.js";
import "@material/web/textfield/filled-text-field.js";
import "@material/web/dialog/dialog.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/progress/circular-progress.js";
