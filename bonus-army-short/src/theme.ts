// Design tokens — the brief's authoritative palette (a refined, desaturated
// register of the reference; see reference-analysis.md §4). Only paper, yellow
// and red carry colour; all imagery is B&W.
export const PAPER = "#F3EEE3"; // warm paper
export const PAPER_DEEP = "#E9E1D0"; // shadowed paper / grid troughs
export const INK = "#141210"; // near-black ink
export const INK_SOFT = "#3A342C"; // body ink (slightly lifted)
export const MARKER = "#FFE94A"; // highlighter yellow
export const MARKER_DEEP = "#F4D51F"; // marker core / squeak edge
export const RED = "#D9331F"; // the one hot accent
export const RED_DEEP = "#B4260F";

export const GRID = "rgba(20,18,16,0.05)"; // faint grid lines

// Typography stacks (fontsource packages installed; see fonts.ts).
export const FONT_HEAD = "'Playfair Display', Georgia, serif"; // headlines
export const FONT_BODY = "'Libre Franklin', Helvetica, sans-serif"; // labels/UI
export const FONT_SERIF_BODY = "'Libre Caslon Text', Georgia, serif"; // dek/body serif
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace"; // stamps/meta
export const FONT_MARKER = "'Permanent Marker', cursive"; // scribbles
export const FONT_BLACK = "'Special Elite', 'Playfair Display', serif"; // masthead flavour

// 9:16 canvas + copy margins (fractions of the reference, re-flowed vertical).
export const W = 1080;
export const H = 1920;
export const MARGIN = Math.round(W * 0.09); // ≈97px, matches reference left-set copy

export const FPS = 30;
