# EMBERVALE — Design Document

*A 2-player co-op dark fantasy action RPG for the browser.*
Play it at `/game.html` — no install, no assets to download, works on any static host.

---

## 1. Where it came from

The brief was a TikTok clip (@pixelfantasyforge, *"I would commit crimes to play a full game
like this"*): AI-animated pixel-art vignettes of a dark fantasy world — a gauntleted hand
carrying a torch and sword up a stone road toward a gothic castle, a storm-lit watchtower
gate, a robed pilgrim overlooking a lantern-lit village around a lake at dusk, and a starlit
valley pierced by a single beam of light.

Embervale translates those exact beats into a playable campaign:

| Video shot | In-game zone |
|---|---|
| Village around a lake, lanterns at dusk | **Emberhollow** — hub village |
| Dark forest road, shafts of light | **The Thornway** — forest road |
| Watchtower gate under lightning | **Stormwatch Tower** — rain + lightning zone |
| Castle on the mountain | **Castle Vhal** + **Throne of Ash** (boss) |
| Beam of light over a starlit valley | **The Pale Beacon** — the ending |

The clip is first-person, but the game is a **top-down Zelda-like** (chosen by the
project owner) — the torch-and-sword *feeling* is carried by dynamic lighting, not camera
perspective: every hero is a walking light source in a genuinely dark world.

## 2. Pillars

1. **Two torches against the dark.** Co-op is the design center: shared screen or shared
   room code, revives, a shared ember purse, class kits that cover each other's gaps.
2. **The dark is the dungeon.** Light radius is a stat. Atmosphere (darkness, rain,
   lightning, ash, fireflies) does the world-building.
3. **Small, complete, finishable.** A 45–90 minute campaign with a beginning, a boss,
   and an ending — not an endless loop.
4. **Zero assets.** Every sprite, tile, sound and menu is generated in code at runtime.
   The whole game ships as one static bundle.

## 3. Story

The Pale Beacon — the mountain-light that kept the dark honest — went out a hundred years
ago, and the King who kept it went hollow. The valley below lives in permanent dusk.
Two wanderers walk the last road: **Ser Aldric the Emberguard** (knight) and
**Sister Maren, the Last Flamekeeper** (pyromancer). Relight the beacon, whatever it costs.

The Pale King is written as a tragedy, not a monster: he fed the beacon his name, his queen
and his crown, and it died anyway. His boss dialogue (intro → phase turns → death) carries
the arc; his last words send you up the mountain to finish his vigil.

## 4. Campaign structure

```
Emberhollow (hub, safe)
   │  meet Elder Rowena (story), Bram (upgrades), Little Wren (flavor)
   ▼
The Thornway (forest)          — combat tutorial-by-doing: husks, hounds, wisps
   │  ALPHA OF THE THICKET (miniboss) drops the Rusted Key → gate
   ▼
Stormwatch Tower (rain/lightning) — cultists + brutes
   │  light BOTH watch-braziers to open the stormgate
   │  take the Storm Sigil (guarded by brutes) → unlocks the pass to the castle
   ▼
Castle Vhal (ash, cold)        — mixed encounters, optional side wings with loot
   │  VAULT SENTINEL (miniboss) guards the Pale Sigil → throne doors
   ▼
Throne of Ash                  — THE PALE KING (3-phase boss)
   ▼
The Pale Beacon                — walk to the pedestal, hold the light. Ending.
```

Checkpoints are **bonfires** (rest = full heal + checkpoint + upgrade shop). Death sends
the party back to the last bonfire and taxes 20% of carried embers — soft, Hades-style,
never a restart.

## 5. Classes

| | Ser Aldric (Knight) | Sister Maren (Pyromancer) |
|---|---|---|
| HP | 8 (4 hearts) | 6 (3 hearts) |
| Attack | Melee arc combo (3rd hit heavier) | Firebolt projectile |
| Special | **Shield Charge** — dash, damage, staggers even Brutes | **Flame Nova** — radial burn + knockback |
| Light radius | 68 | 86 (the flame answers her) |
| Utility | Lights braziers by hand | **Lights braziers at range with firebolts** |

Synergy is deliberate: the knight holds the front and interrupts; the pyro controls space,
solves the tower's brazier puzzle from safety, and sees farther in the dark. Both can dodge-roll
(i-frames), both revive.

## 6. Co-op design

* **Local co-op** — one keyboard (WASD+JKL+E vs arrows+,./+Enter) or gamepad for P2.
  One shared camera follows the party midpoint; players are softly leashed to the screen.
* **Online co-op** — host "kindles a room" and gets a 4-letter ember-word (e.g. `T5CV`);
  the guest "answers the call" from anywhere. WebRTC via PeerJS, so it works from a static
  host with no game server. Each player gets their own camera.
* **Down-but-not-out** — at 0 HP you're downed, not dead (40s bleed-out). An ally who holds
  INTERACT beside you for 3s brings you back at half health. Party wipe → last bonfire.
* **Shared economy** — embers go into one purse; upgrades are bought per-hero from it.
  No loot competition, one shared "should we spend it" conversation.
* **Co-op scaling** — enemies get ×1.55 HP and drop ×1.35 embers with two players.

### Netcode (host-authoritative)

```
GUEST                                HOST
input frame ──20 Hz──────────────▶  applies guest input to sim
local movement prediction            runs the ENTIRE simulation
(same collision code)               (players, AI, combat, drops)
      ◀─────────12 Hz snapshots──── serialized world state + events
interpolates remote entities
blends own position to authority (snap at >48px error)
cosmetic instant swing on attack press
```

* Reliable ordered datachannel (PeerJS default) with small JSON snapshots; at 12 Hz the
  payload is a few KB/s — fine for 2 players.
* Guest movement feels instant (locally predicted against the same tile collision);
  combat resolution is authoritative on the host, which is the standard small-co-op
  compromise (favor consistency over guest-side hit prediction).
* Ping is measured continuously and shown in the HUD corner.
* `?peerhost=…&peerport=…&peersecure=0` overrides the broker for self-hosted
  [peerjs-server](https://github.com/peers/peerjs-server) instances (also how CI tests it).

## 7. Systems

* **Combat** — melee arcs with angle tests, projectiles, knockback, hit-stop-lite (stagger),
  wind-up telegraphs on every enemy attack (blinking red glint), i-frame dodges, stamina
  gating dodge/special.
* **Enemies** — Hollow Husk (chaser), Gloom Hound (circle + lunge), Pale Cultist (keeps
  range, casts), Cairn Brute (slow, AoE slam, stagger-resistant), Grave Wisp (erratic glow),
  plus Alpha / Sentinel minibosses.
* **The Pale King** — 95 HP ×co-op scaling, three phases: sword sweeps → summons + radial
  volleys → 1.35× speed, telegraphed line beam, wisp summons. Phase turns have dialogue.
* **Progression** — 5 upgrade lines at any bonfire: damage, max HP, stamina, light radius,
  revive speed. Ember costs tuned so a full clear affords most-but-not-all of two heroes' kits.
* **Persistence** — `localStorage` save: flags (keys, gates, minibosses, chests), embers,
  upgrades, checkpoint, class loadout. "Continue the Vigil" resumes; NG stays after victory.
* **Save ownership online** — the host's save is the world's truth; the guest plays inside
  the host's story state (their upgrade purchases live in the host's save for the session).

## 8. Presentation

* 480×270 internal canvas, pixel-perfect upscale (half-integer steps), `image-rendering:
  pixelated`.
* **All art is procedural**: characters/enemies/props are pixel-map sprites built at boot;
  tiles are painted per-zone (grass/path/water/trees/stone) with hash-based variation;
  houses are painted over their footprints with lit windows.
* **Lighting** is the signature: a darkness overlay per zone (color + strength), erased by
  radial gradients per light source (heroes, torches, braziers, bonfires, firebolts, wisps —
  cold blue for the uncanny ones), plus a warm additive glow pass and per-light flicker.
* **Weather per zone**: drifting embers (village), fireflies (forest), rain + lightning
  strikes with thunder (tower), falling ash (castle/throne), stars (beacon).
* **Audio is 100% WebAudio synthesis**: zone drones (detuned oscillator beds + filtered
  wind noise + slow LFO), sparse generative bell melodies per zone scale, and ~30 synthesized
  SFX (sword whooshes, hits, thunder, gate grind, revive chimes, victory peal). No files.
* **UI**: canvas HUD (hearts, stamina, embers, key items, boss bar, toasts, zone title
  cards) + DOM overlays for menus/dialogue/shop in a consistent ash-and-ember style.

## 9. Architecture

```
game.html                   entry (2nd Vite input, deploys beside the portfolio)
src/game/
  data.js      zones, ASCII maps, dialogue, enemy/class/upgrade tables
  world.js     map parsing, collision, spawn/exit/gate extraction (pure, Node-testable)
  game.js      the simulation: players, AI, combat, boss, progression (pure)
  render.js    camera, pre-rendered zone layers, y-sorted sprites, lighting, weather
  sprites.js   procedural pixel art (sprite maps + tile painters)
  audio.js     WebAudio synth (ambience + SFX)
  ui.js        DOM menus/dialogue/shop + canvas HUD
  net.js       PeerJS rooms, host/guest protocol
  main.js      loop, input (2 keyboards + gamepad), mode orchestration, save
```

The sim (`game.js` + `world.js`) is DOM-free — the same code hosts offline play, host-side
authority, and guest-side prediction, and the maps are validated headlessly in Node
(flood-fill reachability + gate-blocking checks for every zone).

## 10. Verification

Tested with Playwright against real Chromium:

* every zone reachable; every gate actually blocks until its condition is met
* full campaign chain: elder dialogue → rusted key → braziers → storm sigil → pale sigil →
  Pale King (intro/phases/death dialogue) → beacon → victory screen
* local co-op: both players, independent controls, down → hold-E revive
* online co-op: room creation, code join, class pick, guest input driving the host sim,
  snapshots rendering on both screens (verified against a local peerjs-server)
* zero console errors across all flows

## 11. Design references

Grounded in a fan-out deep-research pass — 22 sources, 25 claims adversarially verified
(3 skeptic votes each), 12 surviving findings — see `docs/RESEARCH.md` for the full sourced
report. The verified findings the build leans on directly:

* **Shared midpoint camera** over split-screen for local co-op (Demons with Shotguns
  playtesting; Bionic Commando Rearmed's hybrid as fallback).
* **Proximity revives with risk** as the teamwork driver, with bleed-out + bonfire respawn
  capping the known traversal-tedium failure mode.
* **Netcode architected from day one** — Children of Morta's postmortem documents a
  ~2.5-year delay from retrofitting online co-op; Embervale's sim was serializable before
  it had a menu.
* **Host-authoritative + client prediction** (Gambetta's canonical model) — inputs up,
  state down, guest predicts own movement.
* **PeerJS over NetplayJS/Trystero** after a maintained-vs-serverless trade-off survey;
  the symmetric-NAT/TURN ceiling (~10–20% of pairs) is documented as a known limitation.
* **Pixel art + dynamic lighting** as the dark-fantasy look (Children of Morta's stated
  approach), proven here in pure canvas 2D.
* **Boss = test of learned skills, structured in Stout's eight beats**; the campaign
  alternates intensity with hub rest beats and ends in falling action after the climax.

## 12. Cut / future

* Four-player rooms (protocol supports one guest today by design)
* Touch controls for phones
* A second weapon per class + charged attacks
* NG+ with remixed enemy placements
* An unreliable datachannel for snapshots (currently reliable-ordered is fine at 12 Hz)

## 13. Art direction — validated by blind judge panels

The art was iterated against the reference stills through **six rounds of blind
judging** (three independent senior-reviewer agents per round — an art director,
a veteran pixel artist, and a storefront creative director — none told which
studio made what). Style scores climbed 4/4/4 → 8/8/7 across rounds as their
critiques were implemented:

- **Tile-quantized lighting**: light falls off in discrete 8px-cell bands with
  ordered dither at the seams, multiplied saturated-indigo ambient, and per-cell
  amber glazing — "painted into the pixels", per the reference's technique.
- **Dark-with-pooled-light value structure**: darkness dominates; warm amber
  pools structure every frame; all flame light reads amber on any material.
- **Authored ground detail**: flower banks, stone groups, tuft clumps, stumps,
  ferns, mushrooms — placed deliberately and denser along roads; clustered
  texture, never single-pixel noise.
- **Title vista**: a faithful restaging of the reference's robed-pilgrim
  overlook (3x-scale foreground figure, as near objects carry larger pixels in
  the reference itself).

Final panel verdict: **unanimous SHIP = YES** ("faithful and shippable;
remaining items are polish, not blockers").
