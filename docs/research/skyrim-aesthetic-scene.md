# Raw research notes — Skyrim &amp; the fake-retro-ambience internet aesthetic

Hex values marked "approx" are derived estimates, not data-mined game values.

---

## 1. THE ELDER SCROLLS V: SKYRIM (Bethesda, 2011)

### 1.1 Art direction (Art Director: Matt Carofano)

- Stated goal: a deliberate break from Oblivion's "European Fantasy" look toward a
  **Nordic, Scandinavian-inspired dark fantasy** with "a bit more of a stronger cultural
  influence," while avoiding Morrowind's full alienness — "the Nords were a perfect fit
  for that" (Inverse interview, 2025).
- Internal design mantra (Game Informer 2011 "Art of Skyrim"): **"less Renn-fest and
  more biker bar"** — grounded, weathered, brutal-practical gear and architecture;
  heavy pull from dark fantasy illustration and the Lord of the Rings films.
- Carofano's named film references: **Dragonslayer (1981) and Reign of Fire (2002)** —
  "There's a realism and grittiness to both of them."
- On mood: the team didn't anticipate how much the game's **"lonely, wintry world"**
  would be embraced; on the Special Edition: "When you get some more volumetric
  lighting applied, you see the fog and the mist and the god rays and more color."
- World design: strong readable landmarks ("the big landmark of High Hrothgar, the
  giant mountain at the center of the map"); biome variety per hold.
- Concept art foundation: **Adam Adamowicz** (d. 2012) did the bulk of Skyrim's concept
  art (dragons, Nord armor, Dwemer ruins).
- Craft note: Nordic armor designs let upper armor fully cover lower armor so pieces
  could combine for faster rendering — aesthetic born partly from optimization.

### 1.2 Visual motif inventory

- **Aurora-filled night skies**: auroras appear randomly on clear nights (green/teal
  dominant; violet/pink variants), coexisting with two moons, Masser and Secunda.
- **Standing stones**: monoliths carved with constellation signs; activation lights a
  blue-cyan constellation glow and fires a beam into the sky. Signature image: grey
  lichen-covered stone + cold cyan glow + night sky.
- **Barrows and Nordic ruins**: black curved-roof crypts (Bleak Falls Barrow archetype),
  iron sconces, moss, wall reliefs, glowing blue Word Walls with chanting audio.
- **Mist/fog/god rays**: valley fog, mountain cloud, volumetric shafts; weather as a
  core art-direction tool.
- **Palette philosophy**: muted, desaturated, cold — greys, slate blues, birch whites,
  pine greens, dead-grass gold — so firelight and magical glows read as the only
  saturated accents. Warmth is scarce, therefore precious. (The mechanical basis of the
  "cozy" half of cozy dread.)

### 1.3 Approximate night palette (approx)

- Zenith night blue-black: `#0B1626` / `#0E1A2B`; horizon deep blue: `#1E3A5F`
- Moonlit cloud grey-blue: `#3E5570`
- Aurora teal `#35D0C0` — aurora green `#4EF0A0` — aurora violet fringe `#7A5FD0`
- Grey stone (moonlit) `#8A919B`; stone shadow `#5A6068` / `#3C4148`
- Night snow `#AEBFD4`; torch/inn firelight `#FFB45E` / `#D98E3A`

Third-party palettes to triangulate:
- SchemeColor "Aurora Northern Lights": `#172347 #025385 #0EF3C5 #04E2B7 #038298 #015268`
- color-hex "Winterhold Skyrim-Inspired": `#E6ECEC #B0B0B2 #54605E #77909F #A4B4BB`
- Nord code-theme "Polar Night": `#2E3440 #3B4252 #434C5E #4C566A`

### 1.4 Audio — Jeremy Soule, the cozy-dread exploration feel

- Direction from Todd Howard: shift toward a more aggressive, less melodic,
  texture-first score; live + synthetic; plainchant, Nordic folk, classical.
- Main theme "Dragonborn": Howard asked for **"a choir of chanting barbarians"**;
  lyrics in the invented Dragon language, rhyming in both languages.
- OST: 4 discs, 53 tracks, ~3h36m; **disc 4 "Skyrim Atmospheres" = 42+ min of beatless
  ambience** — the direct ancestor of the "Skyrim ambience 10 hours" YouTube format.
- Soule: "my role is not just to create music, but to be a companion to the player";
  process = reviewing the game "scene by scene to understand exactly what the player
  should be feeling at every moment."
- Anatomy of the exploration feel (USU analysis of "The Streets of Whiterun"):
  **layered ostinatos + a slowly varied primary melody** — repeating piano figure on
  root+fifth, "airy, floating feeling," subtle harmonic shifts under an unchanged
  melody, **"ever changing yet ever the same."** Combat flips to an 81-repetition
  bass-drum ostinato with Dovahzul male choir.
- Technique list: themes doubled in octaves, extreme tessitura, horn calls,
  **open-ended harmonic phrases** (never fully resolving — the dread residue), modal
  procedures, heavy reverb, ABA forms.
- The cozy-dread formula: safe/hearth signifiers (soft piano, folk lute, tavern song,
  fire crackle) suspended inside vast cold emptiness signifiers (wind beds, unresolved
  modal drones, distant low choir). Touchstones: "Secunda," "Streets of Whiterun,"
  "Kyne's Peace," "Aurora," vs. the "Skyrim Atmospheres" beds.

---

## 2. THE INTERNET AESTHETIC SCENE

### 2.1 The fake retro game ambience trend

- **Format**: short looping videos (or 1–10 hr YouTube versions) presenting footage of
  a retro-styled game that never existed — N64/PS1/PS2-era low-poly graphics, fixed or
  slow-drift camera, CRT/VHS grain, fog, ambient/dungeon-synth audio. Second-person
  nostalgia captions ("you're 9 years old, it's a snowy night in 2003..."). The product
  is a **memory of a game no one ever played** — manufactured anemoia.
- **Pipeline/tools** (documented adjacent creators): Blender for low-poly scenes;
  Unity/Godot/Unreal with PSX shaders (affine warp, vertex snapping, dithering); retro
  post filters; increasingly AI tools (the viral "PS2 filter" ran on Replicate).
  Audio: pad loops, sample packs (e.g. "PS1 Ambient" by ethereal2080).
- **Named creators**: Hoolopee (Blender PS1/N64 demakes — Elden Ring PS1, Halo on N64);
  98DEMAKE ("what if modern game X shipped in 1998"; made *OK/NORMAL*); AV Club scene
  interviewees Jessica Harvey (*Paratopic*), Puppet Combo, Concluse devs. Key quote
  (Harvey): the low-fi look exploits "a very specific, more low-level and primal
  emotive response independent of specific memories" — works even on people too young
  for the PS1.
- **YouTube ambience craft culture** (Vice): Autumn Cozy, The Relaxing Town —
  self-taught Blender + layered sound libraries; "images that evoke nostalgia, safety,
  and tranquility tend to perform best"; deliberately "slightly surreal... an escape."
- **Cultural read** (sabukaru): real nostalgia requires absence; the feed supplies "the
  present again" — artificial nostalgia as content. Live fault line: handmade Blender
  tribute vs. AI nostalgia-bait.

### 2.2 @ashenmoon89 — negative result

- Not discoverable: profile unindexed; no press, no aggregator mirrors, no linked
  accounts. Almost certainly a **small anonymous creator** — itself characteristic of
  the scene (anonymous handle in the "ashen/moon/wraith/moss" register). Describe the
  archetype, not the person.

### 2.3 Named aesthetics

- **Dreamcore**: dream-logic imagery, soft hazy nostalgic-surreal; floating eyes,
  endless fields, cryptic text. Comfort + unreality.
- **Weirdcore**: "surreal, uncanny, nostalgic, psychologically disorienting" — low-res
  photos, liminal spaces, VHS distortion, early-internet graphics, "are you lost?"
  captions. Weirdcore = unease; dreamcore = softer sibling. Both build on **liminal
  spaces** (familiar transitional places, empty of people) and **anemoia**.
- **Wizardcore**: masculine counterpart to witchcore; staffs, cloaks, tomes, scrolls,
  hourglasses, orbs, candles, maps. Canonical palette: black, grey, brown, dark red,
  purple, navy, green (approx `#1A1A1D #6E6A5E #5C4432 #6B1F2A #4B2E6F #1F2A44
  #2E4A34`).
- **Wizardposting / geeked wizard** (Know Your Meme): captioning classic fantasy wizard
  art (heavily David B. Mattingly). Lineage: "Pondering My Orb" (Oct 2021) → Mattingly
  reposts (2022) → TikTok wizard slideshows ("the typa shi i been on," wizards "smoking
  za," Sept 2022) → "Shadow Wizard Money Gang" (Dec 2022). "Geeked" = high/euphoric.
  The geeked wizard = wizard art (often holding a glowing potion) captioned as geeked.
  Ancestor: "Potion Seller" (Justin Kuritzkes, 2011).
- **Dark fantasy ambience videos**: 1–10 hr single-scene loops (wizard tower in a
  storm, eldritch library, Duskwood crypt) + rain/fire/wind/page-turning + faint
  dungeon synth; sold as sleep/study/reading ambience. Skyrim is a pillar of the
  format. Commercial layer: dark-fantasy ambience sample packs (Eleftherios Audio's
  used in 130k+ TikToks).
- **HauntedPS1**: community founded March 2018 by Breogán Hackett; annual **Haunted PS1
  Demo Disc** since Feb 2020; menus replicate real PS1 demo discs. Conventions:
  low-poly, dithered low-res textures, affine wobble, heavy fog, fixed cameras, CRT
  filters — Silent Hill/RE ancestry. Alumni: *Toree 3D*, *Dread Delusion*, *Fatum
  Betula*. Doctrine: fog and missing polygons outsource the horror to the player's
  imagination — limitation as atmosphere.
- **Comfy dread / cozy dread**: informal term for the cozy-horror register —
  comfort-first framing with unease seeping through. Canonical game: *Dredge*.
  Skyrim-at-night, dungeon synth, and fake-retro ambience loops all deliver the same
  emotion: **a safe vantage point onto something vast, old, and indifferent** — a
  campfire with the dark pressing in.

### 2.4 Music side

- **Dungeon synth**: lo-fi instrumental synth genre born late-80s/early-90s as ambient
  side projects of the black metal scene; pioneers **Mortiis** (*Født til å Herske*,
  1994) and **Burzum** (*Dauði Baldrs*, 1997); also Depressive Silence, Wongraven,
  Secret Stairways, Jääportit. Cassette-trading culture. Genre name coined by Andrew
  Werdna's 2011 blog: "the sound of the ancient crypt… primitive, necro, lo-fi,
  forgotten, obscure."
  - Sound: minimalist synthesized orchestral/choral loops, medieval-fantasy atmosphere
    (Tolkien + D&amp;D), tape hiss and cheap-keyboard timbre worn as a badge.
  - Visuals: medieval paintings, castles, crypts, forests; **Theodor Kittelsen** as the
    house style; blackletter fonts. Approx cover palette: parchment `#D8C9A3`, ink
    `#141210`, sepia `#7A5C3A`, moss `#4A5A3A`, slate `#54605E`, torch `#C77B33`.
  - 2010s revival on Bandcamp: Erang, Fief, Thangorodrim, Fogweaver. Subgenres:
    **winter synth** (Jääportit — the Skyrim-adjacent one) and **comfy synth** (Hole
    Dweller, Grandma's Cottage) — "low fidelity not as adversarial but comforting";
    comfy dread as a music genre.
  - Why it pairs with this imagery: it is **fantasy-game music made outside any game —
    the sound of a title screen or dungeon that doesn't exist**; lo-fi texture = the
    memory-degradation filter applied to audio. Same anonymous-solo-creator culture as
    the TikTok ambience accounts.
- **Mallsoft** (vaporwave subgenre; 猫シ Corp. *Palm Mall*): easy listening drowned in
  reverb "so it sounds like it's playing from a speaker high up in a ceiling tile" of a
  vast empty mall. Same operation as fake-N64 ambience with a commercial skin:
  reverb-as-distance = fog-as-distance; dead mall = empty barrow.

### 2.5 Cross-cutting synthesis hooks

- Shared emotional core: **anemoia + cozy dread** — manufactured memory of a safe place
  at the edge of something vast/old/dark.
- Shared formal moves: heavy fog/reverb (spatial and temporal distance), lo-fi
  degradation as warmth (tape hiss, dithering, VHS grain, affine wobble), loops "ever
  changing yet ever the same" (Soule's ostinato principle = the ambience-loop
  principle), scarce warm accents against cold desaturated fields.
- Shared production culture: anonymous solo creators, DIY distribution, Blender + cheap
  synths + sample packs.

---

## Sources

Skyrim art:
- https://www.inverse.com/gaming/skyrim-art-interview-exclusive-nintendo-switch-2
- https://gameinformer.com/b/news/archive/2011/01/26/the-art-of-skyrim.aspx
- https://attackofthefanboy.com/news/elder-scrolls-v-skyrim-a-huge-step-visually/
- https://eat-games.tumblr.com/post/25927693759/interview-matt-carofano-skyrim
- https://elderscrolls.fandom.com/wiki/Aurora
- https://en.wikipedia.org/wiki/The_Elder_Scrolls_V:_Skyrim

Skyrim audio:
- https://en.wikipedia.org/wiki/The_Elder_Scrolls_V:_Skyrim_(soundtrack)
- https://paullicino.tumblr.com/post/48252283900/capturing-the-dragon-the-music-of-jeremy-soule-a
- https://usutheoryiv.wordpress.com/2016/10/27/skyrim-and-immersion-jeremy-soules-use-of-ostinatos-and-instrumentation/
- https://jesuitroundup.org/2023/10/wind-guide-you-a-reflection-on-skyrims-soundtrack-by-jeremy-soule/
- https://en.uesp.net/wiki/Skyrim:Music
- https://www.nexusmods.com/skyrimspecialedition/mods/37792

Palettes:
- https://www.schemecolor.com/aurora-northern-lights.php
- https://www.schemecolor.com/green-aurora-borealis.php
- https://www.color-hex.com/color-palette/1052139
- https://www.color-hex.com/color-palette/33330
- https://www.color-hex.com/color-palette/1029048

Fake retro ambience scene:
- https://sabukaru.online/articles/artificial-nostalgia-behind-the-trending-ps2-filter
- https://www.avclub.com/n64-and-ps1-demakes-are-the-new-pixel-art-wave
- https://vice.com/en/article/qjpnk5/ambient-youtube-videos-asmr-lofi-hip-hop-beats-how-to-make
- https://www.youtube.com/watch?v=kZjbcjxuSGE ; https://www.youtube.com/watch?v=lxzWJdYnwLQ
- https://www.youtube.com/watch?v=Hy-JzWqwras ; https://www.youtube.com/c/98DEMAKE/videos
- https://samples.landr.com/packs/ps1-ambient
- https://www.tiktok.com/@ashenmoon89 (unindexed; identity unverifiable)

Aesthetics:
- https://en.wikipedia.org/wiki/Weirdcore
- https://aesthetics.fandom.com/wiki/Dreamcore
- https://vapor95.com/blogs/darknet/liminal-space-dreamcore-and-weirdcore
- https://aesthetics.fandom.com/wiki/Wizardcore
- https://knowyourmeme.com/memes/wizardposting
- https://knowyourmeme.com/memes/geeked ; https://www.tiktok.com/discover/geeked-wizard-meme
- https://knowyourmeme.com/memes/potion-seller
- https://en.wikipedia.org/wiki/Haunted_PS1
- https://gamerant.com/surprisingly-cozy-horror-games/
- Dark fantasy ambience: https://www.youtube.com/watch?v=bXd69OFGpGI ;
  https://www.youtube.com/watch?v=a74p1AhJawI ; https://www.youtube.com/watch?v=1mUrRN-Mmco

Music genres:
- https://dungeon-synth.neocities.org/history
- https://en.wikipedia.org/wiki/Dungeon_synth
- https://aesthetics.fandom.com/wiki/Dungeon_Synth
- https://www.sweetwater.com/insync/genres-youve-probably-never-heard-dungeon-synth/
- https://rateyourmusic.com/genre/comfy-synth/ ; https://www.stranger-aeons.com/comfy-synth-but-is-it-dungeon-synth/
- https://en.wikipedia.org/wiki/Mallsoft ; https://rateyourmusic.com/genre/mallsoft/

Caveats: hex values marked approx are derived estimates; @ashenmoon89 unverifiable;
"comfy/cozy dread" is community vernacular, not a documented aesthetic-wiki entry.
