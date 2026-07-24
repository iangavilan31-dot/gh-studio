# MOONREST

*a small night, kept*

A cozy-dread, N64-style 3D night-walk for tired people. The village is asleep;
you are the Lamplighter. Walk the dark, kindle the 37 old lights before the moon
sets, and let the sleepers dream. Forty minutes, one moon, no combat, no fail
state — the night is a loop, and that's said with affection.

Every texture is painted in code, every mesh built from primitives, every sound
synthesized in WebAudio. Nothing is fetched at runtime. The moon's phase is your
real moon's phase.

## Play

```bash
npm install
npm run dev        # → http://localhost:5173
```

Or build and serve statically (`npm run build` → `dist/`, deploys anywhere
static — the existing `netlify.toml` works as-is).

**Controls:** WASD walk · Shift jog · mouse look (click for pointer lock) ·
**E** kindle (hold — the channel takes 1.2s) · **Tab** emote wheel ·
**C** sit / lie · **Space** hop · **P** photo mode · **Esc** menu · F3 dev
overlay. Gamepad: left stick walk, right stick look, **A** kindle, **B** hop,
**Y** emote, D-pad-down sit.

Everything else — counters, keepsake shelf, settings (Memory dials N64/PS1/VHS/
Clean, audio, remapping, accessibility) — lives in the pause menu. There is no
HUD. The moon is the only clock.

## Host a night together (2–4 players)

1. **Host Night** on the title screen → you get a 4-letter code (also shown in
   the pause menu).
2. Friends choose **Join Night** and type the code. Late joining is fine — the
   night syncs to them.
3. No text chat, on purpose. You have emotes, lantern-light, and each other.
   Some things in the night only happen when everyone does something together.

Co-op uses PeerJS data channels through the public PeerJS broker; the game
itself stays a static site with zero server code.

## Verify

```bash
bash scripts/init.sh        # build + headless smoke test
node scripts/shoot.mjs      # screenshot reel → docs/build/shots/
```

Deterministic gates live in `scripts/`: feel, kindle, traverse, hue-match,
moments, full-night autopilot, performance budgets, two-context co-op, and the
shell. The build ledger is `docs/build/features.json`; the judge record is
`docs/build/JUDGE.md`.

## Credits

Built in one long autonomous night by Claude (an Anthropic language model) with
a lantern, from the MOONREST master build document (`docs/MASTER_PROMPT.md`).

Inspired, honestly and with love, by the fake-retro ambience scene and the
games that taught the moon to loom: Majora's Mask, Lunacid, old-kingdom MMO
evenings, and every N64 fog wall. Rendered by [three.js](https://threejs.org);
lanterns carried between friends by [PeerJS](https://peerjs.com). Type set in
IM Fell English and Alegreya (OFL, npm-bundled).

The game's code is offered MIT-style: take the night apart and see how it
ticks. (This note covers the game code under `src/game/`; the surrounding
repository belongs to its owner.)
