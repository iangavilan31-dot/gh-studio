// ============================================================
// EMBERVALE — procedural pixel art v2
// Style bible (from the reference frames):
//   - warm highlights vs deep cool shadows, low sat except lights
//   - painterly clustered canopies, 3-tone shading, soft outlines
//   - cream-gold cobbles, teal water, red roofs, lantern gold
// ============================================================

function px(rows, pal) {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]
      if (ch === '.' || ch === ' ') continue
      const col = pal[ch]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (h >>> 0) / 4294967295
}

// ============================================================
// CHARACTERS — 14 wide, outlined, 3-tone shading, side view
// ============================================================
const P_KNIGHT = {
  o: '#191322', // outline
  p: '#a63c48', // plume
  s: '#c8d2e0', S: '#8c9aad', z: '#525f70', // steel light/mid/dark
  c: '#3d4c6b', C: '#293552', d: '#1d2740', // tabard
  h: '#e0aa74', e: '#191322',
  l: '#6b4a2b', L: '#4a3220', // leather
  g: '#d8a84f', // gold trim
  t: '#7a5636', // torch wood
  f: '#ffd23d', F: '#ff9a3d',
}
const KNIGHT_IDLE = [
  '.......pp.......',
  '......oppо......',
  '......ossSо.....',
  '.....osSSSSо....',
  '.....oeeeeSо....',
  '......oSSSо.....',
  '..oto..gggо.....',
  '.otоhogccgо.....',
  '.otо.occccоzо...',
  '.ohо.occccоzо...',
  '..oо.oCccCо.zо..',
  '.....occccо.о...',
  '.....oCCCCо.....',
  '.....odCCdо.....',
  '.....oCооCо.....',
  '....oCCо.oCCо...',
  '....ozо...ozо...',
  '...ozzо...ozzо..',
]
const KNIGHT_WALK1 = [
  '.......pp.......',
  '......oppо......',
  '......ossSо.....',
  '.....osSSSSо....',
  '.....oeeeeSо....',
  '......oSSSо.....',
  '..oto..gggо.....',
  '.otоhogccgо.....',
  '.otо.occccоzо...',
  '.ohо.occccоzо...',
  '..oо.oCccCо.zо..',
  '.....occccо.о...',
  '.....oCCCCо.....',
  '.....odCCdо.....',
  '....oCCооCCо....',
  '....oCо...оCо...',
  '...ozо.....ozо..',
  '...ozzо...ozzо..',
]
const KNIGHT_WALK2 = [
  '.......pp.......',
  '......oppо......',
  '......ossSо.....',
  '.....osSSSSо....',
  '.....oeeeeSо....',
  '......oSSSо.....',
  '..oto..gggо.....',
  '.otоhogccgо.....',
  '.otо.occccоzо...',
  '.ohо.occccоzо...',
  '..oо.oCccCо.zо..',
  '.....occccо.о...',
  '.....oCCCCо.....',
  '.....odCCdо.....',
  '.....oCCCCо.....',
  '......oCCо......',
  '.....ozzzо......',
  '.....ozzzzо.....',
]
const KNIGHT_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oooо.....',
  '...ooosssSoo....',
  '..ossSssssssо...',
  '.osshheessSccо..',
  '.oszsssccccCCо..',
  '..ozzoCCCCdCо...',
  '...oо.oCоCо.о...',
  '.....ozо.ozо....',
]
const P_PYRO = {
  o: '#1c1018',
  t: '#5c4028',
  s: '#a63c48', S: '#802a38', z: '#571d28', // robe light/mid/dark
  c: '#a63c48', C: '#802a38', d: '#571d28',
  h: '#e0aa74', e: '#1c1018',
  w: '#e8ddc8', W: '#c4b89e', // cowl trim
  g: '#d8a84f',
  t: '#5c4028', T: '#3d2a1a', // staff
  f: '#ffd23d', F: '#ff9a3d',
}
const PYRO_IDLE = [
  '......oooо......',
  '.....ozsssо.....',
  '.....ossssо.....',
  '....ozhhhhо.....',
  '....ozheehо..t..',
  '.....ohhhо..otо.',
  '...oo.wwwwо.otо.',
  '..oso.gccgо.otо.',
  '..osо.ccccоohtо.',
  '..ozо.ccccо.otо.',
  '...oо.CccCо.oо..',
  '.....occccо.....',
  '.....occccо.....',
  '.....oCCCCо.....',
  '.....oCCCCо.....',
  '....ozCCCCzо....',
  '....ozzCCzzо....',
  '...ozzzzzzzzо...',
]
const PYRO_WALK1 = [
  '......oooо......',
  '.....ozsssо.....',
  '.....ossssо.....',
  '....ozhhhhо.....',
  '....ozheehо..t..',
  '.....ohhhо..otо.',
  '...oo.wwwwо.otо.',
  '..oso.gccgо.otо.',
  '..osо.ccccоohtо.',
  '..ozо.ccccо.otо.',
  '...oо.CccCо.oо..',
  '.....occccо.....',
  '.....occccо.....',
  '.....oCCCCо.....',
  '....ozCC.CCzо...',
  '....ozC...Czо...',
  '...ozz.....zzо..',
  '...ozzо...ozzо..',
]
const PYRO_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.......oooо.....',
  '...ooozsssoo....',
  '..ozssssssssо...',
  '.ozshheessccо...',
  '.ozzsssccccCCо..',
  '..ozzoCCCCdCо...',
  '...oо.zCCCzо....',
  '.....ozzzzzо....',
]
// ============================================================
// ENEMIES — outlined, shaded
// ============================================================
const P_HUSK = { o: '#10140e', k: '#6d7c5c', K: '#47543c', d: '#31382a', e: '#b8ffb0', r: '#4e4838', R: '#332f24' }
const HUSK_A = [
  '....okko....',
  '...okkkkо...',
  '...oeKKeо...',
  '...oKkkKо...',
  '..oorrRоо...',
  '.orоrrrrо...',
  '.orо.rrrо...',
  '.orо.orrо...',
  '..o..oRrо...',
  '.....oRо.о..',
  '....oRо.Rо..',
  '...odо..dо..',
]
const HUSK_B = [
  '....okko....',
  '...okkkkо...',
  '...oeKKeо...',
  '...oKkkKо...',
  '..oorrRоо...',
  '.orоrrrrо...',
  '.orо.rrrо...',
  '.orо.orrо...',
  '..o..oRrо...',
  '....oRrо....',
  '...oRо.оRо..',
  '..odо...dо..',
]
const P_HOUND = { o: '#0e0c14', k: '#332e42', K: '#211d2e', l: '#48415c', e: '#e05a5a', t: '#48415c' }
const HOUND_A = [
  '............ooo.',
  '.oo........olkkо',
  'olkoo...ooklkkeо',
  'olkkkoooklkkkkkо',
  '.okkkkkkkkkkkoо.',
  '.oKkkkkkkkkKkо..',
  '..okKkkkkKkkо...',
  '..olо.okkо.olо..',
  '..otо..otо..oо..',
]
const HOUND_B = [
  '............ooo.',
  '.oo........olkkо',
  'olkoo...ooklkkeо',
  'olkkkoooklkkkkkо',
  '.okkkkkkkkkkkoо.',
  '.oKkkkkkkkkKkо..',
  '..okKkkkkKkkо...',
  '...olkо.oklо....',
  '....otо.otо.....',
]
const P_CULT = { o: '#171020', r: '#5c4a74', R: '#43355a', d: '#2e2440', m: '#ded8c4', M: '#b5ac92', e: '#120c18', g: '#8fdcff' }
const CULT_A = [
  '....oooo....',
  '...oRrrRо...',
  '..oRrrrrRо..',
  '..ormmmmrо..',
  '..ormeemMо..',
  '...ommmmо...',
  '..oorrrroo..',
  '.orrorrorrо.',
  '.oRrорrоRrо.',
  '.oRо.rr.оgо.',
  '..o.orrо.gо.',
  '...orrrrо...',
  '...oRRRRо...',
  '..oddddddо..',
]
const P_BRUTE = { o: '#12141a', s: '#6d7484', S: '#4d5464', d: '#343a48', m: '#5d7055', e: '#ffd23d', c: '#43485a' }
const BRUTE_A = [
  '.....oossoo.....',
  '...oossssssoo...',
  '...osSssssSsо...',
  '...oseоssоesо...',
  '...ossssssssо...',
  '..oossSSSSsоо...',
  '.ossssmssssssо..',
  'osSsoSSSSSSosSо.',
  'ossoSssssssoSsо.',
  'osdоSsmsssSоdsо.',
  'oddоSsssssSоddо.',
  '.oоoSSssssSо.o..',
  '...osssssssо....',
  '...oSSо.oSSо....',
  '..odSSо.oSSdо...',
  '..odddо.odddо...',
]
const P_KING = {
  o: '#10101c',
  w: '#e2e6ee', W: '#aab2c6', v: '#7a8298', // bone-pale
  c: '#c8b45c', C: '#96854a', // tarnished crown
  k: '#413c5c', K: '#2c2842', d: '#1c1930', // cloak
  e: '#8fdcff', f: '#a5ecff',
}
const KING_A = [
  '....oc.c.c.cо....',
  '....occcccccо....',
  '....oCcCcCcCо....',
  '....owwwwwwо.....',
  '...owWwwwwWwо....',
  '...oweо.оewо.....',
  '...owwwvwwwо.....',
  '....owwwwwо......',
  '..ookkwwwkkoo....',
  '.okkkkkkkkkkkо...',
  'okkоkkkkkkkоkkо..',
  'okfоkKkkkKkоwkо..',
  'okfоkkkkkkkоwkо..',
  'okfоkKkkkKkоwо...',
  '.ofоkkkkkkkоwо...',
  '.ofоkKkkkKkоwо...',
  '..oоkkkkkkkо.....',
  '...oKkkkkKо......',
  '...oKkkkkKо......',
  '...oKkkkkKkо.....',
  '..oKKkkkkkKKо....',
  '..oddKKKKKddо....',
  '.odddddddddddо...',
]

// ============================================================
// NPCS
// ============================================================
const P_VILL = { o: '#171420', h: '#e0aa74', e: '#171420', c: '#66754e', C: '#48543a', b: '#2e2735', g: '#c4b89e', G: '#9a8f76' }
const VILL_A = [
  '...oGGGGо...',
  '..oGggggGо..',
  '..oghhhhgо..',
  '..oghеehgо..',
  '...ohhhhо...',
  '..oocccoo...',
  '.occоccоccо.',
  '.oCcоccоCcо.',
  '..o.occо.o..',
  '...occccо...',
  '...oCCCCо...',
  '...oCо.Cо...',
  '..obо..obо..',
]
const P_ELDER = { o: '#171420', h: '#cdb694', e: '#171420', c: '#6d5d84', C: '#4e4260', b: '#2e2735', g: '#ded8c8', G: '#b0a890', t: '#8a7a5a' }
const ELDER_A = [
  '...oGGGGо...',
  '..oGggggGо..',
  '..oghhhhgо..',
  '..oghеehgо..',
  '..oGghhgGо..',
  '.otоccccоо..',
  '.otоccccccо.',
  '.otо.ccо.cо.',
  '.otоccccо...',
  '.otоCCCCо...',
  '.otоCCCCо...',
  '.otоCCCCо...',
  '..oоCCCCо...',
]
const P_SMITH = { o: '#171420', h: '#c98a5c', e: '#171420', c: '#4e4e5c', C: '#38384a', b: '#2e2735', a: '#7a5636', A: '#5c4028', s: '#9aa8ba' }
const SMITH_A = [
  '...oAAAAо...',
  '..oAaaaaAо..',
  '..oahhhhaо..',
  '..oahеehaо..',
  '...ohhhhо...',
  '..oscccoo...',
  '.ossоccоccо.',
  '.osо.ccо.cо.',
  '..oоccccо...',
  '..oaaaaaaо..',
  '...oCо.Cо...',
  '..obо..obо..',
]
const P_CHILD = { o: '#171420', h: '#e0aa74', e: '#171420', c: '#9a5444', C: '#743d32', b: '#2e2735' }
const CHILD_A = [
  '...ohhhhо...',
  '...ohеehо...',
  '...ohhhhо...',
  '..occccоо...',
  '.occоccоcо..',
  '..oоccccо...',
  '...oCCо.....',
  '...oCо.Cо...',
  '..obо..obо..',
]

// ============================================================
// PROPS
// ============================================================
const P_PROP = {
  o: '#151220',
  w: '#7a5636', W: '#5c4028', x: '#3d2a1a',
  s: '#6d7484', S: '#4d5464', d: '#343a48',
  f: '#ffd23d', F: '#ff9a3d', r: '#ff6a2d',
  g: '#d8a84f', G: '#a87c34',
  m: '#5d7055', c: '#c8b45c', i: '#9aa8ba', e: '#8fdcff',
}
const TORCHPOST = [
  '.oooo....',
  'owwwwoо..',
  '.oowWоo..',
  '...oso...',
  '..osssо..',
  '..sofoso.',
  '..soFоso.',
  '..osssо..',
  '...oWо...',
  '...owWо..',
  '...owWо..',
  '...owWо..',
  '...owWо..',
  '..oWwWWо.',
]
const BRAZIER_OFF = [
  '.ossssо.',
  'osSddSsо',
  'osddddsо',
  '.ossssо.',
  '..osSо..',
  '..osSо..',
  '.osssSо.',
  'osSо.oSо',
]
const BRAZIER_ON = [
  '...ffо..',
  '..ofFfо.',
  '.ofFFrfо',
  '.orfFfrо',
  'osfrrfsо',
  'osSffSsо',
  '.ossssо.',
  '..osSо..',
  '..osSо..',
  '.osssSо.',
  'osSо.oSо',
]
const BONFIRE = [
  '....fо...',
  '...oFfо..',
  '..ofFFfо.',
  '..oFrFFо.',
  '.ofrFfrfо',
  '.owfffwWо',
  'owWwwWwWо',
  'oWx.ww.xо',
]
const CHEST_CLOSED = [
  '.owwwwwwwо.',
  'owWWWWWWWwо',
  'owwwgwwwwwо',
  'owWWoGoWWwо',
  'owwwwgwwwwо',
  'oxWWWWWWWxо',
]
const CHEST_OPEN = [
  '.oxxxxxxxо.',
  'ofFFFFFFFfо',
  'owwwgwwwwwо',
  'owWWoGoWWwо',
  'owwwwgwwwwо',
  'oxWWWWWWWxо',
]
const KEYSPR = [
  '.occо.',
  'ocоocо',
  '.occо.',
  '..ocо.',
  '.occо.',
  '..ocо.',
  '.occо.',
]
const SIGIL = [
  '..oeeо..',
  '.oeоieо.',
  'oeо.i.eо',
  '.oeоieо.',
  '..oeeо..',
]
const EMBER = [
  '.fо',
  'fgf',
  '.gо',
]
const HEARTPICK = [
  '.of.fо.',
  'ofFfFfо',
  'offfffо',
  '.offfо.',
  '..ofо..',
]

export const SPR = {}
export function initSprites() {
  const fix = (rows) => rows.map((r) => r.replace(/о/g, 'o').replace(/е/g, 'e').replace(/к/g, 'k')) // normalize lookalike chars
  const p2 = (rows, pal) => px(fix(rows), pal)
  SPR.knight = { idle: p2(KNIGHT_IDLE, P_KNIGHT), walk: p2(KNIGHT_WALK1, P_KNIGHT), walk2: p2(KNIGHT_WALK2, P_KNIGHT), down: p2(KNIGHT_DOWN, P_KNIGHT) }
  SPR.pyro = { idle: p2(PYRO_IDLE, P_PYRO), walk: p2(PYRO_WALK1, P_PYRO), walk2: p2(PYRO_IDLE, P_PYRO), down: p2(PYRO_DOWN, P_PYRO) }
  SPR.husk = [p2(HUSK_A, P_HUSK), p2(HUSK_B, P_HUSK)]
  SPR.hound = [p2(HOUND_A, P_HOUND), p2(HOUND_B, P_HOUND)]
  SPR.alpha = [p2(HOUND_A, { ...P_HOUND, k: '#4a3050', K: '#33203a', l: '#5f4266', e: '#ffd23d' }), p2(HOUND_B, { ...P_HOUND, k: '#4a3050', K: '#33203a', l: '#5f4266', e: '#ffd23d' })]
  SPR.cultist = [p2(CULT_A, P_CULT)]
  SPR.brute = [p2(BRUTE_A, P_BRUTE)]
  SPR.sentinel = [p2(BRUTE_A, { ...P_BRUTE, s: '#565073', S: '#3d3852', d: '#282438', m: '#803445', e: '#8fdcff' })]
  SPR.wisp = [makeWisp()]
  SPR.paleking = [p2(KING_A, P_KING)]
  SPR.villager = p2(VILL_A, P_VILL)
  SPR.elder = p2(ELDER_A, P_ELDER)
  SPR.smith = p2(SMITH_A, P_SMITH)
  SPR.child = p2(CHILD_A, P_CHILD)
  SPR.torchpost = p2(TORCHPOST, P_PROP)
  SPR.brazierOff = p2(BRAZIER_OFF, P_PROP)
  SPR.brazierOn = p2(BRAZIER_ON, P_PROP)
  SPR.bonfire = p2(BONFIRE, P_PROP)
  SPR.chest = p2(CHEST_CLOSED, P_PROP)
  SPR.chestOpen = p2(CHEST_OPEN, P_PROP)
  SPR.key = p2(KEYSPR, P_PROP)
  SPR.sigil = p2(SIGIL, P_PROP)
  SPR.ember = p2(EMBER, P_PROP)
  SPR.heart = p2(HEARTPICK, { o: '#40121a', f: '#d64550', F: '#ef8a8a', g: '#e8a33d' })
}

function makeWisp() {
  // drawn pixel spirit: diamond core, stepped halo, trailing motes
  return px([
    '....a....',
    '...aba...',
    '..abcba..',
    '...aba...',
    '....a....',
    '..d...d..',
    '.....d...',
  ], { a: 'rgba(112,204,150,0.55)', b: '#a8f0c2', c: '#eafff2', d: 'rgba(112,204,150,0.4)' })
}

// ============================================================
// TILE PAINTERS v2 — neighbor-aware, painterly clusters
// getCh(tx,ty) lets painters see the map for edges/clusters.
// ============================================================
const STYLES = {
  village: {
    grass: ['#243430', '#243430', '#243430', '#243430'],
    grassMid: '#2e4a38',
    grassLit: '#4a6b46',
    grassHi: '#7aa04e',
    deco: '#1c2a24',
    cobble: ['#a08a64', '#8f7a58', '#b39a70'],
    cobbleHi: '#c9b184',
    cobbleGap: '#4b4034',
    treeStyle: 'broadleaf',
  },
  forest: {
    grass: ['#222c3a', '#222c3a', '#222c3a', '#222c3a'],
    grassMid: '#2e483f',
    grassLit: '#42654f',
    grassHi: '#548a54',
    deco: '#1a2230',
    cobble: ['#5f5344', '#544938', '#6d5f4c'],
    cobbleHi: '#82715a',
    cobbleGap: '#2e271d',
    treeStyle: 'conifer',
  },
  tower: {
    grass: ['#41414e', '#3b3b47', '#474756', '#36363f'],
    grassLit: '#54546a',
    deco: '#31313c',
    cobble: ['#434353', '#3a3a49', '#4c4c5f'],
    cobbleHi: '#5f5f75',
    cobbleGap: '#2a2a34',
    treeStyle: 'stone',
  },
  castle: {
    grass: ['#3a3547', '#342f40', '#403a50', '#2e2a38'],
    grassLit: '#4d4763',
    deco: '#282334',
    cobble: ['#544e66', '#494359', '#5f5875'],
    cobbleHi: '#746c8f',
    cobbleGap: '#262130',
    treeStyle: 'stonedark',
  },
  beacon: {
    grass: ['#454057', '#3e3a4e', '#4c4760', '#383348'],
    grassLit: '#5c5675',
    deco: '#332f42',
    cobble: ['#5f5872', '#544e64', '#6b6380'],
    cobbleHi: '#837a9c',
    cobbleGap: '#2b2738',
    treeStyle: 'stone',
  },
}

const GROUND_CHARS = new Set(['.', ',', '+', '=', 'P', '*', '1', '2', '3', '4', 'E', 'W', 'U', 'M', 's', 'A', 'S', 'K', 'N', 'B', 'Z', 'C', 'T', 'O', 'G', 'R', 'H', 'h'])

export function paintTile(g, ch, tx, ty, style, getCh) {
  const S = STYLES[style] || STYLES.forest
  const X = tx * 16
  const Y = ty * 16
  const r = hash2(tx, ty)
  switch (ch) {
    case '=':
      paintCobbles(g, X, Y, tx, ty, S, getCh)
      break
    case '~':
      paintWater(g, X, Y, tx, ty, getCh)
      break
    case 'R':
      paintGrass(g, X, Y, tx, ty, S, getCh)
      paintRock(g, X, Y, r)
      break
    case '+':
      paintGrass(g, X, Y, tx, ty, S, getCh)
      paintFlowers(g, X, Y, r)
      break
    case ',':
      paintGrass(g, X, Y, tx, ty, S, getCh)
      paintTuft(g, X, Y, r, S)
      break
    case '#':
      if (S.treeStyle === 'broadleaf' || S.treeStyle === 'conifer') paintTreeTile(g, X, Y, tx, ty, S, getCh)
      else paintWallTile(g, X, Y, tx, ty, S, getCh, style)
      break
    default:
      paintGrass(g, X, Y, tx, ty, S, getCh)
      break
  }
}

const DECALS = [
  paintDecalFlowerBank,
  paintDecalStoneGroup,
  paintDecalTuftClump,
  paintDecalStump,
  paintDecalFern,
  paintDecalMushrooms,
]

function paintGrass(g, X, Y, tx, ty, S, getCh) {
  if (S.treeStyle === 'stone' || S.treeStyle === 'stonedark') {
    paintFlagstones(g, X, Y, tx, ty, S, false, getCh)
    return
  }
  // indigo shadow base — green lives only in the painted mid/lit clusters
  g.fillStyle = S.grass[0]
  g.fillRect(X, Y, 16, 16)
  // deliberate decal clusters, denser beside roads where the eye travels
  const nearPath = getCh && (getCh(tx + 1, ty) === '=' || getCh(tx - 1, ty) === '=' || getCh(tx, ty + 1) === '=' || getCh(tx, ty - 1) === '=')
  const rd = hash2(tx * 41 + 7, ty * 53 + 11)
  const dense = S.treeStyle === 'conifer'
  if (rd > (nearPath ? 0.35 : dense ? 0.55 : 0.68)) {
    DECALS[(hash2(tx * 13, ty * 29) * DECALS.length) | 0](g, X, Y, hash2(tx, ty), S)
  }
  // painterly grass clusters: fewer, chunkier 2-3px masses (no lone-pixel noise)
  for (let i = 0; i < 4; i++) {
    const rr = hash2(tx * 17 + i * 3, ty * 31 + i * 7)
    const fx = X + ((rr * 14) | 0) - 1
    const fy = Y + ((hash2(ty * 13 + i, tx * 7 + i) * 14) | 0) - 1
    const cw = 3 + ((rr * 4) | 0)
    if (rr > 0.58) {
      g.fillStyle = S.grassMid
      g.fillRect(fx, fy, cw, 2)
      g.fillRect(fx + 1, fy - 1, cw - 2, 2)
      if (rr > 0.78) {
        g.fillStyle = S.grassLit
        g.fillRect(fx + 1, fy - 1, Math.max(2, cw >> 1), 1)
      }
    } else if (rr < 0.2) {
      g.fillStyle = 'rgba(12,16,26,0.28)'
      g.fillRect(fx, fy, cw, 2)
      g.fillRect(fx + 1, fy + 2, cw - 1, 1)
    }
  }
  // occasional lit tuft or terracotta patch (2x2 minimum, never lone pixels)
  const rb = hash2(tx * 5 + 2, ty * 11 + 3)
  if (rb > 0.7) {
    g.fillStyle = S.grassHi
    const bx = X + ((rb * 11) | 0)
    const by = Y + ((hash2(tx, ty * 3) * 11) | 0)
    g.fillRect(bx, by, 2, 2)
    g.fillRect(bx + 1, by - 1, 1, 1)
  }
  if (rb < 0.05) {
    g.fillStyle = 'rgba(196,120,62,0.35)'
    g.fillRect(X + 3 + (((rb * 200) | 0) % 10), Y + 5 + (((rb * 130) | 0) % 8), 3, 2)
  }
}

function paintDecalFlowerBank(g, X, Y, r, S) {
  const cols = [['#c94f5e', '#e88a94'], ['#d8b44f', '#efd28a'], ['#b06ad0', '#d0a2e8']]
  for (let i = 0; i < 4; i++) {
    const rr = hash2(X + i * 7, Y + i * 13)
    const [c1, c2] = cols[((r + i * 0.31) * 3 | 0) % 3]
    const fx = X + 1 + ((rr * 12) | 0)
    const fy = Y + 3 + ((hash2(Y + i, X) * 10) | 0)
    g.fillStyle = S.grassMid
    g.fillRect(fx - 1, fy + 1, 4, 2)
    g.fillStyle = c1
    g.fillRect(fx, fy, 2, 2)
    g.fillStyle = c2
    g.fillRect(fx, fy, 1, 1)
  }
}
function paintDecalStoneGroup(g, X, Y, r, S) {
  const sx = X + 3 + ((r * 6) | 0)
  const sy = Y + 5 + ((r * 5) | 0)
  g.fillStyle = 'rgba(10,12,20,0.5)'
  g.fillRect(sx - 1, sy + 2, 8, 2)
  g.fillStyle = '#5a6070'
  g.fillRect(sx, sy, 4, 3)
  g.fillRect(sx + 5, sy + 1, 3, 2)
  g.fillStyle = '#7a8296'
  g.fillRect(sx, sy, 3, 1)
  g.fillStyle = '#3c4252'
  g.fillRect(sx, sy + 2, 4, 1)
}
function paintDecalTuftClump(g, X, Y, r, S) {
  for (let i = 0; i < 3; i++) {
    const rr = hash2(X + i * 11, Y + i * 5)
    const fx = X + 2 + ((rr * 11) | 0)
    const fy = Y + 4 + ((hash2(Y + i * 3, X) * 9) | 0)
    g.fillStyle = S.grassMid
    g.fillRect(fx, fy + 1, 3, 2)
    g.fillStyle = S.grassLit
    g.fillRect(fx, fy, 1, 2)
    g.fillRect(fx + 2, fy, 1, 1)
    g.fillStyle = S.grassHi
    g.fillRect(fx + 1, fy - 1, 1, 1)
  }
}
function paintDecalStump(g, X, Y, r, S) {
  const sx = X + 4 + ((r * 5) | 0)
  const sy = Y + 5 + ((r * 4) | 0)
  g.fillStyle = 'rgba(10,12,20,0.5)'
  g.fillRect(sx - 1, sy + 4, 8, 2)
  g.fillStyle = '#4a3626'
  g.fillRect(sx, sy + 1, 6, 4)
  g.fillStyle = '#6b5138'
  g.fillRect(sx, sy, 6, 2)
  g.fillStyle = '#8a6a48'
  g.fillRect(sx + 1, sy, 4, 1)
  g.fillStyle = '#38281c'
  g.fillRect(sx + 2, sy + 1, 2, 1)
}
function paintDecalFern(g, X, Y, r, S) {
  const fx = X + 3 + ((r * 8) | 0)
  const fy = Y + 6 + ((r * 5) | 0)
  g.fillStyle = S.grassMid
  g.fillRect(fx - 2, fy, 2, 1)
  g.fillRect(fx + 2, fy, 2, 1)
  g.fillRect(fx, fy - 2, 1, 4)
  g.fillStyle = S.grassLit
  g.fillRect(fx - 3, fy - 1, 2, 1)
  g.fillRect(fx + 3, fy - 1, 2, 1)
  g.fillRect(fx, fy - 3, 1, 2)
}
function paintDecalMushrooms(g, X, Y, r, S) {
  const fx = X + 4 + ((r * 8) | 0)
  const fy = Y + 8 + ((r * 4) | 0)
  g.fillStyle = '#d8cbb8'
  g.fillRect(fx, fy, 1, 2)
  g.fillRect(fx + 3, fy + 1, 1, 1)
  g.fillStyle = '#c96a4a'
  g.fillRect(fx - 1, fy - 1, 3, 1)
  g.fillStyle = '#e8927a'
  g.fillRect(fx - 1, fy - 1, 1, 1)
  g.fillStyle = '#a85438'
  g.fillRect(fx + 2, fy, 3, 1)
}

function paintTuft(g, X, Y, r, S) {
  if (S.treeStyle === 'stone' || S.treeStyle === 'stonedark') {
    // rubble: scattered broken stone
    g.fillStyle = '#6a6a7c'
    const ox = 3 + ((r * 8) | 0)
    const oy = 4 + ((r * 7) | 0)
    g.fillRect(X + ox, Y + oy, 3, 2)
    g.fillRect(X + ox + 4, Y + oy + 2, 2, 1)
    g.fillStyle = '#83839a'
    g.fillRect(X + ox, Y + oy, 2, 1)
    g.fillStyle = 'rgba(8,6,14,0.5)'
    g.fillRect(X + ox, Y + oy + 2, 3, 1)
    g.fillRect(X + ox + 4, Y + oy + 3, 2, 1)
    return
  }
  g.fillStyle = S.deco
  const ox = 3 + ((r * 7) | 0)
  const oy = 4 + ((r * 5) | 0)
  g.fillRect(X + ox, Y + oy, 2, 1)
  g.fillRect(X + ox - 1, Y + oy + 1, 1, 2)
  g.fillRect(X + ox + 2, Y + oy + 1, 1, 1)
  g.fillStyle = S.grassLit
  g.fillRect(X + 11 - ((r * 6) | 0), Y + 10, 1, 2)
  g.fillRect(X + 12 - ((r * 6) | 0), Y + 11, 1, 1)
}

function paintFlowers(g, X, Y, r) {
  const flowers = [
    ['#d64550', '#ef8a8a'],
    ['#e8e0d0', '#b8b0a0'],
    ['#e8b83d', '#c98a2d'],
    ['#b06ad0', '#8a4aa8'],
  ]
  for (let i = 0; i < 3; i++) {
    const rr = hash2(X + i * 13, Y + i * 7)
    const [c1, c2] = flowers[((r + i * 0.37) * 4 | 0) % 4]
    const fx = X + 2 + ((rr * 11) | 0)
    const fy = Y + 3 + ((hash2(Y + i, X + i * 3) * 10) | 0)
    g.fillStyle = c2
    g.fillRect(fx - 1, fy, 3, 1)
    g.fillRect(fx, fy - 1, 1, 3)
    g.fillStyle = c1
    g.fillRect(fx, fy, 1, 1)
  }
}

function paintCobbles(g, X, Y, tx, ty, S, getCh) {
  if (S.treeStyle === 'stone' || S.treeStyle === 'stonedark') {
    paintFlagstones(g, X, Y, tx, ty, S, true, getCh)
    return
  }
  if (S.treeStyle === 'conifer') {
    paintDirtPath(g, X, Y, tx, ty, S, getCh)
    return
  }
  // village: warm cream cobbles — interlocking mixed-size stones
  g.fillStyle = S.cobbleGap
  g.fillRect(X, Y, 16, 16)
  const LAYOUTS = [
    [[0, 0, 7, 5], [8, 0, 7, 4], [0, 6, 5, 4], [6, 5, 9, 5], [0, 11, 8, 4], [9, 11, 6, 4]],
    [[0, 0, 5, 4], [6, 0, 9, 5], [0, 5, 8, 5], [9, 6, 6, 4], [0, 11, 6, 4], [7, 11, 8, 4]],
    [[0, 0, 8, 4], [9, 0, 6, 5], [0, 5, 6, 5], [7, 6, 8, 4], [0, 11, 9, 4], [10, 11, 5, 4]],
  ]
  const layout = LAYOUTS[(hash2(tx * 3 + 1, ty * 5 + 2) * 3) | 0]
  let si = 0
  for (const [ox, oy, sw, sh] of layout) {
    const rr = hash2(tx * 23 + si * 7, ty * 41 + si * 11)
    si++
    const sx = X + ox
    const sy = Y + oy
    const base = S.cobble[(rr * 3) | 0]
    g.fillStyle = base
    g.fillRect(sx + 1, sy, sw - 2, sh)
    g.fillRect(sx, sy + 1, sw, sh - 2)
    g.fillStyle = S.cobbleHi
    g.fillRect(sx + 1, sy, Math.max(2, (sw * 0.6) | 0), 1)
    g.fillRect(sx, sy + 1, 1, 2)
    g.fillStyle = 'rgba(10,8,14,0.4)'
    g.fillRect(sx + 1, sy + sh - 1, sw - 2, 1)
    g.fillRect(sx + sw - 1, sy + 1, 1, sh - 2)
  }
  const dirs = [[0, -1, X, Y, 16, 1], [0, 1, X, Y + 15, 16, 1], [-1, 0, X, Y, 1, 16], [1, 0, X + 15, Y, 1, 16]]
  for (const [dx, dy, ex, ey, ew, eh] of dirs) {
    const nc = getCh ? getCh(tx + dx, ty + dy) : '='
    if (nc !== '=' && GROUND_CHARS.has(nc)) {
      g.fillStyle = 'rgba(40,55,35,0.35)'
      g.fillRect(ex, ey, ew, eh)
    }
  }
}

function paintDirtPath(g, X, Y, tx, ty, S, getCh) {
  const r = hash2(tx, ty)
  g.fillStyle = S.cobble[(r * 3) | 0]
  g.fillRect(X, Y, 16, 16)
  // packed-earth mottling
  for (let i = 0; i < 6; i++) {
    const rr = hash2(tx * 19 + i * 5, ty * 23 + i * 3)
    const fx = X + ((rr * 14) | 0)
    const fy = Y + ((hash2(ty * 7 + i, tx * 11 + i) * 14) | 0)
    g.fillStyle = rr > 0.6 ? 'rgba(200,180,140,0.12)' : 'rgba(20,14,8,0.22)'
    g.fillRect(fx, fy, 2 + ((rr * 3) | 0), 1)
  }
  // pebbles
  const rp = hash2(tx * 3, ty * 5)
  if (rp > 0.45) {
    g.fillStyle = S.cobbleHi
    g.fillRect(X + 2 + ((rp * 10) | 0), Y + 3 + ((r * 9) | 0), 2, 1)
    g.fillStyle = 'rgba(20,14,8,0.4)'
    g.fillRect(X + 2 + ((rp * 10) | 0), Y + 4 + ((r * 9) | 0), 2, 1)
  }
  // wheel-rut wear lines
  g.fillStyle = 'rgba(15,10,6,0.10)'
  g.fillRect(X + 3, Y, 1, 16)
  g.fillRect(X + 11, Y, 1, 16)
  const dirs = [[0, -1, X, Y, 16, 1], [0, 1, X, Y + 15, 16, 1], [-1, 0, X, Y, 1, 16], [1, 0, X + 15, Y, 1, 16]]
  for (const [dx, dy, ex, ey, ew, eh] of dirs) {
    const nc = getCh ? getCh(tx + dx, ty + dy) : '='
    if (nc !== '=' && GROUND_CHARS.has(nc)) {
      g.fillStyle = 'rgba(25,38,26,0.4)'
      g.fillRect(ex, ey, ew, eh)
    }
  }
}

function paintFlagstones(g, X, Y, tx, ty, S, worn, getCh) {
  const r = hash2(tx, ty)
  if (worn && S.treeStyle === 'stonedark') {
    // the Pale King's processional carpet, moth-eaten
    paintFlagstonesBase(g, X, Y, tx, ty, S, false, getCh)
    g.fillStyle = '#4a1220'
    g.fillRect(X + 2, Y, 12, 16)
    g.fillStyle = '#641a2c'
    g.fillRect(X + 4, Y, 8, 16)
    g.fillStyle = '#330f1a'
    g.fillRect(X + 2, Y, 1, 16)
    g.fillRect(X + 13, Y, 1, 16)
    // gold edge trim + woven fabric shading
    g.fillStyle = 'rgba(216,168,79,0.55)'
    g.fillRect(X + 3, Y, 1, 16)
    g.fillRect(X + 12, Y, 1, 16)
    g.fillStyle = 'rgba(120,40,56,0.5)'
    for (let fy2 = (ty % 2) * 2; fy2 < 16; fy2 += 4) g.fillRect(X + 4, Y + fy2, 8, 1)
    g.fillStyle = 'rgba(30,8,16,0.4)'
    g.fillRect(X + 4, Y + 15, 8, 1)
    const rh = hash2(tx * 13, ty * 17)
    if (rh > 0.6) {
      g.fillStyle = S.cobble[1]
      g.fillRect(X + 3 + ((rh * 8) | 0), Y + 3 + ((r * 9) | 0), 3, 2)
      g.fillStyle = 'rgba(8,6,14,0.4)'
      g.fillRect(X + 3 + ((rh * 8) | 0), Y + 5 + ((r * 9) | 0), 3, 1)
    }
    return
  }
  paintFlagstonesBase(g, X, Y, tx, ty, S, worn, getCh)
}

function paintFlagstonesBase(g, X, Y, tx, ty, S, worn, getCh) {
  const r = hash2(tx, ty)
  // square 16x16 slabs in a half-offset bond, gentle per-slab tones
  const slabR = hash2(tx * 3 + (ty % 2), ty * 7)
  const base = worn ? S.cobbleHi : S.cobble[(slabR * 3) | 0]
  g.fillStyle = base
  g.fillRect(X, Y, 16, 16)
  g.fillStyle = 'rgba(8,6,14,0.3)'
  g.fillRect(X, Y, 16, 1)
  const vx = (ty % 2 ? 3 : 10) + ((slabR * 4) | 0)
  g.fillRect(X + vx, Y, 1, 16)
  g.fillStyle = 'rgba(255,255,255,0.05)'
  g.fillRect(X, Y + 1, 16, 1)
  g.fillStyle = 'rgba(8,6,14,0.12)'
  g.fillRect(X + ((r * 10) | 0), Y + 5 + ((r * 6) | 0), 4, 1)
  g.fillRect(X + 12 - ((r * 8) | 0), Y + 10, 2, 2)
  // per-slab tonal variation so open floors don't go flat
  if (slabR > 0.72) {
    g.fillStyle = 'rgba(255,255,255,0.04)'
    g.fillRect(X, Y, 16, 16)
  } else if (slabR < 0.2) {
    g.fillStyle = 'rgba(8,6,16,0.1)'
    g.fillRect(X, Y, 16, 16)
  }
  // cracks & moss
  const rc = hash2(tx * 7, ty * 3)
  if (rc > 0.78) {
    g.fillStyle = 'rgba(8,6,14,0.35)'
    let cx2 = X + ((rc * 12) | 0)
    let cy2 = Y + 3
    for (let i = 0; i < 4; i++) {
      g.fillRect(cx2, cy2, 1, 2)
      cx2 += rc > 0.88 ? 1 : -1
      cy2 += 3
    }
  }
  if (rc < 0.18) {
    g.fillStyle = 'rgba(85,110,80,0.32)'
    g.fillRect(X + ((r * 11) | 0), Y + 10 + ((rc * 30) | 0), 4, 2)
    g.fillRect(X + 2 + ((r * 8) | 0), Y + 12, 2, 1)
  }
    // baseboard drop shadow where the floor meets a wall face above
  if (getCh && getCh(tx, ty - 1) === '#') {
    g.fillStyle = 'rgba(6,4,14,0.7)'
    g.fillRect(X, Y, 16, 2)
    g.fillStyle = 'rgba(6,4,14,0.45)'
    g.fillRect(X, Y + 2, 16, 2)
    g.fillStyle = 'rgba(6,4,14,0.2)'
    g.fillRect(X, Y + 4, 16, 2)
  }
}

function paintWater(g, X, Y, tx, ty, getCh) {
  const r = hash2(tx, ty)
  // teal like the reference lake, deeper toward middle
  const isShore = (dx, dy) => {
    const nc = getCh ? getCh(tx + dx, ty + dy) : '~'
    return nc !== '~' && nc !== '#'
  }
  const shore = isShore(0, -1) || isShore(0, 1) || isShore(-1, 0) || isShore(1, 0)
  // depth banding: tiles fully surrounded by water go darker toward the middle
  let deep = !shore
  if (deep) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (isShore(dx, dy)) {
        deep = false
        break
      }
    }
  }
  g.fillStyle = shore ? '#28535c' : deep ? '#132e38' : r > 0.5 ? '#1d4049' : '#193a43'
  g.fillRect(X, Y, 16, 16)
  // ripple highlights (horizontal painterly strokes)
  g.fillStyle = 'rgba(120,200,205,0.16)'
  g.fillRect(X + ((r * 9) | 0), Y + 3 + ((r * 9) | 0), 5, 1)
  g.fillRect(X + 9 - ((r * 7) | 0), Y + 11, 4, 1)
  if (r > 0.7) {
    g.fillStyle = 'rgba(200,240,240,0.20)'
    g.fillRect(X + 3 + ((r * 8) | 0), Y + 6, 3, 1)
  }
  // shore: wet-sand rim + subdued foam, grass nibbles — no hard outline
  if (shore) {
    const wet = '#2c3a42'
    const sand = '#3f4a4a'
    const foam = 'rgba(150,196,190,0.35)'
    const nib = '#26323e'
    if (isShore(0, -1)) {
      g.fillStyle = sand
      g.fillRect(X, Y, 16, 2)
      g.fillStyle = wet
      g.fillRect(X, Y + 2, 16, 1)
      g.fillStyle = foam
      g.fillRect(X + ((r * 5) | 0), Y + 2, 9 - ((r * 4) | 0), 1)
      g.fillStyle = nib
      g.fillRect(X + ((r * 11) | 0), Y, 3 + ((r * 3) | 0), 1)
    }
    if (isShore(0, 1)) {
      g.fillStyle = sand
      g.fillRect(X, Y + 14, 16, 2)
      g.fillStyle = wet
      g.fillRect(X, Y + 13, 16, 1)
      g.fillStyle = foam
      g.fillRect(X + 2 + ((r * 5) | 0), Y + 13, 8 - ((r * 4) | 0), 1)
      g.fillStyle = nib
      g.fillRect(X + 3 + ((r * 9) | 0), Y + 15, 3 + ((r * 3) | 0), 1)
    }
    if (isShore(-1, 0)) {
      g.fillStyle = sand
      g.fillRect(X, Y, 2, 16)
      g.fillStyle = wet
      g.fillRect(X + 2, Y, 1, 16)
      g.fillStyle = foam
      g.fillRect(X + 2, Y + ((r * 6) | 0), 1, 8 - ((r * 4) | 0))
      g.fillStyle = nib
      g.fillRect(X, Y + ((r * 11) | 0), 1, 3 + ((r * 3) | 0))
    }
    if (isShore(1, 0)) {
      g.fillStyle = sand
      g.fillRect(X + 14, Y, 2, 16)
      g.fillStyle = wet
      g.fillRect(X + 13, Y, 1, 16)
      g.fillStyle = foam
      g.fillRect(X + 13, Y + 2 + ((r * 5) | 0), 1, 8 - ((r * 4) | 0))
      g.fillStyle = nib
      g.fillRect(X + 15, Y + 2 + ((r * 10) | 0), 1, 3 + ((r * 3) | 0))
    }
  } else if (!deep) {
    // dithered transition from mid band to the deep center
    let deepBelow = true
    for (const [dx, dy] of [[0, 1], [-1, 1], [1, 1]]) {
      const nc = getCh ? getCh(tx + dx, ty + dy) : '~'
      if (nc !== '~') deepBelow = false
    }
    if (deepBelow) {
      g.fillStyle = '#132e38'
      for (let px2 = 0; px2 < 16; px2 += 2) {
        g.fillRect(X + px2 + (ty % 2), Y + 13, 1, 3)
        g.fillRect(X + px2 + ((ty + 1) % 2), Y + 15, 1, 1)
      }
    }
  }
}

// ---------- trees: painterly clustered canopies ----------
function paintTreeTile(g, X, Y, tx, ty, S, getCh) {
  const isTree = (dx, dy) => (getCh ? getCh(tx + dx, ty + dy) : '#') === '#'
  const edgeS = !isTree(0, 1)
  const edgeN = !isTree(0, -1)
  const edgeW = !isTree(-1, 0)
  const r = hash2(tx * 3 + 1, ty * 7 + 2)

  if (S.treeStyle === 'conifer') {
    // deep blue-green conifer mass, continuous across tiles
    const base = ['#182b21', '#15271d', '#1b2f24'][(r * 3) | 0]
    g.fillStyle = base
    g.fillRect(X, Y, 16, 16)
    // dense scalloped canopy: solid 3-tone cluster masses filling the tile
    for (let i = 0; i < 9; i++) {
      const rr = hash2(tx * 7 + i * 3, ty * 11 + i * 5)
      const cxp = X + ((rr * 15) | 0) - 3
      const cyp = Y + ((hash2(ty * 5 + i, tx * 3 + i) * 15) | 0) - 2
      const cw = 6 + ((rr * 6) | 0)
      // deep shadow under-scallop
      g.fillStyle = '#101d15'
      g.fillRect(cxp, cyp + 3, cw, 3)
      g.fillRect(cxp + 1, cyp + 6, cw - 2, 1)
      // solid cluster body
      g.fillStyle = rr > 0.55 ? '#26492f' : '#1e3a26'
      g.fillRect(cxp, cyp, cw, 4)
      g.fillRect(cxp + 1, cyp - 1, cw - 2, 1)
      // lit crown, upper-left biased
      if (rr > 0.4) {
        g.fillStyle = '#39603c'
        g.fillRect(cxp, cyp - 1, Math.max(3, (cw * 0.6) | 0), 2)
        if (rr > 0.72) {
          g.fillStyle = '#4f7a4e'
          g.fillRect(cxp + 1, cyp - 2, Math.max(2, cw >> 2), 1)
        }
      }
    }
    // moonlit rim + notched bites on the canopy top edge
    if (edgeN) {
      g.fillStyle = 'rgba(158,208,168,0.5)'
      g.fillRect(X + 1 + ((r * 4) | 0), Y, 10, 1)
      g.fillRect(X + ((r * 3) | 0), Y + 1, 5, 1)
      g.fillStyle = S.grass ? S.grass[0] : '#222c3a'
      g.fillRect(X + ((r * 11) | 0), Y, 3, 2)
    }
    if (edgeW) {
      g.fillStyle = 'rgba(126,178,138,0.3)'
      g.fillRect(X, Y + ((r * 8) | 0), 1, 7)
    }
    // trunk glimpse at south edge
    if (edgeS) {
      g.fillStyle = '#0d1410'
      g.fillRect(X, Y + 12, 16, 4)
      g.fillStyle = '#43301f'
      g.fillRect(X + 3 + ((r * 8) | 0), Y + 10, 3, 6)
      g.fillStyle = '#291d12'
      g.fillRect(X + 4 + ((r * 8) | 0), Y + 10, 1, 6)
      g.fillStyle = 'rgba(92,146,106,0.3)'
      g.fillRect(X, Y + 12, 16, 1)
    }
  } else {
    // broadleaf: three cluster styles so canopies don't read as one stamp
    const base = ['#22391f', '#1e331c', '#274023'][(r * 3) | 0]
    g.fillStyle = base
    g.fillRect(X, Y, 16, 16)
    const styleN = (hash2(tx * 5, ty * 9) * 3) | 0
    const blobN = styleN === 0 ? 5 : styleN === 1 ? 3 : 4
    for (let i = 0; i < blobN; i++) {
      const rr = hash2(tx * 13 + i * 7, ty * 19 + i * 11)
      const bx = X + ((rr * 13) | 0) - 1
      const by = Y + ((hash2(ty + i, tx * 2 + i) * 13) | 0) - 1
      const bw = (styleN === 1 ? 7 : 4) + ((rr * 4) | 0)
      // stepped rect blobs — shadow, body, lit crown
      g.fillStyle = 'rgba(8,16,7,0.45)'
      g.fillRect(bx, by + 2, bw, 3)
      g.fillStyle = i % 2 ? 'rgba(96,140,66,0.5)' : 'rgba(70,110,52,0.5)'
      g.fillRect(bx, by, bw, 3)
      g.fillRect(bx + 1, by - 1, bw - 2, 1)
      g.fillStyle = 'rgba(150,190,90,0.4)'
      g.fillRect(bx + 1, by - 1, Math.max(2, (bw / 2) | 0), 1)
    }
    // notched edges: bite the staircase corners so the mass reads organic
    if (edgeN) {
      g.fillStyle = 'rgba(170,210,110,0.35)'
      g.fillRect(X + 2 + ((r * 5) | 0), Y, 8, 1)
      const nb = getCh ? getCh(tx, ty - 1) : '.'
      if (nb !== '#') {
        g.fillStyle = S.grass ? S.grass[0] : '#243430'
        g.fillRect(X + ((r * 10) | 0), Y, 3, 2)
        g.fillRect(X + 12 - ((r * 8) | 0), Y, 2, 1)
      }
    }
    if (edgeW) {
      g.fillStyle = S.grass ? S.grass[0] : '#243430'
      g.fillRect(X, Y + 3 + ((r * 9) | 0), 2, 3)
    }
    if (edgeS) {
      g.fillStyle = 'rgba(8,14,7,0.55)'
      g.fillRect(X, Y + 13, 16, 3)
      g.fillStyle = '#3a2c20'
      g.fillRect(X + 4 + ((r * 7) | 0), Y + 11, 3, 5)
      g.fillStyle = S.grass ? S.grass[0] : '#243430'
      g.fillRect(X + 10 + ((r * 4) | 0), Y + 14, 3, 2)
    }
  }
}

// ---------- stone walls (tower/castle/beacon) ----------
function paintWallTile(g, X, Y, tx, ty, S, getCh, style) {
  const isWall = (dx, dy) => (getCh ? getCh(tx + dx, ty + dy) : '#') === '#'
  const edgeS = !isWall(0, 1)
  const edgeN = !isWall(0, -1)
  const r = hash2(tx * 3 + 1, ty * 7 + 2)
  const dark = style === 'castle'
  const face = dark ? '#4c4460' : '#565064'
  const top = dark ? '#6e625e' : '#7d7062'
  const topHi = dark ? '#8a7666' : '#95866f'
  const mortar = 'rgba(42,34,62,0.7)'

  if (edgeS) {
    // wall face with brick courses
    g.fillStyle = face
    g.fillRect(X, Y, 16, 16)
    g.fillStyle = mortar
    for (let by = 3; by < 16; by += 4) g.fillRect(X, Y + by, 16, 1)
    for (let by = 0; by < 4; by++) {
      const off = (by % 2) * 4 + ((r * 3) | 0)
      for (let bx = off % 8; bx < 16; bx += 8) g.fillRect(X + bx, Y + by * 4, 1, 3)
    }
    g.fillStyle = 'rgba(255,255,255,0.05)'
    g.fillRect(X + ((r * 8) | 0), Y + 1, 4, 1)
    g.fillRect(X + 10 - ((r * 6) | 0), Y + 9, 3, 1)
    // moss / weathering
    if (r > 0.7) {
      g.fillStyle = 'rgba(80,110,75,0.30)'
      g.fillRect(X + ((r * 10) | 0), Y + 12, 4, 3)
    }
    // top edge cap
    g.fillStyle = topHi
    g.fillRect(X, Y, 16, 2)
  } else {
    // top surface
    g.fillStyle = top
    g.fillRect(X, Y, 16, 16)
    g.fillStyle = 'rgba(0,0,0,0.22)'
    g.fillRect(X + ((r * 9) | 0), Y + ((r * 12) | 0), 3, 1)
    g.fillRect(X + 11 - ((r * 8) | 0), Y + 5 + ((r * 6) | 0), 2, 2)
    if (edgeN) {
      g.fillStyle = topHi
      g.fillRect(X, Y, 16, 1)
    }
    if (r > 0.7 && dark) {
      // occasional torn banner on castle walls
      g.fillStyle = '#6d2733'
      g.fillRect(X + 6, Y + 4, 4, 7)
      g.fillStyle = '#8a3341'
      g.fillRect(X + 6, Y + 4, 4, 2)
      g.fillStyle = '#43151f'
      g.fillRect(X + 6, Y + 9, 2, 2)
    }
  }
}

function paintRock(g, X, Y, r) {
  g.fillStyle = 'rgba(10,14,10,0.35)'
  g.beginPath()
  g.ellipse(X + 8, Y + 11, 7, 3, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#5c5c6a'
  g.fillRect(X + 3, Y + 5, 10, 6)
  g.fillRect(X + 5, Y + 3, 6, 3)
  g.fillStyle = '#7b7b8d'
  g.fillRect(X + 4, Y + 4, 5, 3)
  g.fillRect(X + 6, Y + 3, 3, 1)
  g.fillStyle = '#3a3a46'
  g.fillRect(X + 4, Y + 9, 9, 2)
  g.fillStyle = '#28282f'
  g.fillRect(X + 5, Y + 11, 7, 1)
  if (r > 0.5) {
    g.fillStyle = 'rgba(90,120,85,0.4)'
    g.fillRect(X + 3 + ((r * 6) | 0), Y + 8, 3, 2)
  }
}

// ---------- houses: red roofs, plaster walls, timber ----------
export function paintHouse(g, tx, ty, tw, th, seed) {
  const X = tx * 16
  const Y = ty * 16
  const W = tw * 16
  const H = th * 16
  const r = hash2(seed, seed * 7 + 3)
  const roofC = r > 0.6 ? '#8a3341' : r > 0.3 ? '#7a4a38' : '#4c4a66'
  const roofL = r > 0.6 ? '#a8485a' : r > 0.3 ? '#96604a' : '#5f5c80'
  const roofD = r > 0.6 ? '#5e222e' : r > 0.3 ? '#573327' : '#37354c'
  const wall = '#b3a184'
  const wallD = '#8f8069'
  const timber = '#4a3a28'

  // drop shadow
  g.fillStyle = 'rgba(6,8,6,0.4)'
  g.fillRect(X + 2, Y + H - 3, W - 2, 4)

  const roofH = Math.floor(H * 0.48)
  // roof with overhang + ridge
  g.fillStyle = roofD
  g.fillRect(X - 2, Y + roofH - 3, W + 4, 3)
  g.fillStyle = roofC
  g.fillRect(X - 1, Y, W + 2, roofH - 2)
  // shingle rows
  g.fillStyle = roofL
  for (let yy = 2; yy < roofH - 3; yy += 4) {
    for (let xx = (yy % 8 === 2 ? 0 : 3); xx < W; xx += 6) {
      g.fillRect(X + xx, Y + yy, 4, 1)
    }
  }
  g.fillStyle = roofD
  for (let yy = 4; yy < roofH - 2; yy += 4) g.fillRect(X - 1, Y + yy, W + 2, 1)
  // ridge highlight
  g.fillStyle = roofL
  g.fillRect(X - 1, Y, W + 2, 1)
  // chimney
  if (r > 0.4) {
    g.fillStyle = '#5c5c6a'
    g.fillRect(X + W - 8, Y - 4, 5, 7)
    g.fillStyle = '#7b7b8d'
    g.fillRect(X + W - 8, Y - 4, 5, 1)
    g.fillStyle = '#28282f'
    g.fillRect(X + W - 7, Y - 3, 3, 1)
  }

  // plaster wall
  g.fillStyle = wall
  g.fillRect(X + 1, Y + roofH, W - 2, H - roofH - 2)
  g.fillStyle = wallD
  g.fillRect(X + 1, Y + H - 4, W - 2, 2)
  g.fillRect(X + 1, Y + roofH, W - 2, 1)
  // timber frame
  g.fillStyle = timber
  g.fillRect(X + 1, Y + roofH, 1, H - roofH - 2)
  g.fillRect(X + W - 2, Y + roofH, 1, H - roofH - 2)
  g.fillRect(X + 1, Y + roofH + 1, W - 2, 1)

  // door with lintel + step
  const dx = X + ((W / 2) | 0) - 3
  g.fillStyle = timber
  g.fillRect(dx - 1, Y + H - 13, 9, 1)
  g.fillStyle = '#2a1c10'
  g.fillRect(dx, Y + H - 12, 7, 10)
  g.fillStyle = '#3d2a18'
  g.fillRect(dx + 1, Y + H - 12, 2, 10)
  g.fillStyle = '#d8a84f'
  g.fillRect(dx + 5, Y + H - 8, 1, 1)
  // warm window(s)
  const winY = Y + roofH + 4
  paintWindow(g, X + 4, winY)
  if (tw > 2) paintWindow(g, X + W - 10, winY)
}

function paintWindow(g, x, y) {
  g.fillStyle = '#4a3a28'
  g.fillRect(x - 1, y - 1, 7, 7)
  g.fillStyle = '#ffc45e'
  g.fillRect(x, y, 5, 5)
  g.fillStyle = '#ff9a3d'
  g.fillRect(x, y + 3, 5, 2)
  g.fillStyle = '#4a3a28'
  g.fillRect(x + 2, y, 1, 5)
  g.fillRect(x, y + 2, 5, 1)
}
