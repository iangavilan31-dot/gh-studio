# Embervale — Design Research Report

Produced by a deep-research pass (5 search angles → 22 sources fetched → 108 claims
extracted → 25 adversarially verified with 3 independent skeptic votes each → 23 confirmed,
2 refuted → synthesized to 12 findings). Every finding below survived attempts to refute it
against the live source.

**Question.** Design research for a browser-based co-op top-down dark fantasy action RPG
(Zelda-like, pixel art) shipping as a static site: co-op feel (camera, revives, class
synergy, 2-player scaling), WebRTC/PeerJS netcode practice, dark-fantasy canvas
presentation, and 1–3 hour campaign structure.

---

## Findings

### 1. Camera: one shared camera, midpoint-centered — *medium confidence, 3-0*
A single shared camera beats split-screen for small co-op: keep all players on screen,
center on their midpoint, zoom with their spread (clamped), with a dynamic split only as a
fallback. Demons with Shotguns playtesting rejected split-screen outright ("small screen
real estate"); Bionic Commando Rearmed's shared-until-forced-to-split hybrid is the proven
fallback.
→ *Embervale*: shared midpoint camera with a soft leash in local co-op; online play gives
each player their own camera, which sidesteps the separation problem entirely.
Sources: [Single camera system for four players](https://www.gamedeveloper.com/programming/single-camera-system-for-four-players), [Shared/multi/split screen design](https://www.gamedeveloper.com/design/shared-multi-split-screen-design)

### 2. Revives: proximity + risk drives teamwork — *low confidence, 3-0*
Down-but-not-out promotes cooperation through two channels: penalizing parties that split
up, and making the revive act itself risky. Known failure mode: traversal tedium when an
ally dies far away. (Confidence low: single 2011 source, though verifiers noted the pattern
in Deep Rock Galactic, It Takes Two, and Children of Morta.)
→ *Embervale*: hold-to-revive beside the body while enemies keep attacking; a 40 s
bleed-out and bonfire-respawn on wipe cap the tedium; the "Oath of Ash" upgrade halves
revive time as a purchasable teamwork investment.
Source: [Co-op revive mechanics](https://www.gamedeveloper.com/design/co-op-revive-mechanics)

### 3. Netcode from day one — *high confidence, 3-0*
Children of Morta's first-party postmortem: they planned local-only co-op, decided
mid-development to add online, had to re-architect, and shipped online co-op ~2.5 years
after launch. Networking must be in the architecture from the first prototype.
→ *Embervale*: the sim was built DOM-free and serializable before any menu existed; the
same code runs offline play, host authority, and guest prediction.
Source: [Postmortem: Children of Morta](https://www.gamedeveloper.com/design/postmortem-children-of-morta)

### 4. Class synergy target: "1+1=4" — *medium confidence, 3-0*
Dead Mage's stated co-op goal was gameplay-level collaboration and co-op-only emergent
play, not parallel solo runs.
→ *Embervale*: knight interrupts what the pyro kites; the pyro solves the tower brazier
puzzle at range that the knight must walk to; light radii overlap into shared safety;
one ember purse forces one shared economy conversation.
Source: [Co-Optimus interview](https://www.co-optimus.com/editorial/1448/page/2/indie-ana-co-op-and-the-children-of-morta-interview.html)

### 5. Host-authoritative + prediction is the standard model — *medium confidence, 3-0*
One node owns the state; clients send inputs ("move one square right"), never state
("I'm at (10,10)"); prediction/reconciliation must be layered on or action combat feels
laggy. Maps directly to host-authoritative P2P for 2-player co-op with no anti-cheat needs.
→ *Embervale*: implemented exactly this — guest sends input frames at 20 Hz, host
simulates everything, guest predicts its own movement against the same collision code and
blends to authority (snap at >48 px error).
Source: [Gabriel Gambetta, Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html)

### 6–8. Library survey: PeerJS / NetplayJS / Trystero — *high confidence, 3-0 each*
- **PeerJS**: free cloud broker for signaling only; game data flows peer-to-peer; ships on
  static hosting with zero backend. Community-reported scale limits; no TURN provided.
- **NetplayJS**: rollback/lockstep wrappers that tolerate non-deterministic game code via
  host drift-correction — but npm-dormant since 2023, hobbyist signaling server.
- **Trystero**: most serverless (signals over BitTorrent/Nostr/MQTT), `joinRoom(config,
  roomId)` is a ready-made room-code flow, freshest maintenance (v0.25.3, Jul 2026), but
  public-tracker churn is a real risk.
→ *Embervale*: chose PeerJS — maintained, boring, and its ID-claiming maps perfectly onto
4-letter room codes; `?peerhost=` override supports self-hosted brokers (and is how CI
tests the netcode against a local peerjs-server).
Sources: [PeerJS FAQ](https://peerjs.com/client/faq), [PeerJS Cloud](https://peerjs.com/server/cloud), [NetplayJS](https://github.com/rameshvarun/netplayjs), [Trystero](https://github.com/dmotz/trystero)

### 9. The symmetric-NAT ceiling — *high confidence, 3-0*
When both players sit behind symmetric NATs, browser WebRTC cannot connect without a TURN
relay (industry stats: ~10–20% of connections need relays). This applies to every P2P
option equally.
→ *Embervale*: known limitation, surfaced as a clean join error; a TURN relay (e.g. a
free-tier Open Relay) can be added via the same config override if it bites real players.
Sources: [PeerJS FAQ](https://peerjs.com/client/faq), [webrtcHacks on symmetric NAT](https://webrtchacks.com/symmetric-nat/)

### 10. Art direction: pixel art + modern lighting — *high confidence, 3-0*
Children of Morta's dark-fantasy look = standard 2D pixel pipeline deliberately layered
with dynamic lighting, shadows and post-processing ("we didn't constrain ourselves
technology wise"). The research validated the aesthetic, not a canvas-2D recipe (Morta
used Unity shaders).
→ *Embervale*: proved the canvas-2D path empirically — per-zone darkness overlays erased
with `destination-out` radial gradients, an additive warm-glow pass, per-light flicker,
weather layers — all at 480×270/60 fps with dozens of entities.
Source: [Postmortem: Children of Morta](https://www.gamedeveloper.com/design/postmortem-children-of-morta)

### 11. Boss craft: test learned skills, structure in beats — *medium confidence, 3-0*
Mike Stout (Ratchet & Clank): a boss should test skills the player already learned —
list skills, design attacks per skill, theme them to the character, add defense phases —
and ride his eight beats (Build-Up → Intro → Business-as-Usual → Escalation → Midpoint →
It's ON! → Kill Sequence → Victory Sequence), derived from Ocarina of Time's Ganon.
→ *Embervale*: the Pale King tests dodging (sweeps learned vs. hounds), spacing
(volleys learned vs. cultists), add-clearing (husk/wisp summons), and revive-under-pressure;
his phases + dialogue land the beats (intro monologue → sweeps → summon escalation →
phase-3 "It's ON" speed + beam → death soliloquy → beacon walk).
Source: [Boss battle design and structure](https://www.gamedeveloper.com/design/boss-battle-design-and-structure)

### 12. Pacing: alternate intensity; don't peak at the final boss — *medium confidence, 3-0*
Unbroken intensity numbs players — alternate dungeon zones with rest beats (the village
hub), use bosses as chapter breaks, and follow the climax with falling action (Dark Souls,
Portal, HL2). Caveat: actively contested school (Hades and Elden Ring peak at the end).
→ *Embervale*: village → zone → bonfire cadence; each zone caps with a gate/miniboss beat;
after the Pale King, the Beacon zone is pure falling action — a quiet walk into the light.
Sources: [Boss battle design and structure](https://www.gamedeveloper.com/design/boss-battle-design-and-structure), [Level Design Book: Pacing](https://book.leveldesignbook.com/process/preproduction/pacing)

---

## Refuted claims (0-3 — do not rely on)

1. *"Existing games solve the off-screen-player problem in one of three ways (teleport /
   kill / block movement)"* — the taxonomy overreaches its source.
2. *"A teleport-to-downed-teammate skill eliminates revive tedium while preserving teamwork
   incentives unchanged"* — doubly-hedged 2011 speculation upgraded into a claim; killed.

## Open questions (no surviving evidence)

- Concrete 2-player enemy-scaling formulas used by shipped ARPGs (Embervale ships ×1.55 HP
  / ×1.35 drops as a playtest-tuned guess).
- Hard numbers for state-sync rates and lag compensation for melee-range browser combat
  (Embervale ships 12 Hz snapshots + 20 Hz inputs + interpolation, which felt good in
  testing; unreliable-channel snapshots remain future work).
- Real-world reliability of the free signaling paths under load; whether to bundle a
  free-tier TURN relay by default.

## Stats

5 angles · 22 sources fetched · 108 claims extracted · 25 verified (3 votes each) ·
23 confirmed · 2 refuted · 12 synthesized findings · 104 agents · ~3.0M tokens
