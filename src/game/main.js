// ============================================================
// EMBERVALE — main: boot, loop, input, modes, net orchestration
// ============================================================
import { VIEW_W, VIEW_H, ZONES, DIALOGUE, BOSS_LINES, STORY, TIPS, TILE } from './data.js'
import { initSprites } from './sprites.js'
import { Game, defaultSave } from './game.js'
import { World } from './world.js'
import { Renderer } from './render.js'
import { AudioSys } from './audio.js'
import { UI } from './ui.js'
import { Net } from './net.js'

const SAVE_KEY = 'embervale_save_v1'

// ---------- canvas ----------
const root = document.getElementById('game-root')
const canvas = document.createElement('canvas')
canvas.width = VIEW_W
canvas.height = VIEW_H
root.appendChild(canvas)
function fit() {
  const s = Math.max(1, Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H))
  const scale = s >= 2 ? Math.floor(s * 2) / 2 : s // half-integer steps keep pixels near-square
  canvas.style.width = VIEW_W * scale + 'px'
  canvas.style.height = VIEW_H * scale + 'px'
}
window.addEventListener('resize', fit)
fit()

initSprites()
const renderer = new Renderer(canvas)
const ui = new UI()
const audio = new AudioSys()

// ---------- app state ----------
const app = {
  state: 'title', // title | play | victory
  mode: null, // solo | local | host | guest
  game: null,
  net: null,
  paused: false,
  wipeTip: '',
  guest: null, // guest-side view state
  hostEvts: [],
  snapT: 0,
  guestInT: 0,
  bossActive: false,
  playT: 0,
  kills: 0,
  deaths: 0,
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s && s.flags) return { ...defaultSave(), ...s }
    }
  } catch {}
  return null
}
function persistSave() {
  if (app.game && (app.mode !== 'guest')) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(app.game.save)) } catch {}
  }
}

// ---------- input ----------
const keys = {}
const P1MAP = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', atk: 'KeyJ', spc: 'KeyK', dodge: 'KeyL', dodge2: 'Space', inter: 'KeyE' }
const P2MAP = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', atk: 'Comma', spc: 'Period', dodge: 'Slash', dodge2: 'ShiftRight', inter: 'Enter' }
const pressed = [{}, {}] // edge-triggered accumulators per local pad

window.addEventListener('keydown', (e) => {
  if (e.repeat) return
  keys[e.code] = true
  audio.ensure()
  for (let i = 0; i < 2; i++) {
    const m = i === 0 ? P1MAP : P2MAP
    if (e.code === m.spc) pressed[i].spc = true
    if (e.code === m.dodge || e.code === m.dodge2) pressed[i].dodge = true
    if (e.code === m.inter) pressed[i].interPressed = true
    if (e.code === m.atk) pressed[i].atk = true
  }
  if ((e.code === 'KeyE' || e.code === 'Enter') && ui.inDialogue) {
    ui.advanceDialogue()
    audio.onEvent({ t: 'ui' })
    // the press that advances/closes dialogue must not also interact
    pressed[0].interPressed = false
    pressed[1].interPressed = false
  }
  if (e.code === 'Escape' && app.state === 'play') togglePause()
  if (e.code === 'KeyM') {
    audio.setMuted(!audio.muted)
    ui.toast(audio.muted ? 'Sound off.' : 'Sound on.')
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
})
window.addEventListener('keyup', (e) => (keys[e.code] = false))

function padFromKeys(map, acc) {
  let mx = 0
  let my = 0
  if (keys[map.left]) mx -= 1
  if (keys[map.right]) mx += 1
  if (keys[map.up]) my -= 1
  if (keys[map.down]) my += 1
  return {
    mx, my,
    atk: !!keys[map.atk] || !!acc.atk,
    spc: !!acc.spc,
    dodge: !!acc.dodge,
    inter: !!keys[map.inter],
    interPressed: !!acc.interPressed,
  }
}

function readGamepad(idx) {
  const gps = navigator.getGamepads ? navigator.getGamepads() : []
  const gp = gps[idx]
  if (!gp) return null
  let mx = Math.abs(gp.axes[0]) > 0.25 ? gp.axes[0] : 0
  let my = Math.abs(gp.axes[1]) > 0.25 ? gp.axes[1] : 0
  if (gp.buttons[14]?.pressed) mx = -1
  if (gp.buttons[15]?.pressed) mx = 1
  if (gp.buttons[12]?.pressed) my = -1
  if (gp.buttons[13]?.pressed) my = 1
  return {
    mx, my,
    atk: gp.buttons[2]?.pressed || false, // X / Square
    spc: gp.buttons[1]?.pressed || false, // B / Circle
    dodge: gp.buttons[0]?.pressed || false, // A / Cross
    inter: gp.buttons[3]?.pressed || false, // Y / Triangle
    interPressed: gp.buttons[3]?.pressed || false,
  }
}

function mergePads(a, b) {
  if (!b) return a
  return {
    mx: a.mx || b.mx,
    my: a.my || b.my,
    atk: a.atk || b.atk,
    spc: a.spc || b.spc,
    dodge: a.dodge || b.dodge,
    inter: a.inter || b.inter,
    interPressed: a.interPressed || b.interPressed,
  }
}

// ---------- title / menu flow ----------
function showTitle() {
  app.state = 'title'
  app.mode = null
  app.game = null
  app.bossActive = false
  if (app.net) {
    app.net.destroy()
    app.net = null
  }
  ui.endDialogue()
  ui.showTitle(!!loadSave())
}

ui.on('title', (action) => {
  audio.ensure()
  audio.onEvent({ t: 'ui' })
  switch (action) {
    case '__back':
      showTitle()
      break
    case 'continue': {
      const save = loadSave()
      startLocalish('solo-continue', save, save.classes.slice(0, 1))
      break
    }
    case 'solo':
      ui.showClassSelect('solo', (classes) => startWithStory('solo', classes))
      break
    case 'local':
      ui.showClassSelect('local', (classes) => startWithStory('local', classes))
      break
    case 'host':
      ui.showClassSelect('solo', (classes) => startHost(classes))
      break
    case 'join':
      ui.showJoin()
      break
    case 'wipe':
      localStorage.removeItem(SAVE_KEY)
      ui.toast('The valley forgets.')
      showTitle()
      break
  }
})

ui.on('join', (code) => joinRoom(code))
ui.on('resume', () => togglePause(false))
ui.on('mute', () => audio.setMuted(!audio.muted))
ui.on('quit', () => {
  persistSave()
  showTitle()
})

function startWithStory(mode, classes) {
  const save = loadSave()
  if (save && save.flags.restedOnce) {
    startLocalish(mode, save, classes)
  } else {
    ui.showStory(STORY.intro, () => startLocalish(mode, save, classes))
  }
}

function startLocalish(mode, save, classes) {
  app.mode = mode === 'solo-continue' ? (save.classes[1] && save.lastLocal ? 'local' : 'solo') : mode
  if (mode === 'solo-continue') {
    // continue restores last party setup
    classes = save.lastLocal ? save.classes : save.classes.slice(0, 1)
    app.mode = save.lastLocal ? 'local' : 'solo'
  }
  const g = new Game(save || defaultSave())
  g.save.classes = classes.concat(g.save.classes.slice(classes.length))
  g.save.lastLocal = app.mode === 'local'
  app.game = g
  g.addPlayer(0, classes[0])
  if (app.mode === 'local' && classes[1]) g.addPlayer(1, classes[1])
  const zone = g.save.checkpoint?.zone || 'village'
  enterZone(zone, '__bonfire', true)
  app.state = 'play'
  app.playT = 0
  app.kills = 0
  app.deaths = 0
  ui.clear()
}

// ---------- online: host ----------
async function startHost(classes) {
  ui.showConnecting('KINDLING THE ROOM...')
  app.net = new Net()
  try {
    const code = await app.net.host()
    ui.showHostLobby(code)
    app.net.onPeerJoin = () => ui.setHostStatus('A torch approaches...')
    app.net.onPeerLeave = () => {
      if (app.state === 'play') {
        ui.showDisconnected()
        app.state = 'title-wait'
      } else ui.setHostStatus('The torch went out. Waiting again...')
    }
    app.net.onData = (d) => hostRecv(d, classes)
  } catch (err) {
    ui.showJoin('Could not reach the signaling fire: ' + (err.message || err.type || err))
  }
}

function hostRecv(d, hostClasses) {
  const g = app.game
  switch (d.t) {
    case 'hello': {
      // guest arrived with a class choice — start the campaign
      const save = loadSave()
      const classes = [hostClasses[0], d.cls || 'pyro']
      app.mode = 'host'
      const game = new Game(save || defaultSave())
      game.save.classes = classes
      app.game = game
      game.addPlayer(0, classes[0])
      game.addPlayer(1, classes[1])
      const zone = game.save.checkpoint?.zone || 'village'
      app.state = 'play'
      app.playT = 0
      ui.clear()
      enterZone(zone, '__bonfire', true)
      app.net.send({ t: 'start', classes, zone })
      break
    }
    case 'in':
      app.guestInput = { ...d.i, interPressed: app.guestInput?.interPressed || d.i.interPressed, spc: app.guestInput?.spc || d.i.spc, dodge: app.guestInput?.dodge || d.i.dodge }
      break
    case 'buy':
      if (g) {
        g.buyUpgrade(1, d.upId)
        persistSave()
      }
      break
    case 'dlgdone':
      onDialogueDoneHost()
      break
  }
}

// ---------- online: guest ----------
async function joinRoom(code) {
  ui.showConnecting()
  app.net = new Net()
  try {
    await app.net.join(code)
    ui.showClassSelect('solo', (classes) => {
      app.net.send({ t: 'hello', cls: classes[0] })
      ui.showConnecting('THE HOST STIRS THE COALS...')
    })
    app.net.onPeerLeave = () => {
      ui.showDisconnected('THE HOST’S FIRE WENT OUT')
      app.state = 'title-wait'
    }
    app.net.onData = (d) => guestRecv(d)
  } catch (err) {
    app.net?.destroy()
    app.net = null
    ui.showJoin(err.message || 'Could not join.')
  }
}

function guestRecv(d) {
  switch (d.t) {
    case 'start': {
      app.mode = 'guest'
      app.state = 'play'
      app.guest = {
        world: new World(d.zone),
        zone: d.zone,
        prev: null,
        curr: null,
        recvAt: 0,
        interval: 0.09,
        px: 0,
        py: 0,
        inited: false,
        save: { embers: 0, upgrades: [{}, {}], classes: d.classes },
        swing: 0,
        swingDir: 0,
      }
      renderer.setZone(app.guest.world)
      const z = ZONES[d.zone]
      audio.setZone(z.music)
      ui.clear()
      ui.showZoneCard(z.name, z.subtitle)
      break
    }
    case 'state': {
      const gs = app.guest
      if (!gs) return
      if (gs.zone !== d.zone) {
        gs.zone = d.zone
        gs.world = new World(d.zone)
        renderer.setZone(gs.world)
        const z = ZONES[d.zone]
        audio.setZone(z.music)
        ui.showZoneCard(z.name, z.subtitle)
        gs.prev = null
        gs.curr = null
        gs.inited = false
      }
      const now = performance.now() / 1000
      if (gs.curr) gs.interval = Math.min(0.25, Math.max(0.05, now - gs.recvAt))
      gs.prev = gs.curr
      gs.curr = d
      gs.recvAt = now
      gs.save.embers = d.embers
      gs.save.upgrades = d.ups || gs.save.upgrades
      gs.save.classes = d.classes || gs.save.classes
      const me = d.players[1]
      if (me && !gs.inited) {
        gs.px = me.x
        gs.py = me.y
        gs.inited = true
      }
      for (const ev of d.evts || []) handleEventGuest(ev)
      if (ui._screen === 'shop' && ui.renderShop) ui.renderShop()
      break
    }
    case 'full':
      ui.showJoin('That room already has two torches.')
      app.net?.destroy()
      break
  }
}

// ---------- zone entry ----------
function enterZone(zoneId, entry, snap = false) {
  const g = app.game
  g.loadZone(zoneId, entry)
  renderer.setZone(g.world)
  const z = ZONES[zoneId]
  audio.setZone(z.music)
  ui.showZoneCard(z.name, z.subtitle)
  app.bossActive = false
  const focus = g.activePlayers()
  renderer.updateCamera(focus, 0.016, true)
  persistSave()
}

// ---------- pause ----------
function togglePause(force) {
  const to = force != null ? force : !app.paused
  app.paused = to
  if (app.paused) ui.showPause()
  else ui.clear()
}

// ---------- dialogue / events ----------
let pendingBossFight = false

function handleEventLocal(ev) {
  renderer.handleEvent(ev)
  audio.onEvent(ev)
  const g = app.game
  switch (ev.t) {
    case 'talk': {
      const npc = ev.npc
      let key = npc.dlg
      if (key === 'elder') {
        if (g.save.completed) key = 'victory_elder'
        else if (g.flag('elderTalked')) key = 'elder2'
        else g.setFlag('elderTalked')
      }
      const lines = DIALOGUE[key] || []
      ui.startDialogue(lines, () => {
        if (npc.shop) openShop(0)
      })
      break
    }
    case 'shop':
      openShop(ev.slot ?? 0)
      break
    case 'text':
      ui.toast(ev.msg)
      break
    case 'transition':
      // defer to next frame (host applies + guest follows via snapshot)
      break
    case 'die':
      app.kills++
      break
    case 'pdown':
      app.deaths++
      app.wipeTip = TIPS[(Math.random() * TIPS.length) | 0]
      break
    case 'bossintro':
      app.bossActive = true
      ui.startDialogue(BOSS_LINES.intro, () => {
        if (app.game?.bossState) app.game.bossState.phase = 'fight'
        if (app.net?.connected) app.net.send({ t: 'noop' })
      })
      break
    case 'bossphase':
      ui.startDialogue(ev.phase === 2 ? BOSS_LINES.phase2 : BOSS_LINES.phase3, () => {})
      break
    case 'bossdead':
      app.bossActive = false
      break
    case 'bossoutro':
      ui.startDialogue(BOSS_LINES.death, () => {
        enterZone('beacon', '1')
      })
      break
    case 'victory':
      onVictory()
      break
    case 'respawn':
      ui.toast('The bonfire pulls you back from the dark.')
      break
  }
}

function onDialogueDoneHost() {
  if (app.game?.bossState && app.game.bossState.phase === 'intro') app.game.bossState.phase = 'fight'
}

function handleEventGuest(ev) {
  renderer.handleEvent(ev)
  audio.onEvent(ev)
  switch (ev.t) {
    case 'talk': {
      const lines = DIALOGUE[ev.npc?.dlg] || []
      ui.startDialogue(lines, () => app.net?.send({ t: 'dlgdone' }))
      break
    }
    case 'shop':
      if (ev.slot === 1) openShop(1)
      break
    case 'text':
      ui.toast(ev.msg)
      break
    case 'bossintro':
      app.bossActive = true
      ui.startDialogue(BOSS_LINES.intro, () => app.net?.send({ t: 'dlgdone' }))
      break
    case 'bossphase':
      ui.startDialogue(ev.phase === 2 ? BOSS_LINES.phase2 : BOSS_LINES.phase3, () => {})
      break
    case 'bossdead':
      app.bossActive = false
      break
    case 'bossoutro':
      ui.startDialogue(BOSS_LINES.death, () => {})
      break
    case 'victory':
      onVictory()
      break
  }
}

function openShop(slot) {
  const save = app.mode === 'guest' ? app.guest.save : app.game.save
  const slots = app.mode === 'local' ? [0, 1] : [slot]
  ui.shopSlot = slot
  ui.showShop(
    save,
    slots,
    (s, upId) => {
      audio.onEvent({ t: 'buy' })
      if (app.mode === 'guest') app.net.send({ t: 'buy', upId })
      else {
        app.game.buyUpgrade(s, upId)
        persistSave()
      }
    },
    () => {}
  )
}

function onVictory() {
  if (app.state === 'victory') return
  app.state = 'victory'
  persistSave()
  setTimeout(() => {
    const mins = Math.round(app.playT / 60)
    const stats = `The vigil took ${mins <= 1 ? 'less than a minute' : mins + ' minutes'} of dark road.<br/>` +
      `${app.kills} hollow things returned to rest. ${app.deaths} times the dark nearly won.<br/>Emberhollow keeps a light in the window for you.`
    ui.showVictory(stats, () => {
      ui.showStory(STORY.victory, () => showTitle())
    })
  }, 3400)
}

// ---------- interact hint ----------
function computeHint(world, players, flags, completed) {
  for (const p of players) {
    if (!p) continue
    const st = p.st || p.state
    if (st !== 'alive') continue
    // downed ally first
    for (const a of players) {
      if (a && a !== p && (a.st || a.state) === 'down' && Math.hypot(a.x - p.x, a.y - p.y) < 24) return 'HOLD E — breathe fire back into your ally'
    }
    for (const pr of world.props) {
      const d = Math.hypot(pr.x - p.x, pr.y - p.y)
      if (d > 22) continue
      if (pr.kind === 'bonfire') return 'E — rest at the bonfire'
      if (pr.kind === 'chest' && !pr.opened) return 'E — break the seal'
      if (pr.kind === 'keyitem' && !pr.taken) return 'E — take it'
      if (pr.kind === 'brazier' && !pr.lit) return p.cls === 'knight' ? 'E — set your torch to it' : 'firebolt lights it'
      if (pr.kind === 'beacon' && !pr.lit && !completed) return 'E — RELIGHT THE PALE BEACON'
    }
    for (const n of world.npcs) {
      if (Math.hypot(n.x - p.x, n.y - p.y) < 24) return 'E — speak'
    }
    for (const gt of world.gates) {
      if (!gt.opened && Math.hypot(gt.x - p.x, gt.y - p.y) < 26) return 'E — try the gate'
    }
  }
  return null
}

// ---------- main loop ----------
let last = performance.now()
let acc = 0
const STEP = 1 / 60

function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min(0.1, (now - last) / 1000)
  last = now
  ui.tickDialogue(dt)

  if (app.state !== 'play' && app.state !== 'victory') {
    // menu backdrop: soft dark canvas
    const g = renderer.ctx
    g.fillStyle = '#08060f'
    g.fillRect(0, 0, VIEW_W, VIEW_H)
    drawMenuBackdrop(g, now / 1000)
    return
  }

  if (app.mode === 'guest') {
    guestFrame(dt)
    return
  }

  const g = app.game
  if (!g) return
  const blocked = app.paused || (ui.inDialogue && app.mode !== 'host') || ui._screen === 'shop'
  const dlgBlockHost = ui.inDialogue && app.mode === 'host' && g.bossState?.phase === 'intro'

  if (!blocked && !dlgBlockHost && app.state === 'play') {
    app.playT += dt
    acc += dt
    let steps = 0
    while (acc >= STEP && steps < 4) {
      acc -= STEP
      steps++
      const in0 = mergePads(padFromKeys(P1MAP, pressed[0]), app.mode === 'solo' || app.mode === 'host' ? readGamepad(0) : null)
      let in1 = null
      if (app.mode === 'local') in1 = mergePads(padFromKeys(P2MAP, pressed[1]), readGamepad(0))
      else if (app.mode === 'host') {
        in1 = app.guestInput || {}
      }
      // dialogue eats interact presses
      if (ui.inDialogue) {
        in0.interPressed = false
        if (in1) in1.interPressed = false
      }
      g.update(STEP, [in0, in1].filter((x, i) => g.players[i]))
      pressed[0] = {}
      pressed[1] = {}
      if (app.mode === 'host' && app.guestInput) {
        app.guestInput.interPressed = false
        app.guestInput.spc = false
        app.guestInput.dodge = false
      }
      for (const ev of g.events) handleEventLocal(ev)
      if (app.mode === 'host') app.hostEvts.push(...g.events.filter((e) => e.t !== 'transition'))
      if (g.pendingZone) {
        const pz = g.pendingZone
        enterZone(pz.zone, pz.entry)
        break
      }
    }
  }

  // camera + local co-op leash
  const focus = app.mode === 'host' ? [g.players[0]].filter(Boolean) : g.activePlayers().filter((p) => p.state !== 'dead')
  renderer.updateCamera(focus.length ? focus : g.activePlayers(), dt)
  if (app.mode === 'local') {
    const cam = renderer.cam
    for (const p of g.alivePlayers()) {
      p.x = Math.max(cam.x + 8, Math.min(cam.x + VIEW_W - 8, p.x))
      p.y = Math.max(cam.y + 8, Math.min(cam.y + VIEW_H - 8, p.y))
    }
  }

  // host: send snapshots
  if (app.mode === 'host' && app.net?.connected) {
    app.snapT -= dt
    if (app.snapT <= 0) {
      app.snapT = 1 / 12
      app.net.send(g.snapshot(app.hostEvts))
      app.hostEvts = []
    }
  }

  // render
  const state = {
    players: g.players,
    enemies: g.enemies,
    projs: g.projs,
    pickups: g.pickups,
    props: g.world.props,
    npcs: g.world.npcs,
    gates: g.world.gates,
    embers: g.save.embers,
    keyFlags: { rustkey: g.flag('rustkey'), stormsigil: g.flag('stormsigil'), palesigil: g.flag('palesigil') },
  }
  renderer.draw(state, dt, { onThunder: () => audio.onEvent({ t: 'thunder' }) })
  const anyAlive = g.activePlayers().some((p) => p.state === 'alive')
  ui.drawHUD(renderer.ctx, state, {
    hint: !ui.inDialogue && ui._screen !== 'shop' ? computeHint(g.world, g.players, g.save.flags, g.save.completed) : null,
    bossActive: app.bossActive,
    ping: app.net?.connected ? app.net.lastPing : null,
    wipeT: !anyAlive && g.activePlayers().length ? g.gameOverT : 0,
    wipeTip: app.wipeTip,
  }, dt)
}

// ---------- guest frame ----------
function guestFrame(dt) {
  const gs = app.guest
  if (!gs || !gs.curr) return
  const now = performance.now() / 1000

  // send input at ~20 Hz
  app.guestInT -= dt
  const in0 = mergePads(padFromKeys(P1MAP, pressed[0]), readGamepad(0))
  gs.lastIn = in0
  if (app.guestInT <= 0 && app.net?.connected && !ui.inDialogue && ui._screen !== 'shop') {
    app.guestInT = 1 / 20
    app.net.send({ t: 'in', i: in0 })
    pressed[0] = {}
  }

  // local prediction for own hero (slot 1) — movement only, blended to server
  const me = gs.curr.players[1]
  if (me && gs.inited) {
    const st = me.st
    if (st === 'alive') {
      const speed = 80
      let mx = in0.mx
      let my = in0.my
      const ml = Math.hypot(mx, my)
      if (ml > 1) {
        mx /= ml
        my /= ml
      }
      const [nx, ny] = gs.world.moveEntity(gs.px, gs.py, mx * speed * dt, my * speed * dt, 5, 4)
      gs.px = nx
      gs.py = ny
    }
    // correction blend toward authoritative position
    const errX = me.x - gs.px
    const errY = me.y - gs.py
    const err = Math.hypot(errX, errY)
    if (err > 48 || st !== 'alive') {
      gs.px = me.x
      gs.py = me.y
    } else {
      const k = 1 - Math.pow(0.02, dt)
      gs.px += errX * k
      gs.py += errY * k
    }
    // cosmetic local swing
    gs.swing = Math.max(0, gs.swing - dt / 0.24)
    if (in0.atk && gs.swing <= 0 && st === 'alive') {
      gs.swing = 1
      gs.swingDir = Math.atan2(me.fy || 0, me.fx || 1)
      if ((in0.mx || in0.my)) gs.swingDir = Math.atan2(in0.my, in0.mx)
    }
  }

  // interpolate remote entities between prev & curr snapshots
  const alpha = gs.prev ? Math.min(1, (now - gs.recvAt) / gs.interval) : 1
  const lerpEnt = (a, b) => (a && b ? { ...b, x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha } : b)
  const byId = (arr) => {
    const m = new Map()
    for (const e of arr || []) m.set(e.id, e)
    return m
  }
  const prevE = byId(gs.prev?.enemies)
  const enemies = (gs.curr.enemies || []).map((e) => lerpEnt(prevE.get(e.id), e))
  const prevP = byId(gs.prev?.projs)
  const projs = (gs.curr.projs || []).map((e) => lerpEnt(prevP.get(e.id), e))
  const prevPk = byId(gs.prev?.pickups)
  const pickups = (gs.curr.pickups || []).map((e) => lerpEnt(prevPk.get(e.id), e))
  const prevPl = new Map((gs.prev?.players || []).filter(Boolean).map((p) => [p.id, p]))
  const players = (gs.curr.players || []).map((p) => {
    if (!p) return null
    if (p.id === 1) {
      const vp = { ...p, x: gs.px, y: gs.py }
      if (gs.swing > 0) {
        vp.sw = Math.max(p.sw || 0, gs.swing)
        vp.sd = gs.swingDir
      }
      return vp
    }
    return lerpEnt(prevPl.get(p.id), p)
  })

  // reflect prop/gate state into the local world for collision & hints
  for (const wp of gs.world.props) {
    const sp = (gs.curr.props || []).find((q) => q.tx === wp.tx && q.ty === wp.ty && q.kind === wp.kind)
    if (sp) Object.assign(wp, sp)
  }
  for (const wg of gs.world.gates) {
    const sg = (gs.curr.gates || []).find((q) => q.tx === wg.tx && q.ty === wg.ty)
    if (sg) wg.opened = !!sg.o
  }

  renderer.updateCamera([{ x: gs.px, y: gs.py }], dt)
  const state = {
    players,
    enemies,
    projs,
    pickups,
    props: gs.world.props,
    npcs: gs.world.npcs,
    gates: gs.curr.gates || [],
    embers: gs.curr.embers,
    keyFlags: gs.curr.flags || {},
  }
  renderer.draw(state, dt, { onThunder: () => audio.onEvent({ t: 'thunder' }) })
  const anyAlive = players.filter(Boolean).some((p) => p.st === 'alive')
  ui.drawHUD(renderer.ctx, state, {
    hint: !ui.inDialogue && ui._screen !== 'shop' ? computeHint(gs.world, players.filter(Boolean).map((p) => ({ ...p, state: p.st })), {}, false) : null,
    bossActive: app.bossActive,
    ping: app.net?.lastPing,
    wipeT: !anyAlive && players.filter(Boolean).length ? 1 : 0,
    wipeTip: app.wipeTip,
  }, dt)
}

// ---------- menu backdrop ----------
const menuEmbers = Array.from({ length: 40 }, () => ({
  x: Math.random() * VIEW_W,
  y: Math.random() * VIEW_H,
  v: 4 + Math.random() * 10,
  ph: Math.random() * Math.PI * 2,
}))
function drawMenuBackdrop(g, t) {
  // distant castle silhouette
  g.fillStyle = '#0d0a18'
  g.fillRect(0, VIEW_H * 0.55, VIEW_W, VIEW_H * 0.45)
  g.fillStyle = '#120e20'
  // mountain
  g.beginPath()
  g.moveTo(VIEW_W * 0.2, VIEW_H * 0.62)
  g.lineTo(VIEW_W * 0.5, VIEW_H * 0.18)
  g.lineTo(VIEW_W * 0.8, VIEW_H * 0.62)
  g.fill()
  // keep
  g.fillStyle = '#0a0714'
  g.fillRect(VIEW_W * 0.44, VIEW_H * 0.16, VIEW_W * 0.12, VIEW_H * 0.3)
  g.fillRect(VIEW_W * 0.47, VIEW_H * 0.08, VIEW_W * 0.06, VIEW_H * 0.12)
  // one lit window
  g.fillStyle = `rgba(255,170,80,${0.5 + 0.3 * Math.sin(t * 2.3)})`
  g.fillRect(VIEW_W * 0.492, VIEW_H * 0.12, 3, 4)
  for (const e of menuEmbers) {
    e.y -= e.v * 0.016
    e.x += Math.sin(t + e.ph) * 0.3
    if (e.y < 0) {
      e.y = VIEW_H
      e.x = Math.random() * VIEW_W
    }
    g.fillStyle = `rgba(255,154,61,${0.15 + 0.2 * Math.sin(t * 3 + e.ph)})`
    g.fillRect(e.x, e.y, 1, 1)
  }
}

// ---------- debug hook (only with #debug in URL) ----------
if (location.hash.includes('debug')) {
  window.EV = {
    app,
    enterZone,
    give: (flag) => app.game?.setFlag(flag),
    embers: (n) => {
      if (app.game) app.game.save.embers += n
    },
    tp: (tx, ty) => {
      for (const p of app.game?.activePlayers() || []) {
        p.x = tx * TILE + 8
        p.y = ty * TILE + 8
      }
    },
  }
}

// ---------- boot ----------
showTitle()
requestAnimationFrame(frame)
