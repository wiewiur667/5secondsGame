import { games } from '../games'
import type { GameModule, Leaderboard, PlayerView } from '../games/types'
import musicCfg from '../games/music-impostor/music.json'
import questionsCfg from '../games/five-second-rule/questions.json'
import { lanIp } from './lanIp'

// Config bundled per game (JSON imports are inlined by the bundler — no runtime fs).
const configs: Record<string, any> = {
  'music-impostor': musicCfg,
  'five-second-rule': questionsCfg,
}

type Peer = { send: (data: any) => void }

interface Player {
  name: string
  gone: boolean
}

class Hub {
  players = new Map<number, Player>()
  nextId = 1
  peers = new Map<number, Peer>() // pid -> live socket
  peerPid = new Map<Peer, number>() // reverse, for close cleanup

  autoAdvance = true // GM toggle: auto-advance to next question after reveal
  timerSeconds = 5 // GM-chosen answer window for 5 Second Rule
  gameId: string | null = null
  categories: string[] = [] // 5s: GM can pick several decks at once
  game: GameModule | null = null
  round: any = null
  startMs = 0
  scored = false
  totals = new Map<number, number>()
  finalBoard: Leaderboard = [] // final scores shown to phones after a game ends

  constructor() {
    setInterval(() => this.tick(), 1000)
  }

  // --- players -----------------------------------------------------------
  register(name: string): number {
    const nm = String(name || '').trim().slice(0, 20) || 'Anon'
    const id = this.nextId++
    this.players.set(id, { name: nm, gone: false })
    this.broadcast()
    return id
  }
  private names(): Record<number, string> {
    const o: Record<number, string> = {}
    for (const [id, p] of this.players) o[id] = p.name
    return o
  }
  private activeIds(): number[] {
    return [...this.players].filter(([, p]) => !p.gone).map(([id]) => id)
  }
  private roster(): string[] {
    return [...this.players.values()].filter((p) => !p.gone).map((p) => p.name)
  }
  // Game master = earliest-registered active player. Based on players, not live
  // sockets, so a phone locking (transient WS drop) does NOT flicker the role;
  // it only reassigns on an explicit logout/leave (which removes the player).
  private currentGm(): number | null {
    let m: number | null = null
    for (const id of this.activeIds()) if (m === null || id < m) m = id
    return m
  }

  // --- sockets -----------------------------------------------------------
  attach(pid: number, peer: Peer) {
    // Unknown/stale id (e.g. after a server restart) — tell the client to
    // re-register instead of parking a ghost entry in `peers`.
    if (!this.players.has(pid)) {
      try { peer.send(JSON.stringify({ phase: 'register' })) } catch {}
      return
    }
    const prev = this.peerPid.get(peer) // a reconnecting socket may hold an old pid
    if (prev != null && prev !== pid && this.peers.get(prev) === peer) this.peers.delete(prev)
    this.peers.set(pid, peer) // overwrite any stale socket for this pid
    this.peerPid.set(peer, pid)
    const p = this.players.get(pid)
    if (p) p.gone = false
    peer.send(JSON.stringify(this.stateFor(pid)))
    this.broadcast() // others see the rejoin
  }
  // Explicit logout: remove the player entirely (frees the GM role to reassign).
  logoutPeer(peer: Peer) {
    const pid = this.peerPid.get(peer)
    this.peerPid.delete(peer)
    if (pid != null) {
      this.peers.delete(pid)
      this.players.delete(pid)
    }
    this.broadcast()
  }
  detach(peer: Peer) {
    const pid = this.peerPid.get(peer)
    this.peerPid.delete(peer)
    // Only drop the socket if this peer is STILL the live one for the pid — a
    // reconnect may have already replaced it (old close must not drop the new).
    // We do NOT mark the player gone: phones lock and tabs navigate (e.g. to
    // /gm) all the time at a party; the player stays in the game and the WS
    // auto-reconnects. Ghost of a truly-departed player is harmless.
    if (pid != null && this.peers.get(pid) === peer) this.peers.delete(pid)
    this.broadcast()
  }

  // --- GM actions --------------------------------------------------------
  selectGame(id: string) {
    if (!games[id]) return
    this.gameId = id
    this.categories = []
    this.finalBoard = [] // returning to setup clears the previous game's final screen
    this.broadcast()
  }
  selectCategory(cat: string) {
    const at = this.categories.indexOf(cat)
    if (at >= 0) this.categories.splice(at, 1) // toggle off
    else this.categories.push(cat) // toggle on
    this.broadcast()
  }
  setAutoAdvance(on: boolean) {
    this.autoAdvance = !!on
    this.broadcast()
  }
  setTimer(seconds: number) {
    const n = Math.round(Number(seconds))
    if (Number.isFinite(n)) this.timerSeconds = Math.min(60, Math.max(3, n))
    this.broadcast()
  }
  // Full wipe: kick everyone back to the name prompt, clear scores/selection.
  reset() {
    for (const [, peer] of this.peers) {
      try { peer.send(JSON.stringify({ phase: 'register' })) } catch {}
    }
    this.players.clear()
    this.peers.clear()
    this.peerPid.clear()
    this.nextId = 1
    this.gameId = null
    this.categories = []
    this.game = null
    this.round = null
    this.scored = false
    this.totals = new Map()
    this.finalBoard = []
    this.timerSeconds = 5
  }
  start(): string | null {
    if (!this.gameId) return 'Pick a game first.'
    const game = games[this.gameId]
    const res = game.start(this.activeIds(), configs[this.gameId], {
      names: this.names(),
      categories: this.categories,
      timerSeconds: this.timerSeconds,
    })
    if (typeof res === 'string') return res // rejection message
    this.game = game
    this.round = res
    this.startMs = Date.now()
    this.scored = false
    this.totals = new Map()
    this.finalBoard = []
    this.broadcast()
    return null
  }
  next() {
    if (!this.game || !this.round) return
    this.applyScore() // score the current round before advancing (GM may press Next before reveal)
    if (this.game.next) {
      const more = this.game.next(this.round)
      if (!more) return this.end() // questions exhausted → final scores
    } else {
      // Games without `next` (e.g. Music Impostor): Next = a fresh round.
      const res = this.game.start(this.activeIds(), configs[this.gameId!], {
        names: this.names(),
        categories: this.categories,
      })
      if (typeof res === 'string') return this.end() // e.g. players dropped below 2 — back to lobby
      this.round = res
    }
    this.startMs = Date.now()
    this.scored = false
    this.broadcast()
  }
  end() {
    this.finalBoard = this.leaderboard() // snapshot so phones can show the payoff
    this.game = null
    this.round = null
    this.scored = false
    this.broadcast()
  }
  submit(pid: number, payload: any) {
    if (!this.game?.submit || !this.round) return
    this.game.submit(this.round, pid, payload, this.elapsed())
    this.broadcast()
  }
  submitByPeer(peer: Peer, payload: any) {
    const pid = this.peerPid.get(peer)
    if (pid != null) this.submit(pid, payload)
  }
  // Any-player actions (5s): start the timer / reveal answers. First press wins.
  startTimer() {
    if (this.game?.startTimer && this.round) {
      this.game.startTimer(this.round, this.elapsed())
      this.broadcast()
    }
  }
  reveal() {
    if (this.game?.reveal && this.round) {
      this.game.reveal(this.round, this.elapsed())
      this.broadcast()
    }
  }

  // --- clock / scoring ---------------------------------------------------
  private elapsed(): number {
    return this.round ? (Date.now() - this.startMs) / 1000 : 0
  }
  private applyScore() {
    if (this.scored || !this.round) return
    if (this.game?.score) {
      const pts = this.game.score(this.round)
      for (const [pid, n] of Object.entries(pts)) {
        this.totals.set(Number(pid), (this.totals.get(Number(pid)) || 0) + n)
      }
    }
    this.scored = true
  }
  private tick() {
    if (!this.game || !this.round) return
    const over = this.game.tick ? this.game.tick(this.round, this.elapsed()) : false
    if (over) this.applyScore()
    // Auto-advance (5s: 10s after reveal) — GM can still press Next early / turn this off.
    if (this.autoAdvance && this.scored && this.game.autoAdvanceAt) {
      const at = this.game.autoAdvanceAt(this.round)
      if (at != null && this.elapsed() >= at) return this.next()
    }
    this.broadcast()
  }
  private leaderboard(): Leaderboard {
    return [...this.totals]
      .map(([id, score]) => ({ id, name: this.players.get(id)?.name || '(left)', score }))
      .sort((a, b) => b.score - a.score)
  }

  // --- views -------------------------------------------------------------
  stateFor(pid: number): PlayerView {
    if (!this.players.has(pid)) return { phase: 'register' }
    const isGm = pid === this.currentGm()
    if (!this.game || !this.round) {
      if (this.finalBoard.length) return { phase: 'gameover', leaderboard: this.finalBoard, isGm }
      return { phase: 'waiting', roster: this.roster(), isGm }
    }
    const view = this.game.stateForPlayer(this.round, pid, this.elapsed())
    if (view.phase === 'playing' || view.phase === 'revealed') {
      ;(view as any).leaderboard = this.leaderboard()
      ;(view as any).autoAdvance = this.autoAdvance
      ;(view as any).isGm = isGm
    }
    return view
  }
  gmState() {
    const catList =
      this.gameId === 'five-second-rule'
        ? (configs['five-second-rule'].categories as any[]).map((c) => ({ id: c.id, name: c.name }))
        : []
    let phase = 'lobby'
    if (this.game && this.round) phase = this.scored ? 'revealed' : 'playing'
    return {
      games: Object.values(games).map((g) => ({ id: g.id, name: g.name })),
      gameId: this.gameId,
      categories: catList,
      selected: this.categories,
      autoAdvance: this.autoAdvance,
      timerSeconds: this.timerSeconds,
      phase,
      players: [...this.players].map(([id, p]) => ({ id, name: p.name, gone: p.gone })),
      leaderboard: this.leaderboard(),
      joinUrl: `http://${lanIp()}:${process.env.PORT || 3333}`,
    }
  }

  broadcast() {
    for (const [pid, peer] of this.peers) {
      try {
        peer.send(JSON.stringify(this.stateFor(pid)))
      } catch {
        /* dropped; close handler cleans up */
      }
    }
  }
}

// Singleton on globalThis so it survives Nitro dev HMR reloads.
const g = globalThis as any
export const hub: Hub = g.__partyHub || (g.__partyHub = new Hub())
