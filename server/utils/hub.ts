import { games } from '../games'
import type { FinalAward, GameModule, Leaderboard, PlayerView } from '../games/types'
import musicCfg from '../games/music-impostor/music.json'
import questionsCfg from '../games/five-second-rule/questions.json'
import ripostaCfg from '../games/riposta/prompts.json'
import obstawCfg from '../games/obstaw/content.json'
import { lanIp } from './lanIp'
import { appendFile } from 'node:fs/promises'

// Flagged questions land here, one JSON object per line, for fixing questions.json later.
const FLAG_FILE = process.env.FLAG_FILE || 'flagged-questions.jsonl'

// Config bundled per game (JSON imports are inlined by the bundler — no runtime fs).
const configs: Record<string, any> = {
  'music-impostor': musicCfg,
  'five-second-rule': questionsCfg,
  riposta: ripostaCfg,
  obstaw: obstawCfg,
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
  // Rejoin grants in flight but not yet confirmed by a real WS attach() —
  // closes the TOCTOU window between the HTTP grant and the client's `hello`.
  private claims = new Map<number, number>() // pid -> claimedAtMs

  autoAdvance = true // GM toggle: auto-advance to next question after reveal
  revealOnAllAnswered = true // GM toggle: reveal early once every player has fully answered
  penalizeWrong = false // GM toggle: each wrong pick cancels a right one
  pausedAtMs: number | null = null // GM pause: the round clock freezes here until resume
  lastPts: Record<number, number> = {} // what the last applyScore added, so replay can take it back
  timerSeconds = 5 // GM-chosen answer window for 5 Second Rule
  questionLimit = 20 // GM-chosen questions per game for 5 Second Rule; 0 = all of the chosen decks
  // Question ids already played this session, per game (ids are only unique within
  // one game's content) — avoided in later games.
  usedQuestions = new Map<string, Set<number>>()
  // GM-chosen values for the options a game declares (GameModule.settings), per game.
  options: Record<string, Record<string, string | number>> = {}
  gameId: string | null = null
  categories: string[] = [] // 5s: GM can pick several decks at once
  game: GameModule | null = null
  round: any = null
  startMs = 0
  scored = false
  totals = new Map<number, number>()
  rankDelta = new Map<number, number>() // pid -> places gained (+) / lost (-) by the last scored question
  finalBoard: Leaderboard = [] // final scores shown to phones after a game ends
  finalAwards: FinalAward[] = [] // end-of-game titles shown with the final scores

  constructor() {
    setInterval(() => this.tick(), 1000)
  }

  // --- players -----------------------------------------------------------
  // Case-insensitive name match against current players, plus whether that
  // player has a live socket right now (peers.has, not the `gone` flag —
  // `gone` is intentionally never set for transient drops, see detach()).
  findByName(name: string): { id: number; connected: boolean } | null {
    const nm = String(name || '').trim().toLowerCase()
    for (const [id, p] of this.players) {
      if (p.name.toLowerCase() === nm) {
        return { id, connected: this.peers.has(id) || this.isClaimed(id) }
      }
    }
    return null
  }
  // Lazily expires: a claim older than the TTL was never confirmed by a real
  // WS attach() (dialog dismissed, network died) and must not block the name.
  private isClaimed(pid: number): boolean {
    const t = this.claims.get(pid)
    if (t == null) return false
    if (Date.now() - t > 8000) {
      this.claims.delete(pid)
      return false
    }
    return true
  }
  // Atomic check-then-set grant for the rejoin flow. Only one concurrent
  // caller for the same pid can succeed; the loser must fall back to a
  // normal conflict response instead of also being handed the id.
  claimRejoin(pid: number): boolean {
    if (this.peers.has(pid) || this.isClaimed(pid)) return false
    this.claims.set(pid, Date.now())
    return true
  }
  // Disconnected players a returning phone may take over (tap-to-rejoin list).
  rejoinable(): { id: number; name: string }[] {
    return [...this.players]
      .filter(([id]) => !this.peers.has(id) && !this.isClaimed(id))
      .map(([id, p]) => ({ id, name: p.name }))
  }
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
    this.claims.delete(pid) // real WS confirmed — the rejoin claim is settled
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

  // GM kick: remove the player entirely (frees the name, and reassigns the
  // GM role automatically via currentGm() if the removed player held it).
  removePlayer(pid: number) {
    const peer = this.peers.get(pid)
    if (peer) {
      try { peer.send(JSON.stringify({ phase: 'register' })) } catch {}
      this.peers.delete(pid)
      this.peerPid.delete(peer)
    }
    this.players.delete(pid)
    this.claims.delete(pid)
    this.broadcast()
  }

  // --- GM actions --------------------------------------------------------
  selectGame(id: string) {
    if (!games[id]) return
    this.gameId = id
    this.categories = []
    this.finalBoard = [] // returning to setup clears the previous game's final screen
    this.finalAwards = []
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
  setRevealOnAllAnswered(on: boolean) {
    this.revealOnAllAnswered = !!on
    this.broadcast()
  }
  setPenalizeWrong(on: boolean) {
    this.penalizeWrong = !!on
    this.broadcast()
  }
  setTimer(seconds: number) {
    const n = Math.round(Number(seconds))
    if (Number.isFinite(n)) this.timerSeconds = Math.min(60, Math.max(3, n))
    this.broadcast()
  }
  // Generic game option (GameModule.settings): only a value the game offers is accepted.
  setOption(key: string, value: unknown) {
    const def = this.gameId ? games[this.gameId]?.settings?.find((d) => d.key === key) : undefined
    const opt = def?.options.find((o) => String(o.value) === String(value))
    if (!def || !opt) return
    ;(this.options[this.gameId!] ??= {})[key] = opt.value
    this.broadcast()
  }
  private settingsFor(id: string): Record<string, string | number> {
    const out: Record<string, string | number> = {}
    for (const d of games[id]?.settings ?? []) out[d.key] = this.options[id]?.[d.key] ?? d.default
    return out
  }
  private usedFor(id: string): Set<number> {
    let set = this.usedQuestions.get(id)
    if (!set) this.usedQuestions.set(id, (set = new Set()))
    return set
  }
  setQuestionLimit(count: number) {
    const n = Math.round(Number(count))
    if (Number.isFinite(n)) this.questionLimit = Math.min(1000, Math.max(0, n))
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
    this.rankDelta = new Map()
    this.finalBoard = []
    this.finalAwards = []
    this.timerSeconds = 5
    this.questionLimit = 20
    this.usedQuestions = new Map()
    this.options = {}
    this.autoAdvance = true
    this.revealOnAllAnswered = true
    this.penalizeWrong = false
    this.pausedAtMs = null
  }
  start(): string | null {
    if (!this.gameId) return 'Najpierw wybierz grę.'
    const game = games[this.gameId]
    const res = game.start(this.activeIds(), configs[this.gameId], {
      names: this.names(),
      categories: this.categories,
      timerSeconds: this.timerSeconds,
      questionCount: this.questionLimit,
      used: this.usedFor(this.gameId),
      settings: this.settingsFor(this.gameId),
    })
    if (typeof res === 'string') return res // rejection message
    this.game = game
    this.round = res
    this.startMs = Date.now()
    this.pausedAtMs = null
    this.scored = false
    // Scored games list everyone from the first question, not only those who have scored.
    this.totals = new Map(game.score ? this.scoringIds().map((id) => [id, 0]) : [])
    this.rankDelta = new Map()
    this.finalBoard = []
    this.finalAwards = []
    this.broadcast()
    return null
  }
  // `score` = false skips scoring the current question (GM "skip a bad question").
  next(score = true) {
    if (!this.game || !this.round) return
    if (score) this.applyScore() // score the current round before advancing (GM may press Next before reveal)
    if (this.game.next) {
      const more = this.game.next(this.round, this.activeIds())
      if (!more) return this.end() // questions exhausted → final scores
      // ponytail: late joiners start at the current lowest score — not hopeless, not a free lead
      const floor = this.totals.size ? Math.min(...this.totals.values()) : 0
      for (const id of this.scoringIds()) if (!this.totals.has(id)) this.totals.set(id, floor)
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
    this.pausedAtMs = null
    this.scored = false
    this.rankDelta = new Map() // the new question hasn't moved anyone yet
    this.broadcast()
  }
  skip() {
    this.next(false)
  }
  // Re-ask the current question from scratch, taking back any points it already gave.
  replay() {
    if (!this.game?.replay || !this.round) return
    if (this.scored) {
      for (const [pid, n] of Object.entries(this.lastPts)) {
        this.totals.set(Number(pid), (this.totals.get(Number(pid)) || 0) - n)
      }
    }
    this.game.replay(this.round)
    this.startMs = Date.now()
    this.pausedAtMs = null
    this.scored = false
    this.lastPts = {}
    this.rankDelta = new Map()
    this.broadcast()
  }
  togglePause() {
    if (!this.round) return
    if (this.pausedAtMs == null) this.pausedAtMs = Date.now()
    else {
      this.startMs += Date.now() - this.pausedAtMs // shift the clock so elapsed() continues where it stopped
      this.pausedAtMs = null
    }
    this.broadcast()
  }
  get paused() {
    return this.pausedAtMs != null
  }
  // GM manual correction (±points), e.g. for a disputed answer.
  adjustScore(pid: number, delta: number) {
    const d = Math.round(Number(delta))
    if (!this.players.has(pid) || !Number.isFinite(d)) return
    this.totals.set(pid, (this.totals.get(pid) || 0) + d)
    this.broadcast()
  }
  flagByPeer(peer: Peer) {
    const pid = this.peerPid.get(peer)
    if (pid == null || !this.game?.flag || !this.round) return
    const f = this.game.flag(this.round, pid)
    if (!f) return
    const line = JSON.stringify({ at: new Date().toISOString(), game: this.gameId, ...f, by: this.players.get(pid)?.name })
    appendFile(FLAG_FILE, line + '\n').catch((e) => console.error('[hub] flag write failed', e))
    this.broadcast()
  }
  end() {
    this.finalBoard = this.leaderboard() // snapshot so phones can show the payoff
    this.finalAwards = (this.game?.awards?.(this.round) ?? []).map((a) => ({
      title: a.title,
      detail: a.detail,
      name: this.players.get(a.pid)?.name ?? '?',
    }))
    this.game = null
    this.round = null
    this.scored = false
    this.pausedAtMs = null // ending while paused must not leave the lobby showing "paused"
    this.broadcast()
  }
  submit(pid: number, payload: any) {
    if (!this.game?.submit || !this.round || this.paused) return
    this.game.submit(this.round, pid, payload, this.elapsed(), {
      revealOnAllAnswered: this.revealOnAllAnswered,
    })
    this.settle()
    this.broadcast()
  }
  submitByPeer(peer: Peer, payload: any) {
    const pid = this.peerPid.get(peer)
    if (pid != null) this.submit(pid, payload)
  }
  // Any-player actions (5s): start the timer / reveal answers. First press wins.
  startTimer(pid?: number) {
    if (this.game?.startTimer && this.round && !this.paused) {
      this.game.startTimer(this.round, this.elapsed(), pid)
      this.broadcast()
    }
  }
  startTimerByPeer(peer: Peer) {
    const pid = this.peerPid.get(peer)
    if (pid != null) this.startTimer(pid)
  }
  reveal() {
    if (this.game?.reveal && this.round && !this.paused) {
      this.game.reveal(this.round, this.elapsed())
      this.settle()
      this.broadcast()
    }
  }
  // Any player unsticks a manual-mode reveal (auto-advance off). Only fires
  // when genuinely stuck — revealed + not auto — so it can't skip a live round.
  playerContinue() {
    if (!this.autoAdvance && this.scored && !this.paused) this.next()
  }

  // --- clock / scoring ---------------------------------------------------
  // Who gets a leaderboard row: the game's scoring players, or everyone active.
  private scoringIds(): number[] {
    return this.game?.scoringIds && this.round ? this.game.scoringIds(this.round) : this.activeIds()
  }
  private elapsed(): number {
    return this.round ? ((this.pausedAtMs ?? Date.now()) - this.startMs) / 1000 : 0
  }
  private applyScore() {
    if (this.scored || !this.round) return
    if (this.game?.score) {
      const before = this.rankOf()
      const pts = this.game.score(this.round, { penalizeWrong: this.penalizeWrong })
      this.lastPts = pts
      for (const [pid, n] of Object.entries(pts)) {
        this.totals.set(Number(pid), (this.totals.get(Number(pid)) || 0) + n)
      }
      // Rank movement only means something once someone had points before this question.
      const moved = [...before.values()].some(([, score]) => score > 0)
      const after = this.rankOf()
      this.rankDelta = new Map(
        [...after].map(([pid, [rank]]) => [pid, moved && before.has(pid) ? before.get(pid)![0] - rank : 0]),
      )
    }
    this.scored = true
  }
  // pid -> [rank (0-based), score], by current totals (ties keep join order).
  private rankOf(): Map<number, [number, number]> {
    return new Map(this.leaderboard().map((r, i) => [r.id, [i, r.score]]))
  }
  // Score the round the moment it ends, instead of waiting for the next 1s tick.
  private settle() {
    if (this.game?.tick?.(this.round, this.elapsed(), { activeIds: this.activeIds() })) this.applyScore()
  }
  private tick() {
    if (!this.game || !this.round || this.paused) return
    this.settle()
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
  // Names come from live players so reveal screens can show everyone, not just you.
  stateFor(pid: number): PlayerView {
    if (!this.players.has(pid)) return { phase: 'register' }
    const isGm = pid === this.currentGm()
    if (!this.game || !this.round) {
      if (this.finalBoard.length)
        return { phase: 'gameover', leaderboard: this.finalBoard, isGm, awards: this.finalAwards }
      return { phase: 'waiting', roster: this.roster(), isGm }
    }
    const view = this.game.stateForPlayer(this.round, pid, this.elapsed(), this.names())
    if (view.phase === 'playing' || view.phase === 'revealed') {
      const board = this.leaderboard()
      ;(view as any).leaderboard =
        view.phase === 'revealed' ? board.map((r) => ({ ...r, delta: this.rankDelta.get(r.id) ?? 0 })) : board
      ;(view as any).autoAdvance = this.autoAdvance
      ;(view as any).paused = this.paused
      ;(view as any).isGm = isGm
    }
    return view
  }
  gmState(port: string | number = process.env.PORT || 3333) {
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
      revealOnAllAnswered: this.revealOnAllAnswered,
      penalizeWrong: this.penalizeWrong,
      paused: this.paused,
      timerSeconds: this.timerSeconds,
      questionLimit: this.questionLimit,
      settings: (this.gameId ? games[this.gameId]?.settings ?? [] : []).map((d) => ({
        key: d.key,
        label: d.label,
        options: d.options,
        value: this.settingsFor(this.gameId!)[d.key],
      })),
      phase,
      players: [...this.players].map(([id, p]) => ({ id, name: p.name, gone: p.gone })),
      leaderboard: this.leaderboard().map((r) => ({ ...r, delta: phase === 'revealed' ? this.rankDelta.get(r.id) ?? 0 : 0 })),
      live: this.game?.publicView && this.round ? this.game.publicView(this.round, this.elapsed(), this.names()) : null,
      finalBoard: this.finalBoard,
      finalAwards: this.finalAwards,
      joinUrl: `http://${lanIp()}:${port}`,
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
