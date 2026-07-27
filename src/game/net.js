// ============================================================
// EMBERVALE — online co-op over WebRTC (PeerJS public broker).
// Host-authoritative: host runs the sim, guest sends inputs and
// renders interpolated snapshots with local movement prediction.
// ============================================================
import { Peer } from 'peerjs'

const PREFIX = 'embervale-v1-'
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no easy-to-confuse chars

// By default we use the free PeerJS cloud broker. A self-hosted
// peerjs-server can be used via ?peerhost=…&peerport=…&peersecure=0
function peerOpts() {
  const q = new URLSearchParams(location.search)
  const host = q.get('peerhost')
  if (host) {
    return {
      host,
      port: +(q.get('peerport') || 443),
      path: q.get('peerpath') || '/',
      secure: q.get('peersecure') !== '0',
      debug: 0,
    }
  }
  return { debug: 0 }
}

export function makeCode() {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]
  return s
}

export class Net {
  constructor() {
    this.peer = null
    this.conn = null
    this.role = null // 'host' | 'guest'
    this.code = null
    this.onData = null
    this.onPeerJoin = null
    this.onPeerLeave = null
    this.onError = null
    this.lastPing = 0
    this._pingT = null
  }

  destroy() {
    if (this._pingT) clearInterval(this._pingT)
    try { this.conn?.close() } catch {}
    try { this.peer?.destroy() } catch {}
    this.peer = null
    this.conn = null
    this.role = null
  }

  host() {
    return new Promise((resolve, reject) => {
      const code = makeCode()
      const peer = new Peer(PREFIX + code, peerOpts())
      this.peer = peer
      this.role = 'host'
      this.code = code
      let settled = false
      peer.on('open', () => {
        settled = true
        resolve(code)
      })
      peer.on('error', (err) => {
        if (!settled && String(err.type) === 'unavailable-id') {
          // rare code collision — retry with a new code
          peer.destroy()
          this.host().then(resolve, reject)
          return
        }
        if (!settled) {
          settled = true
          reject(err)
        } else this.onError?.(err)
      })
      peer.on('connection', (conn) => {
        if (this.conn) {
          // one guest max — refuse extras
          conn.on('open', () => {
            conn.send({ t: 'full' })
            setTimeout(() => conn.close(), 300)
          })
          return
        }
        this.conn = conn
        conn.on('data', (d) => this._recv(d))
        conn.on('open', () => this.onPeerJoin?.(conn))
        conn.on('close', () => {
          this.conn = null
          this.onPeerLeave?.()
        })
        conn.on('error', () => {
          this.conn = null
          this.onPeerLeave?.()
        })
      })
    })
  }

  join(code) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOpts())
      this.peer = peer
      this.role = 'guest'
      this.code = code
      let settled = false
      const fail = (err) => {
        if (!settled) {
          settled = true
          reject(err)
        } else this.onError?.(err)
      }
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' })
        this.conn = conn
        const joinTimeout = setTimeout(() => fail(new Error('No answer — check the code and try again.')), 12000)
        conn.on('open', () => {
          clearTimeout(joinTimeout)
          settled = true
          this._startPing()
          resolve()
        })
        conn.on('data', (d) => this._recv(d))
        conn.on('close', () => {
          clearTimeout(joinTimeout)
          this.onPeerLeave?.()
        })
        conn.on('error', (e) => {
          clearTimeout(joinTimeout)
          fail(e)
        })
      })
      peer.on('error', (err) => {
        if (String(err.type) === 'peer-unavailable') fail(new Error('Room not found. Check the code.'))
        else fail(err)
      })
    })
  }

  _startPing() {
    this._pingT = setInterval(() => {
      this.send({ t: 'ping', at: performance.now() })
    }, 2000)
  }

  _recv(d) {
    if (!d || typeof d !== 'object') return
    if (d.t === 'ping') {
      this.send({ t: 'pong', at: d.at })
      return
    }
    if (d.t === 'pong') {
      this.lastPing = Math.round(performance.now() - d.at)
      return
    }
    this.onData?.(d)
  }

  send(obj) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(obj)
      } catch {}
    }
  }

  get connected() {
    return !!(this.conn && this.conn.open)
  }
}
