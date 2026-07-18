// Register @font-face for every family via fontsource CSS side-effects, then
// block the render until the glyphs are actually rasterised. Importing this
// module once (from Root) is enough.
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/playfair-display/700-italic.css";
import "@fontsource/libre-franklin/400.css";
import "@fontsource/libre-franklin/600.css";
import "@fontsource/libre-franklin/800.css";
import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/permanent-marker/400.css";
import "@fontsource/special-elite/400.css";
import { continueRender, delayRender } from "remotion";

const FAMILIES: Array<[string, string]> = [
  ["700 84px", "Playfair Display"],
  ["900 84px", "Playfair Display"],
  ["italic 700 84px", "Playfair Display"],
  ["600 40px", "Libre Franklin"],
  ["800 40px", "Libre Franklin"],
  ["700 40px", "Libre Caslon Text"],
  ["600 40px", "IBM Plex Mono"],
  ["400 40px", "Permanent Marker"],
  ["400 40px", "Special Elite"],
];

const handle = delayRender("Loading newspaper fonts");
if (typeof document !== "undefined" && (document as Document).fonts) {
  Promise.all(FAMILIES.map(([spec, fam]) => document.fonts.load(`${spec} "${fam}"`)))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
} else {
  continueRender(handle);
}
