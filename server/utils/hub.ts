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

  gameId: string | null = null
  category: string | null = null
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

  // --- sockets -----------------------------------------------------------
  attach(pid: number, peer: Peer) {
    this.peers.set(pid, peer) // overwrite any stale socket for this pid
    this.peerPid.set(peer, pid)
    const p = this.players.get(pid)
    if (p) p.gone = false
    peer.send(JSON.stringify(this.stateFor(pid)))
    this.broadcast() // others see the rejoin
  }
  detach(peer: Peer) {
    const pid = this.peerPid.get(peer)
    this.peerPid.delete(peer)
    // Only tear down if this peer is STILL the live socket for the pid — a
    // reconnect may have already replaced it (old close must not drop the new).
    if (pid != null && this.peers.get(pid) === peer) {
      this.peers.delete(pid)
      const p = this.players.get(pid)
      if (p) p.gone = true
    }
    this.broadcast()
  }

  // --- GM actions --------------------------------------------------------
  selectGame(id: string) {
    if (!games[id]) return
    this.gameId = id
    this.category = null
    this.finalBoard = [] // returning to setup clears the previous game's final screen
    this.broadcast()
  }
  selectCategory(cat: string) {
    this.category = cat
    this.broadcast()
  }
  start(): string | null {
    if (!this.gameId) return 'Pick a game first.'
    const game = games[this.gameId]
    const res = game.start(this.activeIds(), configs[this.gameId], {
      names: this.names(),
      category: this.category,
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
        category: this.category,
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
    if (!this.game || !this.round) {
      if (this.finalBoard.length) return { phase: 'gameover', leaderboard: this.finalBoard }
      return { phase: 'waiting', roster: this.roster() }
    }
    const view = this.game.stateForPlayer(this.round, pid, this.elapsed())
    if (view.phase === 'playing' || view.phase === 'revealed') {
      ;(view as any).leaderboard = this.leaderboard()
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
      category: this.category,
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
