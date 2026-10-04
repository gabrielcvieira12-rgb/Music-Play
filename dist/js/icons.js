// ============================================================
// Biblioteca de ícones — estilo Aero (brilho gelatinoso)
// Baseada nos gradientes do AldenOS (icons.jsx).
//
//   icone("home")        -> string SVG (use em templates HTML)
//   instalarIcones()     -> injeta os gradientes e troca todo
//                           <span data-icon="home"> pelo SVG
//
// O logo do app NÃO está aqui: ele é a imagem em /images.
// ============================================================

const DEFS = `
<svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
  <defs>
    <radialGradient id="ao_blue" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="32%" stop-color="#9fe2ff"/>
      <stop offset="78%" stop-color="#1a6fc8"/><stop offset="100%" stop-color="#062a5e"/>
    </radialGradient>
    <radialGradient id="ao_cyan" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#a8eaff"/>
      <stop offset="75%" stop-color="#2bb6d6"/><stop offset="100%" stop-color="#0c5a78"/>
    </radialGradient>
    <radialGradient id="ao_green" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#c4f08e"/>
      <stop offset="75%" stop-color="#5cb04a"/><stop offset="100%" stop-color="#1a5e1a"/>
    </radialGradient>
    <radialGradient id="ao_orange" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#ffd9a8"/>
      <stop offset="75%" stop-color="#ff8c2a"/><stop offset="100%" stop-color="#a04510"/>
    </radialGradient>
    <radialGradient id="ao_yellow" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="30%" stop-color="#fff6c0"/>
      <stop offset="75%" stop-color="#ffce4a"/><stop offset="100%" stop-color="#b07c00"/>
    </radialGradient>
    <radialGradient id="ao_red" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#ffc4be"/>
      <stop offset="75%" stop-color="#e64646"/><stop offset="100%" stop-color="#7a0a0a"/>
    </radialGradient>
    <radialGradient id="ao_pink" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#ffd6ea"/>
      <stop offset="75%" stop-color="#ff7ab8"/><stop offset="100%" stop-color="#a01e6e"/>
    </radialGradient>
    <radialGradient id="ao_purple" cx="35%" cy="28%" r="85%">
      <stop offset="0%" stop-color="#fff"/><stop offset="35%" stop-color="#d8c4ff"/>
      <stop offset="75%" stop-color="#7a4ad8"/><stop offset="100%" stop-color="#2a0a78"/>
    </radialGradient>
    <linearGradient id="ao_fold_back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a5e0ff"/><stop offset="50%" stop-color="#5cb6ee"/>
      <stop offset="100%" stop-color="#1a6fc8"/>
    </linearGradient>
    <linearGradient id="ao_fold_front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6cc4ff"/><stop offset="50%" stop-color="#2389e8"/>
      <stop offset="100%" stop-color="#0a4a8c"/>
    </linearGradient>
  </defs>
</svg>`;

// reflexo branco (mesmo "Gloss" do AldenOS)
const gloss = (cx, cy, rx, ry, op = 0.55, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ""}/>`;

// ---- Ícones coloridos (viewBox 64x64) ----
const COLORIDOS = {
  home: `
    <path d="M32 7 3 32h8v22h14V38h14v16h14V32h8z" fill="url(#ao_blue)" stroke="#06407e" stroke-width="1.5" stroke-linejoin="round"/>
    ${gloss(26, 22, 14, 5, 0.5, -28)}`,
  search: `
    <circle cx="26" cy="26" r="18" fill="url(#ao_cyan)" stroke="#0c5a78" stroke-width="2"/>
    <circle cx="26" cy="26" r="12" fill="#fff" opacity="0.28"/>
    <path d="m40 40 18 18" stroke="#0c5a78" stroke-width="8" stroke-linecap="round"/>
    <path d="m40 40 18 18" stroke="url(#ao_orange)" stroke-width="4.5" stroke-linecap="round"/>
    ${gloss(20, 17, 8, 4, 0.7, -35)}`,
  folder: `
    <path d="M4 14q0-4 4-4h16l6 7h26q4 0 4 4v31q0 4-4 4H8q-4 0-4-4z" fill="url(#ao_fold_back)" stroke="#0a4a8c" stroke-width="1.5"/>
    <path d="M4 26q0-3 4-3h48q4 0 4 3v25q0 4-4 4H8q-4 0-4-4z" fill="url(#ao_fold_front)" stroke="#0a4a8c" stroke-width="1.5"/>
    ${gloss(30, 29, 24, 3.5, 0.55)}`,
  gear: `
    ${[0,45,90,135].map(r=>`<rect x="26" y="3" width="12" height="58" rx="4" transform="rotate(${r} 32 32)" fill="url(#ao_cyan)" stroke="#0c5a78" stroke-width="1.5"/>`).join("")}
    <circle cx="32" cy="32" r="19" fill="url(#ao_cyan)" stroke="#0c5a78" stroke-width="1.8"/>
    <circle cx="32" cy="32" r="8" fill="#e8f8ff" stroke="#0c5a78" stroke-width="2"/>
    ${gloss(25, 21, 11, 4, 0.55, -25)}`,
  logout: `
    <path d="M8 6h24v8H16v36h16v8H8z" fill="url(#ao_red)" stroke="#7a0a0a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M30 24h14v-10l18 18-18 18V40H30z" fill="url(#ao_orange)" stroke="#a04510" stroke-width="1.5" stroke-linejoin="round"/>
    ${gloss(46, 24, 10, 3, 0.6, 40)}`,
  volume: `
    <path d="M6 24h10l14-12v40L16 40H6z" fill="url(#ao_blue)" stroke="#06407e" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M38 22q8 10 0 20M45 14q15 18 0 36" fill="none" stroke="url(#ao_cyan)" stroke-width="4.5" stroke-linecap="round"/>
    ${gloss(18, 20, 8, 3, 0.6, -20)}`,
  "volume-off": `
    <path d="M6 24h10l14-12v40L16 40H6z" fill="url(#ao_blue)" stroke="#06407e" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="m40 24 16 16m0-16L40 40" stroke="url(#ao_red)" stroke-width="5" stroke-linecap="round"/>
    ${gloss(18, 20, 8, 3, 0.6, -20)}`,
  clock: `
    <circle cx="32" cy="32" r="27" fill="url(#ao_blue)" stroke="#06407e" stroke-width="2"/>
    <circle cx="32" cy="32" r="21" fill="#f4fbff" opacity="0.92"/>
    <path d="M32 18v15l10 6" fill="none" stroke="#0a4a8c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${gloss(24, 14, 14, 5, 0.6, -20)}`,
  music: `
    <path d="M22 8 54 2v10L32 17v31z" fill="url(#ao_purple)" stroke="#2a0a78" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse cx="20" cy="49" rx="12" ry="9" fill="url(#ao_blue)" stroke="#06407e" stroke-width="1.5"/>
    <ellipse cx="46" cy="42" rx="10" ry="8" fill="url(#ao_blue)" stroke="#06407e" stroke-width="1.5"/>
    <path d="M54 12v30" stroke="#2a0a78" stroke-width="4"/>
    ${gloss(17, 46, 6, 3, 0.65, -20)}`,
  "heart-on": `
    <path d="M32 58C10 42 4 30 4 21 4 12 11 6 19 6c6 0 10 3 13 8 3-5 7-8 13-8 8 0 15 6 15 15 0 9-6 21-28 37z" fill="url(#ao_pink)" stroke="#a01e6e" stroke-width="2" stroke-linejoin="round"/>
    ${gloss(20, 20, 9, 5, 0.7, -35)}`,
};

// ---- Ícones simples (herdam a cor do texto) ----
const SIMPLES = {
  play: `<path d="M18 10v44l38-22z" fill="currentColor"/>`,
  pause: `<rect x="14" y="10" width="13" height="44" rx="3" fill="currentColor"/><rect x="37" y="10" width="13" height="44" rx="3" fill="currentColor"/>`,
  prev: `<rect x="10" y="12" width="8" height="40" rx="2" fill="currentColor"/><path d="M54 12v40L22 32z" fill="currentColor"/>`,
  next: `<rect x="46" y="12" width="8" height="40" rx="2" fill="currentColor"/><path d="M10 12v40l32-20z" fill="currentColor"/>`,
  heart: `<path d="M32 56C12 41 6 30 6 22 6 14 12 8 20 8c5 0 9 3 12 7 3-4 7-7 12-7 8 0 14 6 14 14 0 8-6 19-26 34z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>`,
  edit: `<path d="m10 54 4-14L42 12l10 10-28 28z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m36 18 10 10" stroke="currentColor" stroke-width="5"/>`,
  trash: `<path d="M12 16h40M24 16V8h16v8M16 16l3 40h26l3-40M27 26v22M37 26v22" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="m14 14 36 36m0-36L14 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  "chevron-left": `<path d="m40 10-22 22 22 22" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  "chevron-right": `<path d="m24 10 22 22-22 22" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<path d="M32 10v44M10 32h44" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
};

/** Devolve o SVG do ícone como texto. */
export function icone(nome) {
  const corpo = COLORIDOS[nome] ?? SIMPLES[nome];
  if (!corpo) return "";
  const colorido = nome in COLORIDOS;
  return `<svg class="aero-icon${colorido ? " aero-color" : ""}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${corpo}</svg>`;
}

/** Injeta os gradientes (uma vez) e troca todo [data-icon] pelo SVG. */
export function instalarIcones(raiz = document) {
  if (!document.getElementById("ao_blue")) {
    document.body.insertAdjacentHTML("afterbegin", DEFS);
  }
  raiz.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icone(el.dataset.icon);
  });
}
