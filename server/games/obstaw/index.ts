import type { GameAward, GameModule, PlayerView, TickContext } from '../types'
import { cleanAnswer, sameKey } from '../riposta/normalize.ts'

// Obstaw! — an original Polish betting party game. Each turn one player attempts
// a challenge (a dexterity stunt, a quiz question, acting a phrase for a partner,
// or a dice duel) while everybody else bets, secretly, YES or NO with part of
// their money. Money comes from a bank; the richest player after the last turn wins.
//
// Hub mapping: one hub "question" = one turn. The hub clock restarts at 0 for
// every turn, so all deadlines here are stored as absolute `t` values of the
// current turn. `score()` returns the money delta since the last report, so the
// hub leaderboard always equals the players' money.
//
// Betting rules inspired by classic "bet on your friends" board games; the
// content (cards) is original — see content.json.

type Kind = 'skill' | 'mental' | 'acting' | 'blind' | 'dice'
type Task = 'skill' | 'mental' | 'acting'
type Stage = 'choose' | 'bet' | 'ready' | 'act' | 'judge' | 'revealed'

interface Skill { id: number; sec: number; text: string }
interface Mental { id: number; sec: number; need: number; q: string; valid: string[] }
interface Acting { id: number; first: [string, string]; second: [string, string] }
interface Config { skill: Skill[]; mental: Mental[]; acting: Acting[] }

interface Bet { yes: boolean; amount: number }
interface Turn {
  no: number
  kind: Kind
  task: Task | null // what is actually played (blind: chosen by the performer)
  performer: number
  partner: number | null // acting only: guesses the phrase
  judge: number | null // skill + acting: rules whether it worked; does not bet
  opponent: number | null // dice only
  stake: number // dice only
  card: Skill | Mental | Acting | null
  phrase: string | null
  bets: Record<number, Bet>
  found: string[] // mental: distinct valid answers so far (comparison keys)
  stage: Stage
  deadline: number // t at which the current stage times out
  success: boolean | null
  dice: [number, number] | null
  delta: Record<number, number> // money change caused by this turn's result
  revealAt: number | null
}
interface State {
  players: number[]
  money: Record<number, number>
  reported: Record<number, number> // what the hub leaderboard already holds
  turn: Turn
  total: number // turns in the whole game
  betSeconds: number
  queues: { skill: Skill[]; mental: Mental[]; acting: Acting[] }
  cfg: Config
  used: Set<number> | undefined
  stats: Record<number, { right: number; wrong: number; done: number; biggest: number }>
}

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 10
export const START_MONEY = 80
export const MIN_MONEY = 20 // anyone below this gets topped up by the bank at the start of a turn
const STEP = 10
const GRACE = 1.5
const CHOOSE_SECONDS = 25
const READY_SECONDS = 25
const JUDGE_SECONDS = 40
const ACTING_SECONDS = 90
const RESULT_SECONDS = 12

const KIND_WEIGHTS: Array<[Kind, number]> = [['skill', 0.3], ['mental', 0.25], ['acting', 0.25], ['blind', 0.1], ['dice', 0.1]]
const KIND_LABEL: Record<Kind, string> = {
  skill: '🤹 Zadanie zręcznościowe',
  mental: '🧠 Zadanie umysłowe',
  acting: '🎭 Zadanie aktorskie',
  blind: '🎲 Zakład w ciemno',
  dice: '🎰 Kości zostały rzucone',
}
const TASK_LABEL: Record<Task, string> = { skill: 'zręcznościowe', mental: 'umysłowe', acting: 'aktorskie' }

// Largest allowed bet: at most half of the money, in steps of 10.
export const maxBet = (money: number) => Math.max(0, Math.floor(money / 2 / STEP) * STEP)

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

// Unused cards first, then the rest, each shuffled.
function queueOf<T extends { id: number }>(pool: T[], used?: Set<number>): T[] {
  return [...shuffle(pool.filter((c) => !used?.has(c.id))), ...shuffle(pool.filter((c) => used?.has(c.id)))]
}
function draw<T extends { id: number }>(s: State, key: Task): T {
  const q = s.queues[key] as unknown as T[]
  if (!q.length) (s.queues as any)[key] = queueOf(s.cfg[key] as unknown as T[])
  const card = (s.queues[key] as unknown as T[]).shift()!
  s.used?.add(card.id)
  return card
}

function pickKind(): Kind {
  let r = Math.random()
  for (const [k, w] of KIND_WEIGHTS) if ((r -= w) < 0) return k
  return 'skill'
}

// Next player after `performer` in seating order who is not in `skip`.
function neighbour(s: State, performer: number, skip: number[] = []): number {
  const i = s.players.indexOf(performer)
  for (let k = 1; k < s.players.length; k++) {
    const p = s.players[(i + k) % s.players.length]
    if (!skip.includes(p)) return p
  }
  return performer
}

function bettors(tk: Turn, s: State): number[] {
  return s.players.filter((p) => p !== tk.performer && p !== tk.partner && p !== tk.judge)
}

function actingPhrase(c: Acting): string {
  return `${oneOf(c.first)} ${oneOf(c.second)}`
}

// Fix what is played this turn. Called when it becomes known (immediately, or
// after the performer's choice for acting / blind).
function setTask(s: State, task: Task, t: number) {
  const tk = s.turn
  tk.task = task
  tk.card = draw(s, task)
  if (task === 'acting') tk.phrase = actingPhrase(tk.card as Acting)
  if (task !== 'mental') tk.judge = neighbour(s, tk.performer, tk.partner != null ? [tk.partner] : [])
  tk.stage = 'bet'
  tk.deadline = t + s.betSeconds
}

function newTurn(s: State, t: number) {
  for (const p of s.players) if (s.money[p] < MIN_MONEY) s.money[p] = MIN_MONEY // bank top-up
  const kind = pickKind()
  const tk: Turn = {
    no: s.turn ? s.turn.no + 1 : 0,
    kind,
    task: null,
    performer: s.players[(s.turn ? s.turn.no + 1 : 0) % s.players.length],
    partner: null,
    judge: null,
    opponent: null,
    stake: 0,
    card: null,
    phrase: null,
    bets: {},
    found: [],
    stage: 'choose',
    deadline: t + CHOOSE_SECONDS,
    success: null,
    dice: null,
    delta: {},
    revealAt: null,
  }
  s.turn = tk
  if (kind === 'skill' || kind === 'mental') setTask(s, kind, t)
}

// --- stages ----------------------------------------------------------------
function autoChoose(s: State, t: number) {
  const tk = s.turn
  const others = s.players.filter((p) => p !== tk.performer)
  if (tk.kind === 'blind') setTask(s, oneOf<Task>(['skill', 'mental']), t)
  else if (tk.kind === 'acting') {
    tk.partner = oneOf(others)
    setTask(s, 'acting', t)
  } else if (tk.kind === 'dice') rollDice(s, t, oneOf(others), Math.max(STEP, maxBet(s.money[tk.performer])))
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
  tk.deadline = t + (tk.task === 'acting' ? ACTING_SECONDS : (tk.card as Skill | Mental).sec)
}

function toJudge(s: State, t: number) {
  s.turn.stage = 'judge'
  s.turn.deadline = t + JUDGE_SECONDS
}

function rollDice(s: State, t: number, opponent: number, stake: number) {
  const tk = s.turn
  tk.opponent = opponent
  tk.stake = Math.min(stake, maxBet(s.money[tk.performer]))
  let a = 0
  let b = 0
  while (a === b) {
    a = 1 + Math.floor(Math.random() * 6) // ties are re-rolled
    b = 1 + Math.floor(Math.random() * 6)
  }
  tk.dice = [a, b]
  const win = a > b
  tk.success = win
  tk.delta = { [tk.performer]: win ? tk.stake : -tk.stake }
  if (!win) tk.delta[opponent] = tk.stake
  settleMoney(s, t)
}

// Turn result for the betting tasks: performer (and the acting partner) take the
// whole pool from the bank; right bets win their stake from the bank, wrong ones lose it.
function resolve(s: State, t: number, success: boolean) {
  const tk = s.turn
  tk.success = success
  const delta: Record<number, number> = {}
  const pool = Object.values(tk.bets).reduce((n, b) => n + b.amount, 0)
  if (success) {
    delta[tk.performer] = pool
    if (tk.partner != null) delta[tk.partner] = pool
  }
  for (const [pid, b] of Object.entries(tk.bets)) {
    const p = Number(pid)
    const right = b.yes === success
    if (b.amount) delta[p] = (delta[p] ?? 0) + (right ? b.amount : -b.amount)
    const st = s.stats[p]
    if (b.amount && st) {
      if (right) st.right++
      else st.wrong++
      st.biggest = Math.max(st.biggest, b.amount)
    }
  }
  if (success) {
    s.stats[tk.performer].done++
    if (tk.partner != null) s.stats[tk.partner].done++
  }
  tk.delta = delta
  settleMoney(s, t)
}

function settleMoney(s: State, t: number) {
  const tk = s.turn
  for (const [pid, d] of Object.entries(tk.delta)) s.money[Number(pid)] = Math.max(0, s.money[Number(pid)] + d)
  tk.stage = 'revealed'
  tk.revealAt = t
}

// --- views -----------------------------------------------------------------
type Role = 'performer' | 'partner' | 'judge' | 'opponent' | 'bettor' | 'audience'
function roleOf(s: State, pid: number): Role {
  const tk = s.turn
  if (!s.players.includes(pid)) return 'audience'
  if (pid === tk.performer) return 'performer'
  if (pid === tk.partner) return 'partner'
  if (pid === tk.judge) return 'judge'
  if (pid === tk.opponent) return 'opponent'
  return 'bettor'
}

// The task text a given viewer may see right now. Never the acting phrase for the
// partner (until the reveal), never anything to the performer before bets close.
function taskFor(s: State, role: Role | 'tv'): Record<string, any> | null {
  const tk = s.turn
  if (!tk.task || !tk.card) return null
  const reveal = tk.stage === 'revealed'
  const afterBets = tk.stage === 'ready' || tk.stage === 'act' || tk.stage === 'judge' || reveal
  const body = () => {
    if (tk.task === 'skill') return { text: (tk.card as Skill).text, sec: (tk.card as Skill).sec }
    if (tk.task === 'mental') return { text: (tk.card as Mental).q, need: (tk.card as Mental).need, sec: (tk.card as Mental).sec }
    return { text: tk.phrase!, sec: ACTING_SECONDS }
  }
  if (reveal) return body()
  if (role === 'performer') return afterBets ? body() : null
  if (role === 'partner') return null
  if (role === 'judge') return afterBets ? body() : null
  if (role === 'tv') {
    // The TV must not show the phrase (the partner may be looking at it), nor the task before bets close.
    if (!afterBets || tk.task === 'acting') return null
    return body()
  }
  // bettors / audience: see it while betting, except in a blind bet
  if (tk.stage === 'bet' && tk.kind === 'blind') return null
  return body()
}

function header(s: State, t: number, names: Record<number, string>) {
  const tk = s.turn
  return {
    game: 'obstaw',
    turnNo: tk.no + 1,
    turnCount: s.total,
    stage: tk.stage,
    kind: tk.kind,
    kindLabel: KIND_LABEL[tk.kind],
    task: tk.task,
    taskLabel: tk.task ? TASK_LABEL[tk.task] : null,
    performer: names[tk.performer] ?? '?',
    partner: tk.partner != null ? names[tk.partner] ?? '?' : null,
    judge: tk.judge != null ? names[tk.judge] ?? '?' : null,
    opponent: tk.opponent != null ? names[tk.opponent] ?? '?' : null,
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
    pool: Object.values(tk.bets).reduce((n, b) => n + b.amount, 0),
    answers: tk.task === 'mental' ? (tk.card as Mental).valid.slice(0, 6) : null,
    found: tk.found.length,
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
      key: 'rounds',
      label: 'Liczba kolejek (tur na gracza)',
      default: 3,
      options: [2, 3, 4].map((n) => ({ value: n, label: `${n}` })),
    },
    {
      key: 'betSeconds',
      label: 'Czas na obstawianie',
      default: 30,
      options: [20, 30, 45].map((n) => ({ value: n, label: `${n} s` })),
    },
  ],

  start(playerIds, cfg: Config, opts?: { settings?: Record<string, any>; used?: Set<number> }) {
    if (playerIds.length < MIN_PLAYERS) return `Obstaw! potrzebuje co najmniej ${MIN_PLAYERS} graczy.`
    const st = opts?.settings ?? {}
    const players = playerIds.slice(0, MAX_PLAYERS)
    const rounds = [2, 3, 4].includes(Number(st.rounds)) ? Number(st.rounds) : 3
    const used = opts?.used
    const s: State = {
      players,
      money: Object.fromEntries(players.map((p) => [p, START_MONEY])),
      reported: Object.fromEntries(players.map((p) => [p, 0])),
      turn: undefined as unknown as Turn,
      total: players.length * rounds,
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
        if (t >= tk.deadline) {
          if (tk.task === 'mental') resolve(s, t, false)
          else toJudge(s, t)
        }
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

  next(s) {
    if (s.turn.no + 1 >= s.total) return false
    newTurn(s, 0) // hub restarts its clock at 0
    return true
  },

  submit(s, pid, payload, t) {
    const tk = s.turn
    const kind = payload?.kind
    if (!s.players.includes(pid)) return
    if (tk.stage === 'choose' && pid === tk.performer && kind === 'pick' && t <= tk.deadline + GRACE) {
      if (tk.kind === 'blind') {
        if (payload.type === 'skill' || payload.type === 'mental') setTask(s, payload.type, t)
      } else if (tk.kind === 'acting') {
        const partner = Number(payload.partner)
        if (partner !== pid && s.players.includes(partner)) {
          tk.partner = partner
          setTask(s, 'acting', t)
        }
      } else if (tk.kind === 'dice') {
        const opponent = Number(payload.opponent)
        const stake = Number(payload.stake)
        if (opponent === pid || !s.players.includes(opponent)) return
        if (!Number.isInteger(stake) || stake < STEP || stake > maxBet(s.money[pid])) return
        rollDice(s, t, opponent, stake)
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
    if (tk.stage === 'act' && pid === tk.performer) {
      if (kind === 'answer' && tk.task === 'mental' && t <= tk.deadline + GRACE) {
        const text = cleanAnswer(payload.text)
        const key = sameKey(text)
        const card = tk.card as Mental
        if (!key || tk.found.includes(key)) return
        if (card.valid.some((v) => sameKey(v) === key)) {
          tk.found.push(key)
          if (tk.found.length >= card.need) resolve(s, t, true)
        }
      } else if (kind === 'done' && tk.task !== 'mental') toJudge(s, t)
      return
    }
    if (tk.stage === 'judge' && pid === tk.judge && kind === 'ruling' && typeof payload.ok === 'boolean') {
      resolve(s, t, payload.ok)
    }
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
    const common = { ...base, money: s.players.map((p) => ({ name: names[p] ?? '?', money: s.money[p] })) }
    if (tk.stage === 'revealed') {
      return {
        phase: 'revealed',
        ...common,
        task: tk.task,
        content: tk.card ? bodyOf(tk) : null,
        result: resultView(s, names),
      }
    }
    const bt = bettors(tk, s)
    return {
      phase: 'playing',
      ...common,
      content: taskFor(s, 'tv'),
      bettorsIn: bt.filter((p) => tk.bets[p]).length,
      bettorsTotal: bt.length,
      found: tk.found.length,
    }
  },

  stateForPlayer(s, pid, t, names): PlayerView {
    const tk = s.turn
    const role = roleOf(s, pid)
    const nm = names ?? {}
    const base = {
      ...header(s, t, nm),
      leaderboard: [] as any,
      role,
      money: s.players.includes(pid) ? s.money[pid] : null,
      myMax: s.players.includes(pid) ? maxBet(s.money[pid]) : 0,
      content: taskFor(s, role),
    }
    if (tk.stage === 'revealed') {
      return { phase: 'revealed', ...base, result: resultView(s, nm), myDelta: tk.delta[pid] ?? 0 }
    }
    const bt = bettors(tk, s)
    const extra: Record<string, any> = {}
    if (tk.stage === 'choose') {
      extra.options = s.players.filter((p) => p !== pid).map((p) => ({ id: p, name: nm[p] ?? '?' }))
    }
    if (tk.stage === 'bet') {
      extra.myBet = tk.bets[pid] ?? null
      extra.bettorsIn = bt.filter((p) => tk.bets[p]).length
      extra.bettorsTotal = bt.length
    }
    if (tk.task === 'mental') extra.found = tk.found.length
    if (tk.stage === 'act' || tk.stage === 'ready') extra.actEnds = tk.deadline
    return { phase: 'playing', ...base, ...extra }
  },
}

function bodyOf(tk: Turn) {
  if (tk.task === 'skill') return { text: (tk.card as Skill).text, sec: (tk.card as Skill).sec }
  if (tk.task === 'mental') return { text: (tk.card as Mental).q, need: (tk.card as Mental).need, sec: (tk.card as Mental).sec }
  return { text: tk.phrase!, sec: ACTING_SECONDS }
}

export default obstaw
