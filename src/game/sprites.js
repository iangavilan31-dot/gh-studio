// ============================================================
// EMBERVALE — procedural pixel sprites & tile painters
// All art is generated at runtime from pixel maps / painters.
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

// ---------- character palettes ----------
const P_KNIGHT = {
  s: '#aebccb', S: '#6f7d8f', h: '#d9a066', e: '#231a24',
  c: '#35415c', C: '#252e42', b: '#2a2331', t: '#6b4a2b',
  f: '#ff9a3d', F: '#ffd23d', g: '#e8a33d',
}
const P_PYRO = {
  s: '#8e2f3c', S: '#5e1f2a', h: '#c98f5e', e: '#231a24',
  c: '#8e2f3c', C: '#5e1f2a', b: '#2a2331', t: '#4a3222',
  f: '#ff9a3d', F: '#ffd23d', g: '#e8a33d', w: '#d8cbb8',
}

// 12x15, facing right
const KNIGHT_IDLE = [
  '....ssss....',
  '...sSssss...',
  '...shhhhs...',
  '...shheh....',
  '....hhhh....',
  '...gcccc....',
  '..sccccccs..',
  '..s.cccc.s..',
  '..s.CccC.s..',
  '....cccc....',
  '....CCCC....',
  '....C..C....',
  '....b..b....',
  '...bb..bb...',
]
const KNIGHT_WALK = [
  '....ssss....',
  '...sSssss...',
  '...shhhhs...',
  '...shheh....',
  '....hhhh....',
  '...gcccc....',
  '..sccccccs..',
  '..s.cccc.s..',
  '..s.CccC.s..',
  '....cccc....',
  '....CCCC....',
  '...C....C...',
  '...b....b...',
  '..bb....bb..',
]
const KNIGHT_DOWN = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '.....sss....',
  '..ssSsssss..',
  '.sshhhsccs..',
  '.scccccccss.',
  '..CCccccCC..',
  '...bb..bb...',
  '............',
]

const PYRO_IDLE = [
  '....SSSS....',
  '...Ssssss...',
  '...Shhhh....',
  '...Shheh....',
  '....hhhh....',
  '...wcccc....',
  '..sccccccs..',
  '..s.cccc.s..',
  '..s.CccC.s..',
  '....cccc....',
  '....cccc....',
  '....CCCC....',
  '....CCCC....',
  '...CCCCCC...',
]
const PYRO_WALK = [
  '....SSSS....',
  '...Ssssss...',
  '...Shhhh....',
  '...Shheh....',
  '....hhhh....',
  '...wcccc....',
  '..sccccccs..',
  '..s.cccc.s..',
  '..s.CccC.s..',
  '....cccc....',
  '...ccCCcc...',
  '...CC..CC...',
  '...C....C...',
  '..CC....CC..',
]
const PYRO_DOWN = [
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '.....SSS....',
  '..sSssssss..',
  '.sshhhsccs..',
  '.scccccccss.',
  '..CCccccCC..',
  '...CC..CC...',
  '............',
]

// ---------- enemies ----------
const P_HUSK = { k: '#7a8a6e', K: '#55614c', e: '#a8e0a0', r: '#4a4136', b: '#2a2822' }
const HUSK_A = [
  '...kkkk...',
  '..kKkkkk..',
  '..ke.ek...',
  '..kkkkk...',
  '...rrr....',
  '..rrrrr...',
  '.r.rrr.r..',
  '...rrr....',
  '...r.r....',
  '..bb.bb...',
]
const HUSK_B = [
  '...kkkk...',
  '..kKkkkk..',
  '..ke.ek...',
  '..kkkkk...',
  '...rrr....',
  '..rrrrr...',
  '..r.rrr.r.',
  '...rrr....',
  '..r...r...',
  '.bb...bb..',
]

const P_HOUND = { k: '#2a2634', K: '#1a1722', e: '#c94f4f', t: '#3a3548' }
const HOUND_A = [
  '..........kk..',
  '.kk......kkkk.',
  '.kkkkkkkkkKek.',
  '..kkkkkkkkkk..',
  '..kKkkkkkKk...',
  '..k..kk..k....',
  '..t...t..t....',
]
const HOUND_B = [
  '..........kk..',
  '.kk......kkkk.',
  '.kkkkkkkkkKek.',
  '..kkkkkkkkkk..',
  '..kKkkkkkKk...',
  '...kk..kk.....',
  '...t....t.....',
]

const P_CULT = { r: '#4a3b5e', R: '#332946', m: '#cfd4c4', e: '#1a1420', g: '#7fd6ff' }
const CULT_A = [
  '...RRRR...',
  '..RrrrrR..',
  '..Rmmmm...',
  '..Rmeem...',
  '...mmmm...',
  '...rrrr...',
  '..rrrrrr..',
  '..r.rr.rg.',
  '...rrrr.g.',
  '...rrrr...',
  '..RRRRRR..',
]

const P_BRUTE = { s: '#5e6470', S: '#434855', m: '#4a5a4a', e: '#ffd23d', d: '#31353f' }
const BRUTE_A = [
  '....ssssss....',
  '...sSssssss...',
  '...se.ss.es...',
  '...ssssssss...',
  '..ssmSSSSss...',
  '.sssSssssSss..',
  '.ss.Ssssss.ss.',
  '.sd.SssssS.ds.',
  '.dd.SmsssS.dd.',
  '....ssssss....',
  '....SS..SS....',
  '...dSS..SSd...',
  '...ddd..ddd...',
]

const P_KING = {
  w: '#d8dce6', W: '#9aa2b8', c: '#b8a44f', e: '#7fd6ff',
  k: '#3a3550', K: '#262238', d: '#1a1726', f: '#8ff0ff',
}
const KING_A = [
  '....c.c.c.c.....',
  '....ccccccc.....',
  '....wwwwwww.....',
  '....wWwwwWw.....',
  '....we...ew.....',
  '....www.www.....',
  '.....wwwww......',
  '...kkkwwwkkk....',
  '..kkkkkkkkkkk...',
  '.kk.kkkkkkk.kk..',
  '.kf.kkkkkkk.wk..',
  '.kf.kKkkkKk.wk..',
  '.kf.kkkkkkk.w...',
  '..f.kkkkkkk.w...',
  '..f.kKkkkKk.w...',
  '....kkkkkkk.....',
  '....KkkkkkK.....',
  '....KkkkkkK.....',
  '....Kkkkkkk.....',
  '...KKkkkkkKK....',
  '...ddKKKKKdd....',
  '..dddddddddd....',
]

// ---------- npcs ----------
const P_VILL = { h: '#d9a066', e: '#231a24', c: '#5e6b4a', C: '#434f36', b: '#2a2331', g: '#b8b0a0' }
const VILL_A = [
  '...gggg...',
  '..ghhhhg..',
  '..ghe.eh..',
  '...hhhh...',
  '...cccc...',
  '..cccccc..',
  '..c.cc.c..',
  '...cccc...',
  '...CCCC...',
  '...C..C...',
  '..bb..bb..',
]
const P_ELDER = { h: '#c9b18f', e: '#231a24', c: '#6a5a7a', C: '#4a3f58', b: '#2a2331', g: '#d8d4cc', t: '#8a7a5a' }
const ELDER_A = [
  '...gggg...',
  '..ghhhhg..',
  '..ghe.eh..',
  '...hhhh...',
  '..t.cccc..',
  '..tcccccc.',
  '..t.cc.c..',
  '..t.cccc..',
  '..t.CCCC..',
  '..t.CCCC..',
  '....CCCC..',
]
const P_SMITH = { h: '#b97f56', e: '#231a24', c: '#4a4a52', C: '#33333a', b: '#2a2331', a: '#6b4a2b', s: '#8f9aa8' }
const SMITH_A = [
  '...aaaa...',
  '..ahhhha..',
  '..ahe.eh..',
  '...hhhh...',
  '..scccc...',
  '.sscccccc.',
  '.s..cc.c..',
  '....cccc..',
  '...aaaaaa.',
  '...C..C...',
  '..bb..bb..',
]
const P_CHILD = { h: '#d9a066', e: '#231a24', c: '#8a4a3c', C: '#63352b', b: '#2a2331' }
const CHILD_A = [
  '...hhhh...',
  '...he.eh..',
  '...hhhh...',
  '...cccc...',
  '..cccccc..',
  '...cccc...',
  '...C..C...',
  '..bb..bb..',
]

// ---------- props ----------
const P_PROP = {
  w: '#6b4a2b', W: '#4a3220', s: '#5e6470', S: '#434855',
  f: '#ff9a3d', F: '#ffd23d', g: '#e8a33d', d: '#2a2331',
  m: '#4a5a4a', c: '#b8a44f', i: '#8f9aa8', e: '#7fd6ff',
}
const TORCHPOST = [
  '...ff...',
  '..fFFf..',
  '..fFFf..',
  '...ww...',
  '...ww...',
  '...ww...',
  '...ww...',
  '...ww...',
  '..WwwW..',
]
const BRAZIER_OFF = [
  '..ssss..',
  '.sSSSSs.',
  '.sSddSs.',
  '..ssss..',
  '...ss...',
  '..ssss..',
  '.sS..Ss.',
]
const BRAZIER_ON = [
  '...FF...',
  '..fFFf..',
  '.fFFFFf.',
  '.sffffs.',
  '.sSffSs.',
  '..ssss..',
  '...ss...',
  '..ssss..',
  '.sS..Ss.',
]
const BONFIRE = [
  '...F....',
  '..FFf...',
  '..fFFF..',
  '.ffFFff.',
  '.wffffw.',
  '.WwwwwW.',
  'wW.ww.Ww',
]
const CHEST_CLOSED = [
  '.wwwwwww.',
  'wWWWWWWWw',
  'wwwcwwwww',
  'wWWWcWWWw',
  'wwwwwwwww',
]
const CHEST_OPEN = [
  '.ddddddd.',
  'wFFFFFFFw',
  'wwwcwwwww',
  'wWWWcWWWw',
  'wwwwwwwww',
]
const GRAVE = [
  '..sss..',
  '.sSsSs.',
  '.sSsSs.',
  '.sssss.',
  '.mSsSm.',
]
const KEYSPR = [
  '..ccc..',
  '..c.c..',
  '..ccc..',
  '...c...',
  '..cc...',
  '...c...',
  '..cc...',
]
const SIGIL = [
  '..eee..',
  '.e.i.e.',
  'ee.i.ee',
  '.e.i.e.',
  '..eee..',
]
const EMBER = [
  '.F.',
  'FgF',
  '.g.',
]
const HEARTPICK = [
  '.f.f.',
  'fFfFf',
  'fffff',
  '.fff.',
  '..f..',
]

export const SPR = {}
export function initSprites() {
  SPR.knight = { idle: px(KNIGHT_IDLE, P_KNIGHT), walk: px(KNIGHT_WALK, P_KNIGHT), down: px(KNIGHT_DOWN, P_KNIGHT) }
  SPR.pyro = { idle: px(PYRO_IDLE, P_PYRO), walk: px(PYRO_WALK, P_PYRO), down: px(PYRO_DOWN, P_PYRO) }
  SPR.husk = [px(HUSK_A, P_HUSK), px(HUSK_B, P_HUSK)]
  SPR.hound = [px(HOUND_A, P_HOUND), px(HOUND_B, P_HOUND)]
  SPR.alpha = [px(HOUND_A, { ...P_HOUND, k: '#3d2a3a', K: '#241722', e: '#ffd23d' }), px(HOUND_B, { ...P_HOUND, k: '#3d2a3a', K: '#241722', e: '#ffd23d' })]
  SPR.cultist = [px(CULT_A, P_CULT)]
  SPR.brute = [px(BRUTE_A, P_BRUTE)]
  SPR.sentinel = [px(BRUTE_A, { ...P_BRUTE, s: '#4a4258', S: '#312b3d', m: '#5e2f3c', e: '#7fd6ff' })]
  SPR.wisp = [makeWisp()]
  SPR.paleking = [px(KING_A, P_KING)]
  SPR.villager = px(VILL_A, P_VILL)
  SPR.elder = px(ELDER_A, P_ELDER)
  SPR.smith = px(SMITH_A, P_SMITH)
  SPR.child = px(CHILD_A, P_CHILD)
  SPR.torchpost = px(TORCHPOST, P_PROP)
  SPR.brazierOff = px(BRAZIER_OFF, P_PROP)
  SPR.brazierOn = px(BRAZIER_ON, P_PROP)
  SPR.bonfire = px(BONFIRE, P_PROP)
  SPR.chest = px(CHEST_CLOSED, P_PROP)
  SPR.chestOpen = px(CHEST_OPEN, P_PROP)
  SPR.grave = px(GRAVE, P_PROP)
  SPR.key = px(KEYSPR, P_PROP)
  SPR.sigil = px(SIGIL, P_PROP)
  SPR.ember = px(EMBER, P_PROP)
  SPR.heart = px(HEARTPICK, { f: '#c94f4f', F: '#e88a8a' })
}

function makeWisp() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(4, 4, 0.5, 4, 4, 4)
  grad.addColorStop(0, '#d8ffe8')
  grad.addColorStop(0.4, '#7de0a0')
  grad.addColorStop(1, 'rgba(60,120,90,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 8, 8)
  return c
}

// ============================================================
// Tile painters — deterministic per-tile variation via hash
// ============================================================
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (h >>> 0) / 4294967295
}

const STYLES = {
  village: {
    ground: ['#2e3d2a', '#2a3826', '#334230'],
    deco: '#243321',
    path: ['#6e6252', '#645a4b', '#78684f'],
    wallKind: 'tree',
  },
  forest: {
    ground: ['#232e24', '#1f2a20', '#273229'],
    deco: '#1a241c',
    path: ['#57503f', '#4e4839', '#5e5644'],
    wallKind: 'tree',
  },
  tower: {
    ground: ['#3a3a44', '#35353e', '#40404b'],
    deco: '#2e2e38',
    path: ['#4e4e5c', '#464653', '#565664'],
    wallKind: 'stone',
  },
  castle: {
    ground: ['#33303e', '#2e2b38', '#383445'],
    deco: '#282533',
    path: ['#484455', '#413d4d', '#4f4a5e'],
    wallKind: 'stone',
  },
  beacon: {
    ground: ['#3d3a4e', '#383548', '#434055'],
    deco: '#322f42',
    path: ['#565064', '#4e485b', '#5e586e'],
    wallKind: 'rock',
  },
}

export function paintTile(g, ch, tx, ty, style) {
  const S = STYLES[style] || STYLES.forest
  const X = tx * 16
  const Y = ty * 16
  const r = hash2(tx, ty)
  switch (ch) {
    case '.':
    case 'P':
    case '*':
    case '1':
    case '2':
    case '3':
    case '4':
    case 'E':
    case 'W':
    case 'U':
    case 'M':
    case 's':
    case 'A':
    case 'S':
    case 'K':
    case 'N':
    case 'B':
    case 'Z':
    case 'C':
    case 'T':
    case 'O':
      paintGround(g, X, Y, S, r)
      break
    case ',':
      paintGround(g, X, Y, S, r)
      g.fillStyle = S.deco
      g.fillRect(X + 3 + ((r * 7) | 0), Y + 4 + ((r * 5) | 0), 2, 1)
      g.fillRect(X + 9 - ((r * 4) | 0), Y + 10, 1, 2)
      break
    case '+':
      paintGround(g, X, Y, S, r)
      g.fillStyle = r > 0.5 ? '#c94f4f' : '#d8d4cc'
      g.fillRect(X + 4, Y + 5, 2, 2)
      g.fillStyle = r > 0.3 ? '#d8b44f' : '#c94f8f'
      g.fillRect(X + 10, Y + 9, 2, 2)
      break
    case '=':
      paintPath(g, X, Y, S, r)
      break
    case '~':
      paintWater(g, X, Y, r)
      break
    case 'R':
      paintGround(g, X, Y, S, r)
      paintRock(g, X, Y, r)
      break
    case 'G':
      paintGround(g, X, Y, S, r)
      break
    case '#':
      if (S.wallKind === 'tree') paintTree(g, X, Y, tx, ty, S)
      else if (S.wallKind === 'rock') paintCliff(g, X, Y, r)
      else paintStoneWall(g, X, Y, r)
      break
    default:
      paintGround(g, X, Y, S, r)
  }
}

function paintGround(g, X, Y, S, r) {
  g.fillStyle = S.ground[(r * 3) | 0]
  g.fillRect(X, Y, 16, 16)
  // subtle texture
  g.fillStyle = 'rgba(0,0,0,0.10)'
  if (r > 0.6) g.fillRect(X + ((r * 11) | 0), Y + ((r * 13) | 0), 2, 1)
  if (r > 0.3) g.fillRect(X + 12 - ((r * 9) | 0), Y + 3 + ((r * 7) | 0), 1, 2)
}

function paintPath(g, X, Y, S, r) {
  g.fillStyle = S.path[(r * 3) | 0]
  g.fillRect(X, Y, 16, 16)
  g.fillStyle = 'rgba(0,0,0,0.18)'
  g.fillRect(X + 1 + ((r * 6) | 0), Y + 2 + ((r * 8) | 0), 3, 2)
  g.fillRect(X + 9, Y + 10 - ((r * 6) | 0), 3, 2)
  g.fillStyle = 'rgba(255,255,255,0.05)'
  g.fillRect(X + 5, Y + 6 + ((r * 4) | 0), 2, 1)
}

function paintWater(g, X, Y, r) {
  g.fillStyle = r > 0.5 ? '#1d2b46' : '#1a2740'
  g.fillRect(X, Y, 16, 16)
  g.fillStyle = 'rgba(130,170,220,0.12)'
  g.fillRect(X + ((r * 10) | 0), Y + 3 + ((r * 8) | 0), 4, 1)
  g.fillRect(X + 8 - ((r * 6) | 0), Y + 12, 3, 1)
}

function paintTree(g, X, Y, tx, ty, S) {
  const r = hash2(tx * 3 + 1, ty * 7 + 2)
  // dark canopy mass
  const base = ['#16241a', '#14211a', '#182619'][(r * 3) | 0]
  g.fillStyle = base
  g.fillRect(X, Y, 16, 16)
  // canopy highlights facing "up-left" light
  g.fillStyle = 'rgba(70,110,70,0.22)'
  g.fillRect(X + 1 + ((r * 5) | 0), Y + 1 + ((r * 4) | 0), 5, 3)
  g.fillRect(X + 8, Y + 6 + ((r * 5) | 0), 4, 2)
  g.fillStyle = 'rgba(0,0,0,0.28)'
  g.fillRect(X + 4, Y + 11, 7, 4)
  if (r > 0.8) {
    g.fillStyle = 'rgba(120,160,110,0.18)'
    g.fillRect(X + 3, Y + 3, 2, 2)
  }
}

function paintStoneWall(g, X, Y, r) {
  g.fillStyle = '#2b2a36'
  g.fillRect(X, Y, 16, 16)
  g.fillStyle = '#38364a'
  g.fillRect(X, Y, 16, 6)
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.fillRect(X, Y + 6, 16, 1)
  g.fillRect(X + ((r * 8) | 0), Y + 9, 1, 5)
  g.fillRect(X + 12 - ((r * 8) | 0), Y + 1, 1, 4)
  g.fillStyle = 'rgba(255,255,255,0.05)'
  g.fillRect(X + 2 + ((r * 6) | 0), Y + 1, 3, 1)
  if (r > 0.75) {
    g.fillStyle = 'rgba(74,90,74,0.4)'
    g.fillRect(X + ((r * 10) | 0), Y + 12, 3, 2)
  }
}

function paintCliff(g, X, Y, r) {
  g.fillStyle = '#2e2b3d'
  g.fillRect(X, Y, 16, 16)
  g.fillStyle = 'rgba(255,255,255,0.06)'
  g.fillRect(X, Y, 16, 3)
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.fillRect(X + ((r * 9) | 0), Y + 5, 2, 8)
}

function paintRock(g, X, Y, r) {
  g.fillStyle = '#565664'
  g.fillRect(X + 3, Y + 6, 10, 7)
  g.fillRect(X + 5, Y + 4, 6, 2)
  g.fillStyle = '#6e6e7d'
  g.fillRect(X + 4, Y + 5, 5, 3)
  g.fillStyle = '#3a3a47'
  g.fillRect(X + 4, Y + 11, 9, 2)
}

// house painter: paints a w×h tile house at tile (tx,ty) top-left
export function paintHouse(g, tx, ty, tw, th, seed) {
  const X = tx * 16
  const Y = ty * 16
  const W = tw * 16
  const H = th * 16
  const r = hash2(seed, seed * 7 + 3)
  const wall = r > 0.5 ? '#4a3d33' : '#443a40'
  const roof = r > 0.5 ? '#5e2f2a' : '#3d3d55'
  const roofL = r > 0.5 ? '#7a3f36' : '#4d4d6b'
  // roof (upper 40%)
  const roofH = Math.floor(H * 0.45)
  g.fillStyle = roof
  g.fillRect(X, Y, W, roofH)
  g.fillStyle = roofL
  for (let i = 0; i < W; i += 4) g.fillRect(X + i, Y + (i % 8 === 0 ? 1 : 3), 3, 2)
  // wall
  g.fillStyle = wall
  g.fillRect(X + 1, Y + roofH, W - 2, H - roofH - 2)
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(X + 1, Y + roofH, W - 2, 2)
  // door
  g.fillStyle = '#241c14'
  g.fillRect(X + W / 2 - 3, Y + H - 12, 7, 10)
  // lit window
  g.fillStyle = '#ffb84d'
  g.fillRect(X + 4, Y + roofH + 4, 4, 4)
  if (tw > 2) g.fillRect(X + W - 9, Y + roofH + 4, 4, 4)
  g.fillStyle = 'rgba(255,184,77,0.25)'
  g.fillRect(X + 3, Y + roofH + 3, 6, 6)
}
