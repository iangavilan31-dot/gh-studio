// Load fonts via @remotion/fonts (FontFace API) from local woff2 in public/fonts.
// Reliable at low render concurrency; the earlier full-render stalls were fetch
// contention across many concurrent tabs, so the render runs at --concurrency=1.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const F = (name: string) => staticFile(`fonts/${name}`);

type Face = { family: string; file: string; weight: string; style?: string };

const FACES: Face[] = [
  { family: "Playfair Display", file: "playfair-400.woff2", weight: "400" },
  { family: "Playfair Display", file: "playfair-700.woff2", weight: "700" },
  { family: "Playfair Display", file: "playfair-900.woff2", weight: "900" },
  { family: "Playfair Display", file: "playfair-700i.woff2", weight: "700", style: "italic" },
  { family: "Libre Franklin", file: "franklin-400.woff2", weight: "400" },
  { family: "Libre Franklin", file: "franklin-600.woff2", weight: "600" },
  { family: "Libre Franklin", file: "franklin-800.woff2", weight: "800" },
  { family: "Libre Caslon Text", file: "caslon-400.woff2", weight: "400" },
  { family: "Libre Caslon Text", file: "caslon-700.woff2", weight: "700" },
  { family: "IBM Plex Mono", file: "plexmono-400.woff2", weight: "400" },
  { family: "IBM Plex Mono", file: "plexmono-600.woff2", weight: "600" },
  { family: "Permanent Marker", file: "marker-400.woff2", weight: "400" },
  { family: "Special Elite", file: "elite-400.woff2", weight: "400" },
];

FACES.forEach((f) => {
  loadFont({
    family: f.family,
    url: F(f.file),
    weight: f.weight,
    style: f.style ?? "normal",
  }).catch(() => undefined);
});
