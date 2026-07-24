# Raw research notes — World of Warcraft &amp; Wizard101 art direction

Confidence tags: [S] = sourced from a cited page; [C] = well-established community/modding
consensus; [A] = approximation/derivation (hex values are starting points, not canon).

---

## 1. WORLD OF WARCRAFT (2004, classic era)

### 1.1 Core art-direction principles

- **Exaggerated, "chunky" proportions as house style.** Samwise Didier (Blizzard founding
  artist, defined Warcraft look): "Artistically, we've always gone for the same sort of
  goals: we try to keep everything over-the-top, over-proportioned, and really colorful,
  then we add in as much 'comic factor' as we can." Big shoulders, big hands, big feet,
  oversized weapons. [S]
- **Readability as bedrock.** Bill Petras (vanilla WoW art director, later Overwatch):
  identifiability-at-a-glance and silhouette distinctiveness formed "the bedrock" of his
  character-design approach (quote from Overwatch-era interview; same philosophy carried
  from WoW). [S]
- **Six pillars of Blizzard stylization** (Matt McDaid, Senior 3D Artist, Blizzard):
  scale &amp; proportions, silhouette, lighting, color, exaggeration, composition. Working
  rules: "consolidate high frequency details into low frequency details where possible so
  the asset doesn't appear too busy" (e.g. paint 2 large chunky nails instead of 4 small
  ones); deliberately manage the value range of textures per art style; exaggerate
  observed lines/shadows/colors rather than paint literally; an asset "should sing in
  full harmony with its surroundings." [S]
- **One-artist consistency rule.** Gary Platner (vanilla Lead Environment Artist): make
  everything — buildings, ground textures, lighting, trees — "look like it was done by
  the same guy"; all assets must have hand-painted textures matching the unique style. [S]
- **Timeless over cutting-edge.** Chris Robinson (later Senior Art Director): the goal is
  "not necessarily be cutting edge... but just be timeless and approachable." [S]
- **Hand-painted everything.** All surface detail (lighting, AO, wear, material response)
  painted into diffuse textures; vanilla has no normal/spec maps — texture painters ARE
  the lighting artists. Ely Cannon: WoW's identity is "stylized, hand-painted game art."
  VFX follow the same rule (Luis Aguas). [S/C]
- **Silhouette-first modeling**: tiny poly budgets + low resolutions (800x600 era) mean
  shapes must read at distance; detail lives in the texture, form in the silhouette. [C]
- **Zone color scripting**: each zone gets a dominant saturated palette (Elwynn =
  green/gold, Barrens = ochre, Felwood = sickly green, Azshara = autumn orange/rose);
  fog + sky tint enforce the palette. [C]
- **Talks/interviews to mine further**: GDC Vault "The Universe of World of Warcraft";
  GDC "Remaking the World of Warcraft through Cataclysm"; GDC "WoW VFX Pillars"; "The
  WoW Diary" by John Staats; YouTube "Why Does World of Warcraft Look Like This?";
  BlizzCon "Art of WoW" panels. [S]

### 1.2 Technical facts (vanilla)

- **Min spec**: 800 MHz CPU, 32 MB GPU with HW T&amp;L (GeForce 2), 256 MB RAM. [S]
- **Polygon budgets**: naked human ≈1,000 tris; fully geared with weapons ≈6,000.
  WoD-era Artcraft: old models "less than 1k to over 5k"; dwarf went 1,160 → 7,821.
  Vanilla race meshes cluster ~1,000–2,500 tris. [S]
- **Textures**: BLP format (DXT); overwhelmingly 256x256 and smaller (128s, 64s for
  props/tilesets); character skins composited onto a single small sheet. Diffuse-only;
  no normal maps; lighting/AO painted in. [S/C]
- **Terrain**: ADT tiles of 16x16 = 256 chunks; small tiling hand-painted tilesets
  blended per-chunk with alpha maps. [S]
- **Vertex-colored lighting**: WMO interior groups (flag 0x2000) lit ONLY by baked
  per-vertex colors (MOCV chunk) — the Ironforge/Undercity look. Characters inside are
  lit by finding the closest polygon and barycentrically interpolating its 3 MOCV
  values. MOCV also used for glow accents (lantern glow). Terrain vertex shading (MCCV)
  and baked omni vertex lighting (MCLV) are WotLK+; vanilla exteriors = global
  time-of-day lighting + fog. [S]
- **Per-zone sky and fog**: pre-1.9 .LIT files, then Light.dbc family. Each Light
  record = a sphere (position + falloff radii); inside it, LightParams/LightIntBand/
  LightFloatBand keyframe time-of-day colors: 5 sky gradient bands + fog color that
  doubles as the "background mountains" color + underwater/storm variants. Fog distance
  stored x36. Skyboxes optional M2 models (LightSkybox.dbc). Net effect: every zone gets
  its own sky gradient + fog tint + water color keyframed across dawn/day/dusk/night.
  Because fog color = horizon color, fog reads as atmosphere, not limitation. [S]

### 1.3 Night-elf ruins aesthetic (Dire Maul / Eldre'Thalas, Azshara, Kel'Theril)

Lore/visual grounding:
- **Eldre'Thalas (Dire Maul, Feralas)**: Highborne city built ~12,000 years ago guarding
  Queen Azshara's arcane secrets; "the ruins stand strong because of an ancient crafting
  technique that bound arcane energy within the stone." Three districts: Warpwood
  Quarter (east — "entire district overgrown with crazed plant life"), Capital Gardens
  (west — "haunted by the ghosts and skeletons of deceased Highborne"), Gordok Commons
  (north — ogre-squatted). Ghost Highborne (Shen'dralar), satyrs, ogres = elegance
  defiled by brutes. [S]
- **Azshara (zone)**: "beautiful coastal area cloaked in eternal autumn," brilliant
  orange/red flora, cliff ruins (Ruins of Eldarath, Temple of Zin-Malor); ghosts,
  satyrs, naga. [S]
- **Ruins of Kel'Theril (Winterspring)**: Highborne city shattered in the Sundering, now
  a frozen lake with broken pillars piercing the ice; cursed Crystal of Zin-Malor. [S]
- "Zin-Azshari style" for vanilla purposes = the Eldarath/Dire Maul kit under
  water/twilight. [C]

Architectural motifs (shared vanilla night-elf-ruin asset kit): [C]
- Fluted white/pale marble columns, most snapped mid-shaft; freestanding arches, broken
  colonnades; wide shallow stairs and terraces.
- Teal/verdigris accents: oxidized metal filigree, roof trim, inlay bands.
- Crescent-moon and owl iconography (Elune); moonwells (glowing white-blue pools);
  huntress/priestess statuary.
- Glowing arcane runes, floating/embedded purple crystals; arcane wisps and translucent
  ghost FX in pale blue-white.
- Nature reclaiming: vines and moss over every edge, roots splitting pavement, giant
  gnarled trees through plazas; in corrupted areas the plants are hostile (Warpwood).
- Composition rule: elegant curved elven geometry vs. organic overgrowth vs. void-purple
  sky = beauty + loss + danger.

Mood keywords: elegiac, moonlit melancholy, faded imperial glory, arcane hum, "the party
ended 10,000 years ago," haunted twilight, sacred and trespassed.

Approximate palette [A]:
- Twilight sky deep purple: `#2E2450`, `#4B3B6E`
- Horizon rose/lavender haze (Azshara dusk): `#B586B0`, `#D8A0A8`
- Moonlight silver-blue: `#C7D5E8`
- White marble (lit): `#D8D5CE`; weathered stone: `#B8B2A6`; stone shadow: `#8A8578`
- Teal/verdigris trim: `#3E8E8B`, `#56B3A9`; deep teal: `#2E6E6C`
- Arcane glow violet/magenta: `#8E3FD0`, `#B14FE0`; rune highlight: `#C77DFF`, `#D9A8F5`
- Moonwell glow: `#BFEAF5`
- Vine/moss greens: `#5B7442`, `#7A9457`
- Purple flora / night-elf trees: `#6E4A9E`, `#9B6BC7`
- Azshara autumn canopy: `#C97B2E`, `#A6432E`
- Dire Maul interior teal light/water: `#4FA8A0`; indoor indigo ambient: `#3A3358`
- Ghost/wisp FX: `#A8D8E8` at low alpha

---

## 2. WIZARD101 (2008, KingsIsle)

### 2.1 Overall art style

- **Positioning**: aimed between Toontown/Club Penguin and WoW; tone deliberately
  "whimsical." Todd Coleman (creative lead): influences are Dragonlance, Discworld,
  Narnia ("closer thematic match than Harry Potter"), Dark Crystal "with a more
  whimsical, comical flair," old Final Fantasy, Shining Force. Character mantra: "big
  power comes in small packages." Consistency mandate: "All of the art in the game...
  has a really consistent look, style, and feel." [S]
- **Storybook readability**: bright saturated color, rounded simplified forms, clean
  silhouettes; "Everything has a Disneyland-like-magic feel" (reviewer). [S]
- **Longevity philosophy** (Karl Holbert, Art Director since 2006; Artie Rogers): "good,
  light-hearted humour is timeless"; "good puns, good humour transcend all ages." [S]
- **Concept pipeline** (Adam Roush): 2D Photoshop for gear/weapons, quick 3D for
  environments/mounts/props; heavy material contrast focus ("mirror-finish metal against
  the matte metal"). Original 2005 concept sheets still guide the style. [S]
- **World formula**: each Spiral world = one strong cultural/genre pastiche, color-coded:
  Wizard City (storybook fantasy town), Krokotopia (Egypt), Marleybone (Victorian London
  dogs), MooShu (East Asia), Dragonspyre (volcanic doom), Grizzleheim (Norse — "airy,
  outdoor landscape of snowy mountains, glacial ridges and towering trees," Viking
  Bears/Wolves/Ravens, longboats, runestones), Darkmoor (gothic horror). [S]

### 2.2 School-of-magic color coding

School color pairs (official/community-canon; hexes [A]):
- Fire: red &amp; orange — `#C0392B` / `#F28C28`
- Ice: blue &amp; white — `#9CD6F0` / `#FFFFFF`
- Storm: purple &amp; yellow — `#7B4FA6` / `#F5D442`
- Myth: yellow &amp; blue — `#F2C744` / `#3A5FA8`
- Life: green &amp; brown — `#5DA53F` / `#7A5230`
- Death: black &amp; white — `#1A1A1A` / `#E8E8E8`
- Balance: tan &amp; maroon — `#C9A66B` / `#7E2D33`
- Shadow: black/dark violet — `#2E1A3A` / `#6C2FA0` [A]
Color coding is total: spell cards, gems, classrooms, teacher outfits, gear, school trees. [C]

### 2.3 World design — Ravenwood + the spooky-cozy zones

- **Ravenwood**: school campus around Bartleby, the Grandfather Tree (cosmic world-tree
  with a face; trunk contains the World Gate). Five school houses ring him; the Death
  school is MISSING — it fell into Nightside after Malistaire's grief-driven turn; the
  gap is environmental storytelling inside the sunny hub. [S]
- **NIGHTSIDE (spooky-cozy exhibit A)**: hidden behind the waterfall by Rainbow Bridge;
  an "under-plane" "between the realms of Life and Death"; "dreary domain of Lord
  Nightshade"; contains the Death School, Mortis the Death Tree, hunchbacked assistant
  professor Dworgyn; gateway to Sunken City. Perpetual night a door away from perpetual
  noon — the contrast IS the design. Halloween events anchor seasonal spookiness. [S]
  - Visual read [A]: navy/indigo `#1B2440`/`#241B36`, pale moon `#DDE6F5`, grey-violet
    ground `#4A4258`, ghost-green `#77E67A`, jack-o-lantern `#F49B2C`.
- **DARKMOOR (spooky-cozy exhibit B)**:
  - 2014 Castle Darkmoor dungeon: official dev blog cites Universal Monster films;
    Creative Lead Jesse Scoble: "Dracula is the 'king' of the monster/horror genre" —
    castle inspired by Dracula, Castlevania, Ravenloft; werewolves, vampires, undead
    knights, gargoyles. Teaser imagery: silhouetted castle against a giant moon. [S]
  - 2025 full Darkmoor world: "a world of monsters and despair," "hauntingly beautiful";
    fog-shrouded streets, cursed houses, capital Graveholm ruled by the Parliament of
    Night; factions as card suits — Gargoyles (Swords), Scholomari (Wands, "Scholomance
    — an academy of terrible things"), Vampires (Cups), Werewolves (Coins). [S]
  - Visual read [A]: fog grey-blue `#5A6273`, moonlit slate `#39415A`, silhouette black
    `#14121C`, cold moon `#DDE6F5`, vampiric red `#7E1F2B`, ghost-fire cyan `#58D8C4`,
    shadow violet `#6C2FA0`, candle amber `#E8A13C`.
- **How a kids' game does "dark fantasy lite"** (synthesized rules): [A/C]
  1. Darkness is a PLACE you visit from a bright hub, never the baseline.
  2. Horror via affectionate pastiche of public-domain monster canon — Halloween, not trauma.
  3. Monsters are characters with jobs, manners, puns, and politics; comic relief lives
     inside the spooky zone.
  4. No gore, no black-black: darkness is blue/violet, broken by saturated glows.
  5. Rounded storybook shapes persist unchanged in dark zones — silhouette as comfort.
  6. Real emotional stakes allowed (Malistaire's grief) but resolved with warmth.
  7. Seasonal events train players that spooky = festive.

### 2.4 Character design

- **Avatar formula**: youthful wizards, simplified faces, storybook proportions;
  silhouette = pointed wide-brimmed hat + knee/ankle-length robe + boots + wand/staff. [S/C]
- **Color ownership**: dyeable two-tone gear (base + trim); players dress in school
  colors; school-themed stitched sets. [S/C]
- **Design history**: character concepts date to 2005; one 2005 concept outfit shipped
  years later as the "Celestial Garment." Concept archive curated by Karl Holbert. [S]

---

## 3. Cross-game takeaways [A]

- Both games prove the same thesis from opposite ends: hand-authored stylization +
  strict palette discipline + silhouette-first design outlives tech.
- Both use per-zone color scripting as the primary mood tool (WoW: Light.dbc sky/fog
  spheres; W101: per-world palette + school color coding).
- "Purple twilight + white ruin + teal accent + arcane glow" (WoW night elf) and
  "indigo night + pale moon + orange/green glow" (W101 Nightside/Darkmoor) are sibling
  recipes: darkness rendered in saturated cool hues punctured by warm/neon light
  sources, never in desaturated black.

---

## Sources

WoW — art direction / interviews / talks:
- https://gamingtrend.com/interviews/exclusive-interview-with-blizzard-senior-art-director-samwise-didier/
- https://www.shacknews.com/article/111727/samwise-didier-discusses-the-history-of-warcrafts-art
- https://www.forbes.com/sites/hnewman/2020/10/31/blizzard-founding-artist-samwise-didier-chats-about-his-methods-and-drawing-women-with-muscles/
- https://80.lv/articles/matt-mcdaid-mastering-the-stylized-art
- https://80.lv/articles/004adk-talking-about-stylized-character-art
- https://80.lv/articles/world-of-warcraft-vfx-overview-from-luis-aguas
- https://magazine.artstation.com/2018/09/blizzard-entertainment-world-warcraft-art-blast-visual-development-environments/
- https://www.cookandbecker.com/en/article/378/designing-overwatch.html
- https://wowpedia.fandom.com/wiki/Bill_Petras
- https://www.ausgamers.com/features/read/3485713
- http://www.wowhead.com/news=283152/the-starting-zone-interview-with-gary-platner-principal-exterior-level-designer
- http://www.wowhead.com/news=174274/first-darkmoon-faire-unlockable-interview-with-environment-artist-gary-platner
- https://gdcvault.com/play/1011927/The-Universe-of-World-of
- https://www.gdcvault.com/play/1014673/Remaking-the-WORLD-OF-WARCRAFT
- https://gdcvault.com/play/1029418/Visual-Effects-Summit-World-of
- https://whenitsready.com/wowdiary/
- https://www.youtube.com/watch?v=ptwQWuDsExQ

WoW — technical:
- https://wowdev.wiki/ADT/v18
- https://wowdev.wiki/WMO and https://wowdev.wiki/WMO/Rendering
- https://wowdev.wiki/DB/Light, https://wowdev.wiki/DB/LightData,
  https://wowdev.wiki/DB/LightIntBand, https://wowdev.wiki/DB/LightSkybox,
  https://wowdev.wiki/LIT
- https://www.ownedcore.com/forums/world-of-warcraft/world-of-warcraft-model-editing/wow-me-tools-guides/72597-guide-how-actually-edit-skies-lights.html
- https://wowdev.wiki/BLP
- https://wowdev.wiki/Character_Customization
- https://gamedev.net/forums/topic/367417-how-many-polys-and-bones-in-a-wow-model/
- https://www.gameskinny.com/news/warlords-of-draenor-updated-character-models/
- https://wowwiki-archive.fandom.com/wiki/System_requirements

WoW — night elf ruins:
- https://warcraft.wiki.gg/wiki/Dire_Maul
- https://wowwiki-archive.fandom.com/wiki/Eldre'Thalas
- https://wowpedia.fandom.com/wiki/Azshara_(Classic)
- https://wowpedia.fandom.com/wiki/Ruins_of_Kel'Theril
- https://www.engadget.com/2010-07-31-know-your-lore-history-of-the-shendralar.html

Wizard101:
- https://www.engadget.com/2008-06-30-massively-interview-kingsisle-on-wizard101.html
- https://www.escapistmagazine.com/wizard-101-interview/
- https://101universe.fandom.com/wiki/Karl_Holbert
- https://www.swordroll.com/2021/09/adam-roush-wizard101-concept-art.html
- https://kingsisleblog.com/2014/12/09/darkmoor-dungeon-design/
- https://kingsisleblog.com/2015/05/14/throwback-thursday-original-character-concepts/
- https://www.darkmoor.wizard101.com/
- https://gamedaily.com/news/wizard101s-darkmoor-update-unveiled-a-dark-new-chapter-arrives
- https://101universe.fandom.com/wiki/Darkmoor and https://101universe.fandom.com/wiki/Nightside
- https://wiki.wizard101central.com/wiki/Location:Nightside and
  https://wiki.wizard101central.com/wiki/Location:Ravenwood
- https://www.wizard101.com/game/worlds/grizzleheim
- https://www.swordroll.com/2014/10/wizard101-darkmoor-new-world-teasers.html
- https://www.gamezebo.com/reviews/wizard-101-review/
- https://www.color-hex.com/color-palette/21253
- https://allthetropes.org/wiki/Wizard_101
- https://en.wikipedia.org/wiki/Wizard101

Caveats: all hex values are approximations [A], not extracted from game files; vanilla
"256x256" texture figures are modding-community consensus [C]; the Petras readability
quote is from his Overwatch era; Escapist/Gamezebo quotes came via search excerpts.
