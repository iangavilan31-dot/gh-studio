# Reference analysis — Gate 1

Target look: **0:03–0:13 of `youtube.com/watch?v=qjafHzNJLQ0`**
— *"News Paper Animation like @Vox @johnnyharris in Premiere Pro"* by **Flick Edit**
(6:00 tutorial; the 0:03–0:13 window is the finished-result showcase the tutorial
opens with). This document is the motion/design bible that `<NewspaperScene>`'s
default behaviour encodes; every beat component restyles to sit inside it.

---

## 0. Methodology & source integrity (read this first)

**What I could extract (real reference pixels):**
- `reference/raw/thumb.png` — the 1280×720 poster frame. It is the *same* Musk /
  NYT composition the demo builds to, rendered crisply. Every colour, treatment,
  and proportion below is sampled from it with `PIL`/`numpy` (numbers are real,
  not eyeballed).
- `reference/raw/sheets/sheet_00.jpeg` — YouTube L2 storyboard sheet (960×540,
  6×6 grid of 160×90 tiles, ≈1.1 s per tile). Tiles extracted to
  `reference/frames/`. The first three tiles of the video are exactly the
  0:03–0:13 build-up: **`t00`** clean NYT layout on white → **`t01`** the same
  story re-laid on kraft paper (bare) → **`t02`** punched-in, highlighted, with
  the cut-out subject. `reference/frames/contact_sheet.png` stacks them.

**What I could NOT extract, and why (documented honestly):**
Full 1080p / every-2-frames extraction was **not possible in this container**.
The media (`googlevideo.com`) is IP-locked to the request IP, but this session's
egress proxy presents a non-routable ULA (`ip=fda3:e722:…`) for the player-API
call while media fetches leave over a rotating IPv4 pool (`160.79.106.0/24`), so
every signed URL 403s — even with the `n`-challenge solved (deno EJS) and a valid
GVS **PO token** minted (bgutil provider, patched to axios 1.16.1 for the proxy).
`ipbypass=yes` in the redirect does not rescue it. All third-party proxies
(cobalt, Piped, Invidious — ~15 instances) are behind YouTube's
"sign in to confirm you're not a bot" wall. This is an environment limit, not a
tooling gap; it is fully reproducible.

**Consequence for the build:** sub-second *motion curves* cannot be frame-tracked
off a 1.1 s storyboard. They are therefore grounded in (a) the two real build-up
states visible (`t01` bare → `t02` punched-in + highlighted), which fix the
*direction and endpoints* of the motion, and (b) the follow-up brief's explicit
motion grammar (which numbers every move). During the build I validate against the
real frames I DO have: `t02` is the truth for the headline punch-in framing, the
thumbnail is the truth for the final built composition, colour and treatment.
If the source `.mp4` (or YouTube cookies) is dropped into `reference/raw/`, the
`extract-frames` step re-runs and I upgrade motion numbers to tracked values.

---

## 1. What the reference IS (decoded)

A single **newspaper story** ("Elon Musk, Eyeing Edge for Trump, Hires Republican
Political Adviser", NYT, Aug 29 2024) is dramatised in ~10 s as animated motion
graphics:

1. **Clean state** (`t00`): the story as a real NYT web clipping on near-white,
   masthead top, headline, dek, a B&W photo. ~1 beat.
2. **Kraft restyle** (`t01`): hard cut — same story re-composited on **warm kraft
   paper with a faint grid**, a **red date tag** pinned top-left, headline as big
   black serif, dek beneath, **NYT blackletter masthead** bottom-right over a rule.
3. **Emphasis + punch-in** (`t02` + thumbnail): camera **punches into the
   headline** (t02 is visibly enlarged and right-cropped vs the wide comp); a
   **torn-edge yellow marker** wipes across the headline and a dek phrase; the
   **B&W cut-out of Musk** slams in bottom-centre-right with a **red offset
   outline**. This built-up frame == the thumbnail.

That three-state grammar — *clean → kraft restyle → punch-in + highlight + cut-out
slam* — is the atom the whole short repeats, beat after beat.

---

## 2. Layer stack (z-order, bottom → top)

| z | layer | notes |
|---|-------|-------|
| 0 | **Paper** fill `#F3EEE3` (brief) / sampled kraft `#E1D9BC` | flat, warm |
| 1 | **Faint grid** | ~square cells, extremely low contrast (paper σ≈8/255) |
| 2 | **Marker highlight** strokes | yellow, torn edges, sits *under* the ink |
| 3 | **Newspaper text block** | date tag · headline · dek · rule · masthead |
| 4 | **Subject cut-out** | red offset shape (behind) + B&W cut-out (front) |
| 5 | **Grain + gate-weave + vignette** | global, 6–10 %, over everything |

Marker is **below** the glyphs (highlighter, text stays crisp black on yellow).
Cut-out is **above** the text (Musk overlaps the dek and rule). Grain is global.

---

## 3. Composition & layout (measured on the 1280×720 thumbnail)

Normalised (fraction of frame). The short is **vertical 1080×1920**, so these are
*proportions/relationships*, re-flowed into the 9:16 safe area, not literal xy.

| element | measured (16:9 thumb) | vertical re-flow |
|---|---|---|
| Date tag (red) | x 0.092–0.273, y 0.036–0.113 · **≈4.2:1** box | top-left of copy block, same aspect |
| Headline | 2 lines, y 0.16–0.33, left-set | 2–3 lines, upper third |
| Dek (body) | y ~0.37–0.46, 2 lines | directly under headline |
| Rule + masthead | masthead x 0.69–0.94, y 0.525–0.575, **right-aligned** | rule full width, masthead right |
| Cut-out subject | bottom-centre-right, feet cropped by frame | bottom third, larger |

Copy is **left-aligned** to a margin ≈0.09 of width. Generous top padding above the
date tag. The subject breaks the bottom edge (feet cropped) — never fully inside.

---

## 4. Palette — sampled real values vs. brief's design spec

| role | **sampled from reference** | **brief spec (authoritative for the build)** |
|---|---|---|
| Paper | `#E1D9BC` (warm kraft, mean 225/217/188) | `#F3EEE3` (softer, paler) |
| Ink | `#000000` (pure black headline) | `#141210` (near-black) |
| Marker | `#FDD902` peak (saturated gold) | `#FFE94A` (paler lemon) |
| Red (date tag/accent) | `#EC171B` | `#D9331F` |
| Red offset outline | `#E72E3D` | (= red accent, offset) |
| Cut-out | neutral B&W, jacket grey ~`#807C77` | B&W, histogram-matched |

**Reconciliation:** the reference (a punchy tutorial demo) runs hotter than the
brief. The follow-up brief supersedes on conflict and states the palette
explicitly, so the **build uses `#F3EEE3 / #141210 / #FFE94A / #D9331F`** — a
deliberately more refined, desaturated register that suits a somber 1932 history
piece. Reference values are recorded here so the *relationships* (yellow brighter
than paper, red the only hot accent, ink pure) stay faithful even though absolutes
are toned. Only paper / yellow / red carry colour; all imagery is B&W.

---

## 5. Typography

- **Headline:** high-contrast transitional/Didone serif, tight leading (~1.02),
  left-set, near-black, large (cap height ~0.085 of frame height on 2 lines).
  Brief → **Playfair Display** (or Libre Caslon). Ball terminals + thin hairlines
  read at size; that's the "newspaper" signal.
- **Dek / body:** oldstyle serif, ~0.35× headline, looser leading (~1.25),
  slightly grey vs headline. Brief → serif body (Libre Caslon) for the dek;
  **Libre Franklin** for labels/UI; **IBM Plex Mono** for stamps/metadata.
- **Date tag text:** condensed serif, white, small caps feel, centred in the red box.
- **Masthead:** NYT-style **blackletter**, right-aligned, sitting on the rule.
- **Global stepped rule:** decorative graphics (scribbles/labels/stamps) sample at
  **12 fps** — `Math.floor(frame/2)*2`; camera moves and marker wipes stay smooth.

---

## 6. Per-element treatments

- **Paper + grid:** flat kraft fill, faint square grid (~1 px lines, a few % over
  paper), subtle fibre noise. Very low contrast — presence, not pattern.
- **Date tag:** solid red rounded-corner-ish rectangle, ~4.2:1, white serif date,
  small drop shadow. It's a *pinned label*, not part of the paper.
- **Marker highlight:** hand-torn yellow band, ~1.15× the glyph x-height, wobbling
  top & bottom edges (2–4 px hand jitter), slightly translucent (paper texture
  bleeds through), rounded ends. Wipes **left→right** to reveal, tracking the word.
- **Dek highlight:** same marker on one phrase only ("Mr. Musk, the world's richest
  person,") — selective emphasis, never the whole dek.
- **Rule:** full-width hairline ink line separating body from masthead.
- **Cut-out + red offset:** `rembg`-style B&W silhouette; a duplicate filled solid
  red (`#D9331F`), offset a few px (reference offset reads to the **right/behind**),
  giving the sticker/risograph edge. Feet cropped by the frame bottom.
- **Grain / gate weave:** global film grain 6–10 %, plus a 1–2 px low-freq
  positional "weave" (whole-frame wander) so nothing is locked to pixels.

---

## 7. Motion grammar (the engine of `<NewspaperScene>`)

Endpoints are fixed by the real `t01→t02` states (bare → punched-in + highlighted);
curve *shapes* are the brief's spec. All events fire from **word timestamps**
(`timing.json`), never hardcoded frames.

- **Micro-life (always on):** every layer floats 2–3 px on smoothed noise + a slow
  rotation wander (≤0.3°). The camera is **never** static. This is the baseline the
  storyboard can't show but the look demands.
- **Hard-cut reframe (primary edit):** instant cut to a new scale/position on the
  same artwork (t01 wide → t02 punched-in headline). Something changes every 1–2 s.
- **Punch-in:** 4–6 frame `easeOutExpo`, **2 % overshoot** then spring-settle
  (damping ~14), **1 frame directional blur**, **0.5° rotation kick**, SFX on the
  frame. Never linear, never >8 frames. (This is the t01→t02 move.)
- **Slam-in (headline/labels):** element arrives with a shadow that *tightens*
  (soft→crisp) as it lands + a paper-slap SFX; 5–7 frames.
- **Marker highlight wipe:** yellow torn band wipes L→R **word-by-word**, each word
  triggered **2 frames before** its VO onset; smooth (not stepped); marker-squeak SFX.
- **Cut-out entrance:** slam from just below/behind with the red offset resolving
  last; settles into the micro-life float.
- **One slow glide max per 15–20 s** (e.g. the Anacostia wide) — everything else
  is cuts and punches.
- **Stepped decoratives:** scribbles, stamps, hand labels sample at 12 fps
  (`Math.floor(frame/2)*2`); camera + highlights remain smooth. The
  "too-fast-to-catch" generals stamp = 3 stamps **4 frames apart**.

---

## 8. Event-timing model

`public/timing.json > events` already carries 76 anchors (e.g. `b1.generals`,
`b7.armyCut`, `b11.headline`). Components read them via `ev("b7.armyCut")` /
`beatFrames("b3")`. Rule: **visual event = word onset − 2 frames** for highlights,
**= word onset** for slams/cuts/stamps. No frame integer is ever typed in a comp.

---

## 9. How `<NewspaperScene>` encodes all of this

`<NewspaperScene>` is the paper world + camera + micro-life + grain, exposing a
timeline of {reframe, punchIn, slamIn, highlightWipe, cutOut, glide} keyed to
`timing.json`. Each beat mounts its assets (headline text, cut-out, date tag,
labels) **into** this scene; the scene owns motion character so every beat inherits
the identical punch/slam/float/grain signature. Beats never re-implement motion —
they declare *what* enters and *when* (by event name); the scene decides *how*.

---

## 10. Validation plan (frame-by-frame, during the build)

1. Render `NewspaperScene` with the Musk story as a fixture; overlay against
   `thumb.png` (final built comp) and `t02` (punch-in framing) — match margins,
   date-tag aspect, highlight height, masthead alignment, cut-out crop.
2. Every beat: strip its first/mid/last frames next to the reference frames I have;
   iterate until composition + treatment read identically at the brief's palette.
3. Motion character check: confirm no linear moves, punch-ins ≤8 frames with
   overshoot, decoratives stepped, camera never static, highlights word-locked.
4. If the real clip becomes available, swap in tracked curves and re-check §7.

**Gate 1 status:** reference decoded and grounded in real pixels; palette,
layout, treatments, layer stack and motion grammar specified to Remotion-ready
numbers. Proceeding to the build on this basis.
