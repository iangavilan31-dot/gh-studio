# REPORT — "The Day the Army Attacked Its Own Veterans" (Bonus Army, 1932)

Autonomous production report. Deliverable: a widescreen **1920×1080** documentary
Short, image-driven Vox / Johnny-Harris newspaper-motion style, ~57 s.

- Final render: `out/bonus-army-short-final.mp4` (graded, CRF 16)
- Upload file: `out/bonus-army-short-upload.mp4` (faststart)
- Review clips: `out/clip-b1-matchcut.mp4`, `out/clip-b8-attack.mp4`
- Reference decode: `reference-analysis.md` (+ `reference/study/`)
- Audio spec: `public/audio/sfx-manifest.json`
- Reference vs render strip: `reference/study/reference-vs-render.png`

> **Rendering note:** a single full-length Remotion render stalls the font
> `delayRender` at init under this container, so the film is rendered in 5 frame
> chunks (`pipeline/render_chunks.sh`) and concatenated losslessly, then graded
> by `pipeline/finish.sh`. This is a container/tooling workaround, not an
> editorial choice.

---

## 1. Reference status (blocked-path resolution)

The reference clip `qjafHzNJLQ0` 0:03–0:13 **could not be downloaded**: this
container's proxy presents a non-routable ULA as the API-request IP while media
fetches egress over a rotating IPv4 pool, so every IP-locked `googlevideo` URL
403s — verified across yt-dlp's clients, a working bgutil PO token, and ~15
cobalt/Piped/Invidious instances (all behind YouTube's bot-wall). No reference
clip file was present in the repo/uploads.

Per the blocked-path rule, the motion was reconstructed from **`reference-analysis.md`**,
which is itself grounded in the reference pixels that *were* reachable on
non-IP-locked CDNs: the 1280×720 poster frame + the L2 storyboard tiles (the
clean → kraft-restyle → punch-in build-up), all in `reference/study/`. Palette,
layer stack, typography, treatments and the composition proportions are decoded
from those real frames; the sub-second motion curves are grounded in the brief's
explicit spec + the visible start/end states.

**Status: REFERENCE-PARTIALLY-VERIFIED** — design/composition verified from real
extracted frames; frame-accurate motion tracking of the moving clip was not
possible. `reference/study/reference-vs-render.png` shows the style match.

---

## 2. What was built

**Pipeline (`bonus-army-short/pipeline/`)**
- `setup.sh` scratch-voice bootstrap; `vo_chatterbox.py` final VO; `assemble.py`
  VO → `vo.wav` + `timing.json` (76 event anchors) + `captions.json`.
- `fetch_assets2.py` Wikimedia public-domain fetch; `treat_v2.py` one cached
  B&W-match→damage chain per asset + 3-layer parallax (rembg cutout + opencv
  inpaint plate) for clean subjects.
- `render_chunks.sh` chunked render; `finish.sh` grade + zoom-crop + CRF 16 +
  loudnorm + clips; `qa.py` static-span / loop-diff / audio checks.

**Engine + systems (`src/`)**
- `NewspaperScene` (kraft paper + grid + camera reframe/punch/glide + gate-weave
  + grain) — the reference-motion DNA.
- `FilmTexture` stack: grain + vignette, drifting dust + scratch lines, projector
  flicker, flash frames, light-leak sweeps, halation, hand-tint. Deterministic
  per frame, layered per shot.
- Shot vocabulary: `ParallaxPhoto` (3-layer + crowd strip-cheat), `NewspaperPage`
  (recreated period front page: sharp headline / blurred greeked body / aged
  newsprint), `TextMatchCut` (anchor-locked hard cut), `FullBleed`,
  `DetailInsert`, `MultiPanel`, `Spotlight`, `MapShot`, `BigCard`, `RipReveal`,
  `PhotoOnPaper`, `Cutout`, `Stamp`, `Rough`, `MarkerHighlight`.

**Assets (18, public-domain, one cached treatment):** veterans-under-the-Capitol,
White-Angel breadline (+parallax fg/bg), Anacostia camp panorama, camp life,
burning camp, eviction, theater interior, 1932 DC map, MacArthur/Patton/
Eisenhower/Hoover/FDR cutouts. Newspaper pages are **period-accurate recreations**
(reality-patch-allowed; real verified headline words, typeset + treated). Zero
generated imagery.

**Audio:** Chatterbox final VO (measured read, tempo-tuned to 57 s), drone-based
bed with a dead cut on "Army", room tone + vinyl crackle, event SFX + B8 hoof
build from `sfx-manifest.json`, mastered to −14 LUFS / −1.5 dBTP.

---

## 3. Autonomous decisions (+ why)

1. **Chunked render + concurrency-1.** A full render stalls the font
   `delayRender` (fetch contention across render tabs); chunk+concat is the
   reliable path. *Why:* ship a correct render over a fragile fast one.
2. **Recreated newspaper pages over real scans.** WaPo/NYT 1932 are paywalled;
   real JP2 scan fetch + OCR is fragile and the match cut needs a 4px-precise
   ARMY anchor. Recreations (real words, period typesetting, same treatment
   chain) give exact anchor control — explicitly allowed by the reality patch.
3. **Word boxes from layout, not OCR.** For recreated pages I place the anchor
   word, so the ARMY box is exact by construction (better than OCR on noise).
4. **Parallax strip-cheat for crowds.** 1932 crowd/camp photos break naive
   rembg; the bottom-strip cheat gives depth with no mangleable cutout edge
   (reality-patch honesty rule). True 3-layer only on the clean breadline.
5. **Treated stills as "newsreel."** NARA/archive.org newsreel video wasn't
   reliably fetchable; heavily film-treated stills read as archival footage.
6. **Drone-based music.** Drones cut dead-clean on "Army"; melodic piano would
   whiplash. Sparse tension layered under.
7. **Tempo-compress VO 1.06×** to land ≤58 s without re-synthesis (numpy pin
   conflict after installing rembg/opencv blocked a clean Chatterbox re-run).
8. **B8 multi-panel uses the eviction/tank/fire photos we have**, carried by red
   SABERS/BAYONETS/TANKS stamps — distinct cavalry/bayonet scans weren't
   sourceable (searches returned a mislabeled congressman portrait).

---

## 4. QA cycles

**Cycle 1** (harness `qa.py` + graded contact sheet):
- LOOP: first-*frame* vs last = 161 — **false alarm** (frame 0 is the ~0.1 s
  black lead-in). First *content* frame vs last = **3.2** (grain only) → loop is
  seamless. Confirmed with `out/_loopcmp.png`.
- AUDIO: peak −0.1 dB (near clipping) → **fixed**: loudnorm to −14 LUFS / −1.5
  dBTP (now mean −15.1, peak −1.3).
- STATIC span 41.5–44.5 s (B9 fire / B10 cost): intended near-still; grain
  shimmers at full res. Added a tiny slow push to B10 so it is not dead-frozen.
- B3 hands detail-insert and B10 portrait too dark → **fixed**: brightness +
  reframe. B1 crowd (night) strip brightened.

**Cycle 2** (post-fix re-render): _pending final render; results appended below._

**Cycle 3:** _pending._

---

## 5. Five weakest moments (ranked) + proposed fix

1. **B8 attack panels are asset-thin.** The multi-panel labels
   (SABERS/BAYONETS/TANKS) sit on the eviction/Patton-tank/fire photos rather
   than true cavalry/bayonet/tank frames. *Fix:* source the specific 1932
   eviction-cavalry (LC-USZ62) and infantry-gas photos and re-panel; the layout
   already supports it.
2. **Newsreel shots are treated stills, not motion footage.** B7/B8/B9 imply
   moving newsreel. *Fix:* pull NARA 24730 / archive.org universal-newsreel
   video, frame-extract, and drop 2–3 s clips into `FullBleed` as `<Video>`.
3. **B10 portrait is a generic camp figure**, not the named casualty. *Fix:*
   source a Hushka/Carlson portrait if one exists in LOC; else keep but caption
   more explicitly.
4. **B1 crowd (night) reads dark on some displays.** *Fix:* a dedicated tone
   curve on that asset in `treat_v2.py` rather than a runtime brightness bump.
5. **Body text on recreated pages is greeked.** Legible-but-fake if paused.
   *Fix:* set real 1932 article body text (still blurred) so a freeze-frame
   holds up.

---

## 6. Reproduce

```bash
bash pipeline/setup.sh
cd bonus-army-short && npm install
python3 pipeline/fetch_assets2.py && python3 pipeline/treat_v2.py   # assets
python3 pipeline/vo_chatterbox.py && python3 pipeline/assemble.py   # VO
bash pipeline/render_chunks.sh    # render (chunked)
bash pipeline/finish.sh           # grade + clips
python3 pipeline/qa.py            # checks
```
