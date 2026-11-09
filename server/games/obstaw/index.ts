import type { GameAward, GameModule, PlayerView, TickContext } from '../types'

// Obstaw! — an original Polish betting party game, following the rules of the
// classic "bet on your friends" board game (see reports/ + CLAUDE.md):
// a board with a pawn per player, a die, a bank, 3 task decks, YES/NO bets of at
// most half your money, "blind bet", dice duel, start-field bonus, one partner
// marker per opponent for acting tasks. The board grows with the number of players.
//
// Hub mapping: one hub "question" = one TURN (several rolls if the pawn lands on
// START or an arrow). The hub clock restarts at 0 for every turn, so all deadlines
// are absolute `t` values of the current turn. `score()` returns the money delta
// since the last report, so the hub leaderboard always equals the players' money.
// All card texts are original — see content.json.

type CellType = 'start' | 'arrow' | 'skill' | 'mental' | 'acting' | 'blind' | 'dice'
type Task = 'skill' | 'mental' | 'acting'
type Stage = 'roll' | 'choose' | 'bet' | 'ready' | 'act' | 'judge' | 'revealed'

// sec = hourglass seconds (15 yellow / 30 red / 60 black); null = the card shows no hourglass
interface Skill { id: number; sec: number | null; text: string; tries?: string }
interface Mental { id: number; sec: number | null; q: string; hints: string[] }
interface Acting { id: number; first: [string, string]; second: [string, string] }
interface Config { skill: Skill[]; mental: Mental[]; acting: Acting[] }
interface Cell { t: CellType; c: number } // c = combo 0..3 (bit1 → first part 2, bit0 → second part B); acting only

interface Bet { yes: boolean; amount: number }
interface Turn {
  no: number
  performer: number
  rolls: number[] // every die roll of this turn (arrow / start re-rolls)
  field: number // cell the pawn stands on
  kind: CellType // type of that cell
  again: 'start' | 'arrow' | null // last roll landed on a re-roll field
  task: Task | null // what is actually played (blind: chosen by the performer)
  partner: number | null // acting only
  judge: number | null // player to the left; rules whether it worked
  opponent: number | null // dice only
  stake: number // dice only
  card: Skill | Mental | Acting | null
  phrase: string | null
  bets: Record<number, Bet>
  stage: Stage
  deadline: number
  success: boolean | null
  dice: [number, number] | null
  skipped: boolean // acting field but the performer has no markers left
  startPay: number // start-field bonus paid this turn
  delta: Record<number, number> // money change caused by this turn's result
  revealAt: number | null
}
interface State {
  players: number[]
  money: Record<number, number>
  reported: Record<number, number>
  pos: Record<number, number>
  markers: Record<number, number[]> // pid → opponents whose marker they still hold
  board: Cell[]
  bank: number
  bankLimited: boolean
  turnLimit: number // 0 = no limit
  judgeBets: boolean
  turn: Turn
  betSeconds: number
  queues: { skill: Skill[]; mental: Mental[]; acting: Acting[] }
  cfg: Config
  used: Set<number> | undefined
  stats: Record<number, { right: number; wrong: number; done: number; biggest: number }>
}

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 10
export const START_MONEY = 80
export const START_BONUS = 50
const STEP = 10
const GRACE = 1.5
const ROLL_SECONDS = 20
const CHOOSE_SECONDS = 25
const READY_SECONDS = 25
const JUDGE_SECONDS = 40
const ACTING_SECONDS = 90
const RESULT_SECONDS = 12

const FIELD_LABEL: Record<CellType, string> = {
  start: '🏁 Start',
  arrow: '↩️ Strzałka',
  skill: '🤹 Zadanie zręcznościowe',
  mental: '🧠 Zadanie umysłowe',
  acting: '🎭 Zadanie aktorskie',
  blind: '🎲 Zakład w ciemno',
  dice: '🎰 Kości zostały rzucone',
}
const TASK_LABEL: Record<Task, string> = { skill: 'zręcznościowe', mental: 'umysłowe', acting: 'aktorskie' }

// Largest allowed bet: at most half of the money, in steps of 10.
export const maxBet = (money: number) => Math.max(0, Math.floor(money / 2 / STEP) * STEP)
// 24 fields for 3–4 players, 32 (the layout of the classic board) for 5–6, 40 for 7–8, 48 for 9–10.
export const boardSize = (players: number) => (players <= 4 ? 24 : players <= 6 ? 32 : players <= 8 ? 40 : 48)
const NO_HOURGLASS_SECONDS = 180 // soft cap for cards without an hourglass
export const comboLabel = (c: number) => `${(c >> 1) + 1}${'AB'[c & 1]}`

function shuffle<T>(a: T[], rng = Math.random): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
const oneOf = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const clock = (s: State, t: number) => Math.max(0, Math.ceil(s.turn.deadline - t))

// The board follows the layout of the classic 32-field board (clockwise from START:
// M mental, S skill, D dice duel, B blind bet, R arrow, <n><L> acting with its 1A–2B
// symbols) and is shrunk / extended by removing / inserting ordinary fields for other
// player counts. Cell 0 is START.
const CLASSIC = 'M 1A S D 1B M 2A R D S 2B B M 1A S R 1B M 2A D S 2B B R D 1A M B 1B S 2A'.split(' ')
const FILL_CYCLE = ['2B', 'S', 'M', '1A', 'D', 'M', '1B', 'S', '2A', 'M', 'S', '2B']
function parseCell(tok: string): Cell {
  if (/^[12][AB]$/.test(tok)) return { t: 'acting', c: (Number(tok[0]) - 1) * 2 + (tok[1] === 'B' ? 1 : 0) }
  const t: Record<string, CellType> = { M: 'mental', S: 'skill', D: 'dice', B: 'blind', R: 'arrow' }
  return { t: t[tok], c: 0 }
}
export function makeBoard(players: number): Cell[] {
  const target = boardSize(players) - 1
  let toks = [...CLASSIC]
  const isFill = (tok: string) => /^[12][AB]$|^[MS]$/.test(tok)
  if (target < toks.length) {
    const fill = toks.map((tok, i) => (isFill(tok) ? i : -1)).filter((i) => i >= 0)
    const k = toks.length - target
    const drop = new Set(Array.from({ length: k }, (_, j) => fill[Math.floor(((j + 0.5) * fill.length) / k)]))
    toks = toks.filter((_, i) => !drop.has(i))
  } else if (target > toks.length) {
    const k = target - toks.length
    const after = Array.from({ length: k }, (_, j) => Math.floor(((j + 0.5) * toks.length) / k))
    const out: string[] = []
    let n = 0
    toks.forEach((tok, i) => {
      out.push(tok)
      after.filter((a) => a === i).forEach(() => out.push(FILL_CYCLE[n++ % FILL_CYCLE.length]))
    })
    toks = out
  }
  return [{ t: 'start', c: 0 }, ...toks.map(parseCell)]
}

// Unused cards first, then the rest, each shuffled.
function queueOf<T extends { id: number }>(pool: T[], used?: Set<number>): T[] {
  return [...shuffle(pool.filter((c) => !used?.has(c.id))), ...shuffle(pool.filter((c) => used?.has(c.id)))]
}
function draw<T extends { id: number }>(s: State, key: Task): T {
  if (!s.queues[key].length) (s.queues as any)[key] = queueOf(s.cfg[key] as any)
  const card = (s.queues[key] as any[]).shift() as T
  s.used?.add(card.id)
  return card
}

// The player to the left (next seat) who is not in `skip`.
function neighbour(s: State, performer: number, skip: number[] = []): number {
  const i = s.players.indexOf(performer)
  for (let k = 1; k < s.players.length; k++) {
    const p = s.players[(i + k) % s.players.length]
    if (!skip.includes(p)) return p
  }
  return performer
}

function bettors(tk: Turn, s: State): number[] {
  return s.players.filter((p) => p !== tk.performer && p !== tk.partner && (s.judgeBets || p !== tk.judge))
}

// --- bank ------------------------------------------------------------------
// Apply a turn's money flows. `gains` are paid by the bank, `losses` are paid into
// it; `transfers` move between players. With a limited bank, gains are scaled
// down (to whole 10s) when the bank cannot cover them.
function settle(s: State, gains: Record<number, number>, losses: Record<number, number>, transfers: Array<[number, number, number]> = []) {
  const tk = s.turn
  const inflow = Object.values(losses).reduce((a, b) => a + b, 0)
  const demand = Object.values(gains).reduce((a, b) => a + b, 0)
  let scale = 1
  if (s.bankLimited) {
    const available = s.bank + inflow
    if (demand > available) scale = demand ? available / demand : 1
  }
  let paid = 0
  for (const [pid, g] of Object.entries(gains)) {
    const amount = scale === 1 ? g : Math.floor((g * scale) / STEP) * STEP
    paid += amount
    s.money[Number(pid)] += amount
    tk.delta[Number(pid)] = (tk.delta[Number(pid)] ?? 0) + amount
  }
  for (const [pid, l] of Object.entries(losses)) {
    s.money[Number(pid)] = Math.max(0, s.money[Number(pid)] - l)
    tk.delta[Number(pid)] = (tk.delta[Number(pid)] ?? 0) - l
  }
  for (const [from, to, amount] of transfers) {
    s.money[from] = Math.max(0, s.money[from] - amount)
    s.money[to] += amount
    tk.delta[from] = (tk.delta[from] ?? 0) - amount
    tk.delta[to] = (tk.delta[to] ?? 0) + amount
  }
  if (s.bankLimited) s.bank = Math.max(0, s.bank + inflow - paid)
}

// --- turn flow -------------------------------------------------------------
function newTurn(s: State, t: number) {
  const no = s.turn ? s.turn.no + 1 : 0
  s.turn = {
    no,
    performer: s.players[no % s.players.length],
    rolls: [],
    field: 0,
    kind: 'start',
    again: null,
    task: null,
    partner: null,
    judge: null,
    opponent: null,
    stake: 0,
    card: null,
    phrase: null,
    bets: {},
    stage: 'roll',
    deadline: t + ROLL_SECONDS,
    success: null,
    dice: null,
    skipped: false,
    startPay: 0,
    delta: {},
    revealAt: null,
  }
  s.turn.field = s.pos[s.turn.performer]
  s.turn.kind = s.board[s.turn.field].t
}

function setTask(s: State, task: Task, t: number) {
  const tk = s.turn
  tk.task = task
  tk.card = draw(s, task)
  if (task === 'acting') {
    const c = s.board[tk.field].c
    const a = tk.card as Acting
    tk.phrase = `${a.first[c >> 1]} ${a.second[c & 1]}`
  }
  tk.judge = neighbour(s, tk.performer, tk.partner != null ? [tk.partner] : [])
  tk.stage = 'bet'
  tk.deadline = t + s.betSeconds
}

function roll(s: State, t: number) {
  const tk = s.turn
  const d = 1 + Math.floor(Math.random() * 6)
  const L = s.board.length
  const old = s.pos[tk.performer]
  const raw = old + d
  s.pos[tk.performer] = raw % L
  tk.rolls.push(d)
  tk.field = s.pos[tk.performer]
  tk.kind = s.board[tk.field].t
  tk.again = null
  if (raw > L) {
    // passed START
    const before = tk.delta[tk.performer] ?? 0
    settle(s, { [tk.performer]: START_BONUS }, {})
    tk.startPay += (tk.delta[tk.performer] ?? 0) - before
  }
  switch (tk.kind) {
    case 'start':
    case 'arrow':
      tk.again = tk.kind
      tk.stage = 'roll'
      tk.deadline = t + ROLL_SECONDS
      break
    case 'skill':
    case 'mental':
      setTask(s, tk.kind, t)
      break
    case 'acting':
      if (!s.markers[tk.performer].length) {
        tk.skipped = true
        tk.stage = 'revealed'
        tk.revealAt = t
      } else {
        tk.stage = 'choose'
        tk.deadline = t + CHOOSE_SECONDS
      }
      break
    default: // blind, dice
      tk.stage = 'choose'
      tk.deadline = t + CHOOSE_SECONDS
  }
}

function pickPartner(s: State, partner: number, t: number) {
  const tk = s.turn
  tk.partner = partner
  s.markers[tk.performer] = s.markers[tk.performer].filter((p) => p !== partner)
  setTask(s, 'acting', t)
}

function autoChoose(s: State, t: number) {
  const tk = s.turn
  const others = s.players.filter((p) => p !== tk.performer)
  if (tk.kind === 'blind') setTask(s, oneOf<Task>(['skill', 'mental']), t)
  else if (tk.kind === 'acting') pickPartner(s, oneOf(s.markers[tk.performer]), t)
  else if (tk.kind === 'dice') duel(s, t, oneOf(others), Math.max(0, maxBet(s.money[tk.performer])))
}

function lockBets(s: State, t: number) {
  const tk = s.turn
  for (const p of bettors(tk, s)) tk.bets[p] ??= { yes: false, amount: 0 }
  tk.stage = 'ready'
  tk.deadline = t + READY_SECONDS
}

function startAct(s: State, t: number) {
  const tk = s.turn
  tk.stage = 'act'
  tk.deadline = t + (tk.task === 'acting' ? ACTING_SECONDS : (tk.card as Skill | Mental).sec ?? NO_HOURGLASS_SECONDS)
}

function toJudge(s: State, t: number) {
  s.turn.stage = 'judge'
  s.turn.deadline = t + JUDGE_SECONDS
}

// Dice duel: both roll; the performer must roll strictly more (a tie loses).
function duel(s: State, t: number, opponent: number, stake: number) {
  const tk = s.turn
  tk.opponent = opponent
  tk.stake = Math.min(stake, maxBet(s.money[tk.performer]))
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  tk.dice = [a, b]
  tk.success = a > b
  if (tk.success) settle(s, { [tk.performer]: tk.stake }, {})
  else settle(s, {}, {}, [[tk.performer, opponent, tk.stake]])
  tk.stage = 'revealed'
  tk.revealAt = t
}

// Bet tasks: the performer (and the acting partner) get the whole pool from the
// bank; right bets win their stake from the bank, wrong ones lose it to the bank.
function resolve(s: State, t: number, success: boolean) {
  const tk = s.turn
  tk.success = success
  const gains: Record<number, number> = {}
  const losses: Record<number, number> = {}
  const pool = Object.values(tk.bets).reduce((n, b) => n + b.amount, 0)
  if (success) {
    gains[tk.performer] = pool
    if (tk.partner != null) gains[tk.partner] = pool
  }
  for (const [pid, b] of Object.entries(tk.bets)) {
    const p = Number(pid)
    if (!b.amount) continue
    const right = b.yes === success
    if (right) gains[p] = (gains[p] ?? 0) + b.amount
    else losses[p] = (losses[p] ?? 0) + b.amount
    const st = s.stats[p]
    if (right) st.right++
    else st.wrong++
    st.biggest = Math.max(st.biggest, b.amount)
  }
  if (success) {
    s.stats[tk.performer].done++
    if (tk.partner != null) s.stats[tk.partner].done++
  }
  settle(s, gains, losses)
  tk.stage = 'revealed'
  tk.revealAt = t
}

// --- views -----------------------------------------------------------------
type Viewer = 'performer' | 'partner' | 'judge' | 'bettor' | 'tv'

// The task text a viewer may see right now. Never the acting phrase for the
// partner (until the reveal) or the TV, never anything to the performer before bets close.
function taskFor(s: State, v: Viewer): Record<string, any> | null {
  const tk = s.turn
  if (!tk.task || !tk.card) return null
  const reveal = tk.stage === 'revealed'
  const afterBets = tk.stage === 'ready' || tk.stage === 'act' || tk.stage === 'judge' || reveal
  const body = () => {
    if (tk.task === 'skill') return { text: (tk.card as Skill).text, tries: (tk.card as Skill).tries ?? null, sec: (tk.card as Skill).sec }
    if (tk.task === 'mental') return { text: (tk.card as Mental).q, tries: null, sec: (tk.card as Mental).sec }
    return { text: tk.phrase!, tries: null, sec: ACTING_SECONDS }
  }
  if (reveal) return body()
  if (v === 'partner') return null
  if (v === 'performer' || v === 'judge') return afterBets ? body() : null
  if (v === 'tv') return afterBets && tk.task !== 'acting' ? body() : null
  if (tk.stage === 'bet' && tk.kind === 'blind') return null // blind bet: content unknown while betting
  return body()
}

// Sample correct answers: only the judge (after the bets) and everyone after the reveal.
function hintsFor(tk: Turn, show: boolean): string[] | null {
  if (!show || tk.task !== 'mental' || !tk.card) return null
  const hints = (tk.card as Mental).hints
  return hints.length ? hints.slice(0, 14) : null
}

function pawns(s: State, names: Record<number, string>) {
  return s.players.map((p, i) => ({
    id: p,
    name: names[p] ?? '?',
    color: i,
    pos: s.pos[p],
    money: s.money[p],
    markers: s.markers[p].length,
  }))
}

function header(s: State, t: number, names: Record<number, string>) {
  const tk = s.turn
  return {
    game: 'obstaw',
    turnNo: tk.no + 1,
    turnCount: s.turnLimit,
    stage: tk.stage,
    kind: tk.kind,
    kindLabel: FIELD_LABEL[tk.kind],
    combo: tk.kind === 'acting' ? comboLabel(s.board[tk.field].c) : null,
    task: tk.task,
    taskLabel: tk.task ? TASK_LABEL[tk.task] : null,
    rolls: tk.rolls,
    again: tk.again,
    skipped: tk.skipped,
    performer: names[tk.performer] ?? '?',
    partner: tk.partner != null ? names[tk.partner] ?? '?' : null,
    judge: tk.judge != null ? names[tk.judge] ?? '?' : null,
    opponent: tk.opponent != null ? names[tk.opponent] ?? '?' : null,
    bank: s.bankLimited ? s.bank : null,
    judgeBets: s.judgeBets,
    board: { cells: s.board.map((c) => ({ t: c.t, c: c.t === 'acting' ? comboLabel(c.c) : null })), pawns: pawns(s, names), current: tk.field },
    remaining: tk.stage === 'revealed' ? 0 : clock(s, t),
    nextIn: tk.revealAt != null ? Math.max(0, Math.ceil(tk.revealAt + RESULT_SECONDS - t)) : 0,
  }
}

function resultView(s: State, names: Record<number, string>) {
  const tk = s.turn
  return {
    success: tk.success,
    dice: tk.dice,
    stake: tk.stake,
    startPay: tk.startPay,
    pool: Object.values(tk.bets).reduce((n, b) => n + b.amount, 0),
    bets: Object.entries(tk.bets).map(([pid, b]) => ({
      pid: Number(pid),
      name: names[Number(pid)] ?? '?',
      yes: b.yes,
      amount: b.amount,
      right: b.yes === tk.success,
      delta: tk.delta[Number(pid)] ?? 0,
    })),
    deltas: Object.entries(tk.delta).map(([pid, d]) => ({ pid: Number(pid), name: names[Number(pid)] ?? '?', delta: d })),
  }
}

const obstaw: GameModule<State> = {
  id: 'obstaw',
  name: 'Obstaw!',
  minPlayers: MIN_PLAYERS,
  configFile: 'content.json',
  settings: [
    {
      key: 'bank',
      label: 'Bank (na gracza)',
      default: 150,
      options: [
        { value: 100, label: '100' },
        { value: 150, label: '150' },
        { value: 250, label: '250' },
        { value: 0, label: '♾️ bez limitu' },
      ],
    },
    {
      key: 'betSeconds',
      label: 'Czas na obstawianie',
      default: 30,
      options: [20, 30, 45].map((n) => ({ value: n, label: `${n} s` })),
    },
    {
      key: 'judgeBets',
      label: 'Sędzia (gracz po lewej) też obstawia',
      default: 1,
      options: [
        { value: 1, label: 'Tak (jak w oryginale)' },
        { value: 0, label: 'Nie' },
      ],
    },
  ],

  start(playerIds, cfg: Config, opts?: { settings?: Record<string, any>; used?: Set<number>; questionCount?: number }) {
    if (playerIds.length < MIN_PLAYERS) return `Obstaw! potrzebuje co najmniej ${MIN_PLAYERS} graczy.`
    const st = opts?.settings ?? {}
    const players = playerIds.slice(0, MAX_PLAYERS) // the rest watch as spectators
    const used = opts?.used
    const perPlayer = st.bank === undefined ? 150 : Number(st.bank)
    const s: State = {
      players,
      money: Object.fromEntries(players.map((p) => [p, START_MONEY])),
      reported: Object.fromEntries(players.map((p) => [p, 0])),
      pos: Object.fromEntries(players.map((p) => [p, 0])),
      markers: Object.fromEntries(players.map((p) => [p, players.filter((q) => q !== p)])),
      board: makeBoard(players.length),
      bank: perPlayer > 0 ? perPlayer * players.length : 0,
      bankLimited: perPlayer > 0,
      turnLimit: Math.max(0, Math.floor(Number(opts?.questionCount) || 0)),
      judgeBets: Number(st.judgeBets) !== 0,
      turn: undefined as unknown as Turn,
      betSeconds: Number(st.betSeconds) || 30,
      queues: { skill: queueOf(cfg.skill, used), mental: queueOf(cfg.mental, used), acting: queueOf(cfg.acting, used) },
      cfg,
      used,
      stats: Object.fromEntries(players.map((p) => [p, { right: 0, wrong: 0, done: 0, biggest: 0 }])),
    }
    newTurn(s, 0)
    return s
  },

  scoringIds(s) {
    return s.players
  },

  tick(s, t, ctx?: TickContext) {
    const tk = s.turn
    const active = new Set(ctx?.activeIds ?? s.players)
    switch (tk.stage) {
      case 'roll':
        if (t >= tk.deadline || !active.has(tk.performer)) roll(s, t)
        break
      case 'choose':
        if (t >= tk.deadline || !active.has(tk.performer)) autoChoose(s, t)
        break
      case 'bet': {
        const live = bettors(tk, s).filter((p) => active.has(p))
        if (t >= tk.deadline || (live.length > 0 && live.every((p) => tk.bets[p]))) lockBets(s, t)
        break
      }
      case 'ready':
        if (t >= tk.deadline || !active.has(tk.performer)) startAct(s, t)
        break
      case 'act':
        if (t >= tk.deadline) toJudge(s, t)
        break
      case 'judge':
        if (t >= tk.deadline || (tk.judge != null && !active.has(tk.judge))) resolve(s, t, false)
        break
    }
    return s.turn.stage === 'revealed'
  },

  autoAdvanceAt(s) {
    return s.turn.stage === 'revealed' && s.turn.revealAt != null ? s.turn.revealAt + RESULT_SECONDS : null
  },

  // The game ends at the turn limit, when the bank is empty, or when nobody has
  // a partner marker left (the three end conditions of the original).
  next(s) {
    if (s.turnLimit > 0 && s.turn.no + 1 >= s.turnLimit) return false
    if (s.bankLimited && s.bank < STEP) return false
    if (s.players.every((p) => !s.markers[p].length)) return false
    newTurn(s, 0) // hub restarts its clock at 0
    return true
  },

  submit(s, pid, payload, t) {
    const tk = s.turn
    const kind = payload?.kind
    if (!s.players.includes(pid)) return
    if (tk.stage === 'roll' && pid === tk.performer && kind === 'roll' && t <= tk.deadline + GRACE) return roll(s, t)
    if (tk.stage === 'choose' && pid === tk.performer && kind === 'pick' && t <= tk.deadline + GRACE) {
      if (tk.kind === 'blind') {
        if (payload.type === 'skill' || payload.type === 'mental') setTask(s, payload.type, t)
      } else if (tk.kind === 'acting') {
        const partner = Number(payload.partner)
        if (s.markers[pid].includes(partner)) pickPartner(s, partner, t)
      } else if (tk.kind === 'dice') {
        const opponent = Number(payload.opponent)
        const stake = Number(payload.stake)
        if (opponent === pid || !s.players.includes(opponent)) return
        if (!Number.isInteger(stake) || stake < STEP || stake > maxBet(s.money[pid])) return
        duel(s, t, opponent, stake)
      }
      return
    }
    if (tk.stage === 'bet' && kind === 'bet' && t <= tk.deadline + GRACE) {
      if (!bettors(tk, s).includes(pid)) return
      const amount = Number(payload.amount)
      if (typeof payload.yes !== 'boolean' || !Number.isInteger(amount) || amount < 0 || amount % STEP) return
      if (amount > maxBet(s.money[pid])) return
      tk.bets[pid] = { yes: payload.yes, amount }
      return
    }
    if (tk.stage === 'ready' && pid === tk.performer && kind === 'start') return startAct(s, t)
    if (tk.stage === 'act' && pid === tk.performer && kind === 'done') return toJudge(s, t)
    if (tk.stage === 'judge' && pid === tk.judge && kind === 'ruling' && typeof payload.ok === 'boolean') resolve(s, t, payload.ok)
  },

  // Money delta since the last report → the hub leaderboard always equals the money.
  score(s) {
    const out: Record<number, number> = {}
    for (const p of s.players) {
      const d = s.money[p] - s.reported[p]
      if (d) out[p] = d
      s.reported[p] = s.money[p]
    }
    return out
  },

  awards(s) {
    const top = (f: (p: number) => number): [number, number] | null => {
      let best: [number, number] | null = null
      for (const p of s.players) if (f(p) > 0 && (!best || f(p) > best[1])) best = [p, f(p)]
      return best
    }
    const out: GameAward[] = []
    const tip = top((p) => s.stats[p].right)
    if (tip) out.push({ title: '🔮 Najlepszy typer', pid: tip[0], detail: `${tip[1]} trafnych zakładów` })
    const star = top((p) => s.stats[p].done)
    if (star) out.push({ title: '🌟 Mistrz występów', pid: star[0], detail: `${star[1]} udanych zadań` })
    const gambler = top((p) => s.stats[p].biggest)
    if (gambler) out.push({ title: '🎰 Hazardzista', pid: gambler[0], detail: `największy zakład: ${gambler[1]}` })
    return out
  },

  // TV view: bets and the acting phrase never appear before the reveal.
  publicView(s, t, names) {
    const tk = s.turn
    const base = header(s, t, names)
    if (tk.stage === 'revealed') {
      return { phase: 'revealed', ...base, content: tk.card ? taskFor(s, 'tv') : null, hints: hintsFor(tk, true), result: resultView(s, names) }
    }
    const bt = bettors(tk, s)
    return {
      phase: 'playing',
      ...base,
      content: taskFor(s, 'tv'),
      bettorsIn: bt.filter((p) => tk.bets[p]).length,
      bettorsTotal: bt.length,
    }
  },

  stateForPlayer(s, pid, t, names): PlayerView {
    const tk = s.turn
    const nm = names ?? {}
    const isPlayer = s.players.includes(pid)
    const canBet = bettors(tk, s).includes(pid)
    const role = !isPlayer
      ? 'audience'
      : pid === tk.performer
        ? 'performer'
        : pid === tk.partner
          ? 'partner'
          : pid === tk.opponent
            ? 'opponent'
            : pid === tk.judge
              ? 'judge'
              : 'bettor'
    const viewer: Viewer = role === 'performer' ? 'performer' : role === 'partner' ? 'partner' : role === 'judge' && !(tk.stage === 'bet' && canBet) ? 'judge' : 'bettor'
    const afterBets = tk.stage !== 'roll' && tk.stage !== 'choose' && tk.stage !== 'bet'
    const base = {
      ...header(s, t, nm),
      leaderboard: [] as any,
      role,
      canBet,
      money: isPlayer ? s.money[pid] : null,
      myMax: isPlayer ? maxBet(s.money[pid]) : 0,
      myMarkers: isPlayer ? s.markers[pid].length : 0,
      content: taskFor(s, viewer),
      hints: hintsFor(tk, tk.stage === 'revealed' || (pid === tk.judge && afterBets)),
    }
    if (tk.stage === 'revealed') {
      return { phase: 'revealed', ...base, result: resultView(s, nm), myDelta: tk.delta[pid] ?? 0 }
    }
    const extra: Record<string, any> = {}
    if (tk.stage === 'choose') {
      extra.options =
        tk.kind === 'acting'
          ? s.markers[pid].map((p) => ({ id: p, name: nm[p] ?? '?' }))
          : s.players.filter((p) => p !== pid).map((p) => ({ id: p, name: nm[p] ?? '?' }))
    }
    if (tk.stage === 'bet') {
      const bt = bettors(tk, s)
      extra.myBet = tk.bets[pid] ?? null
      extra.bettorsIn = bt.filter((p) => tk.bets[p]).length
      extra.bettorsTotal = bt.length
    }
    return { phase: 'playing', ...base, ...extra }
  },
}

export default obstaw
