import type { GameAward, GameModule, PlayerView, TickContext } from '../types'
import { assignPairs, pairSet, shuffle } from './assign.ts'
import { cleanAnswer, MAX_ANSWER, sameKey } from './normalize.ts'
import { FINAL_TOKENS, scoreDuel, scoreFinal, type DuelResult } from './scoring.ts'

// Riposta — an original Polish answer-duel party game (write a funny answer to a
// prompt, two players per prompt, everyone else votes; round 2 doubles points;
// a final round where everyone answers one prompt and spreads 3 tokens).
//
// Hub mapping: one hub "question" = one duel. The writing stage is an internal
// stage of the FIRST duel of each round; the final is one more "question" with
// its own write + vote stages. next() returns false after the final → podium.

export type Tier = 'family' | 'adult' | '18+'
interface Prompt {
  id: number
  text: string
  tier: Tier
}
interface Config {
  prompts: Prompt[]
  finalPrompts: Prompt[]
  safetyQuips: Prompt[]
}
interface Answer {
  text: string
  safety: boolean // came from the "Gotowiec" button or was auto-filled on timeout
}
interface Duel {
  id: string // opaque — never derived from player ids
  promptId: number
  prompt: string
  authors: [number, number] // random order = the A/B order everyone sees
  answers: Record<number, Answer>
  drafts: Record<number, string> // unsent text, used instead of a Gotowiec on timeout
  votes: Record<number, 0 | 1> // voter pid → choice (players and audience alike)
  flaggedBy: number[]
  result: DuelResult | null // frozen at reveal
}
interface FinalResult {
  points: Record<number, number>
  best: number[]
  playerTokens: Record<number, number>
  audienceTokens: Record<number, number>
  jinx: number[]
}
interface Final {
  id: string
  promptId: number
  prompt: string
  order: number[] // author pids in display order (random)
  entryId: Record<number, string> // author pid → opaque entry id
  answers: Record<number, Answer>
  drafts: Record<number, string>
  tokens: Record<number, Record<number, number>> // voter pid → author pid → tokens
  flaggedBy: number[]
  result: FinalResult | null
}
interface State {
  players: number[] // scoring players, fixed at start (late joiners are audience)
  tier: Tier
  writeSeconds: number
  voteSeconds: number
  round: 1 | 2 | 3 // 3 = final
  rounds: Duel[][] // every duel played so far, per round (kept for awards)
  dIdx: number // current duel within the current round
  final: Final | null
  stage: 'write' | 'vote' | 'revealed'
  voteAt: number | null // elapsed(s) when voting opened
  revealAt: number | null
  queue: Prompt[] // prompts reserved for rounds 1 and 2
  finalPrompt: Prompt
  quips: string[] // Gotowiec texts allowed at this tier
  safetyRound: Record<number, number> // pid → round in which they used their Gotowiec
  r1Pairs: Set<string>
}

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 8
const GRACE = 1.5 // seconds of network slack after a deadline
const RESULT_SECONDS = 8 // duel result screen before auto-advance
const FINAL_RESULT_SECONDS = 15

const TIER_MIX: Record<Tier, Array<[Tier, number]>> = {
  family: [['family', 1]],
  adult: [['adult', 0.6], ['family', 0.4]],
  '18+': [['18+', 0.5], ['adult', 0.3], ['family', 0.2]],
}
const TIER_LABEL: Record<Tier, string> = { family: 'Rodzinny', adult: 'Dla dorosłych', '18+': '18+' }

const oid = () => Math.random().toString(36).slice(2, 10)

// Draw `count` prompts mixed by tier weights; within a tier, unused prompts come
// first (shuffled), then already-played ones, so repeats only happen when dry.
export function pickPrompts(pool: Prompt[], tier: Tier, count: number, used?: Set<number>, rng = Math.random): Prompt[] {
  const mix = TIER_MIX[tier]
  const queues = new Map<Tier, Prompt[]>(
    mix.map(([t]) => {
      const all = pool.filter((p) => p.tier === t)
      return [t, [...shuffle(all.filter((p) => !used?.has(p.id)), rng), ...shuffle(all.filter((p) => used?.has(p.id)), rng)]]
    }),
  )
  const out: Prompt[] = []
  while (out.length < count) {
    const open = mix.filter(([t]) => queues.get(t)!.length)
    if (!open.length) break
    let r = rng() * open.reduce((a, [, w]) => a + w, 0)
    let pick = open[open.length - 1][0]
    for (const [t, w] of open) {
      if ((r -= w) < 0) {
        pick = t
        break
      }
    }
    out.push(queues.get(pick)!.shift()!)
  }
  return out
}

function writeDuration(s: State) {
  return s.round === 3 ? Math.min(75, s.writeSeconds) : s.writeSeconds
}
function voteDuration(s: State) {
  return s.round === 3 ? Math.max(30, s.voteSeconds * 2) : s.voteSeconds
}
function multiplier(s: State) {
  return s.round === 2 ? 2 : 1
}
function duels(s: State): Duel[] {
  return s.rounds[s.round - 1] ?? []
}
function current(s: State): Duel | null {
  return s.round <= 2 ? duels(s)[s.dIdx] ?? null : null
}
function myDuels(s: State, pid: number): Duel[] {
  return duels(s).filter((d) => d.authors.includes(pid))
}
function doneWriting(s: State, pid: number): boolean {
  if (s.round === 3) return !!s.final?.answers[pid]
  return myDuels(s, pid).every((d) => d.answers[pid])
}
function eligibleVoters(s: State): number[] {
  const d = current(s)
  return d ? s.players.filter((p) => !d.authors.includes(p)) : [...s.players]
}
function hasVoted(s: State, pid: number): boolean {
  const d = current(s)
  return d ? d.votes[pid] != null : !!s.final?.tokens[pid]
}

// A Gotowiec text not identical to anything already answered on this prompt.
function pickQuip(s: State, taken: string[]): string {
  const keys = new Set(taken.map(sameKey))
  const free = s.quips.filter((q) => !keys.has(sameKey(q)))
  const list = free.length ? free : s.quips
  return list[Math.floor(Math.random() * list.length)] ?? '…'
}

function newRound(s: State, round: 1 | 2) {
  const pairs = assignPairs(s.players, round === 2 ? s.r1Pairs : new Set())
  if (round === 1) s.r1Pairs = pairSet(pairs)
  const prompts = s.queue.splice(0, pairs.length)
  s.rounds[round - 1] = pairs.map((pair, i) => ({
    id: oid(),
    promptId: prompts[i]?.id ?? -1,
    prompt: prompts[i]?.text ?? '…',
    authors: shuffle(pair) as [number, number],
    answers: {},
    drafts: {},
    votes: {},
    flaggedBy: [],
    result: null,
  }))
  s.round = round
  s.dIdx = 0
  s.stage = 'write'
  s.voteAt = null
  s.revealAt = null
}

function newFinal(s: State) {
  const order = shuffle(s.players)
  s.final = {
    id: oid(),
    promptId: s.finalPrompt.id,
    prompt: s.finalPrompt.text,
    order,
    entryId: Object.fromEntries(order.map((p) => [p, oid()])),
    answers: {},
    drafts: {},
    tokens: {},
    flaggedBy: [],
    result: null,
  }
  s.round = 3
  s.stage = 'write'
  s.voteAt = null
  s.revealAt = null
}

// Writing is over (timer, everyone done, or GM skipped): every missing answer
// becomes the player's unsent draft, or else a Gotowiec. Always yields answers.
function fillAnswers(s: State) {
  if (s.round === 3) {
    const f = s.final!
    for (const p of s.players) {
      if (f.answers[p]) continue
      const draft = cleanAnswer(f.drafts[p])
      f.answers[p] = draft ? { text: draft, safety: false } : { text: pickQuip(s, Object.values(f.answers).map((a) => a.text)), safety: true }
    }
    return
  }
  for (const d of duels(s)) {
    for (const p of d.authors) {
      if (d.answers[p]) continue
      const draft = cleanAnswer(d.drafts[p])
      d.answers[p] = draft ? { text: draft, safety: false } : { text: pickQuip(s, Object.values(d.answers).map((a) => a.text)), safety: true }
    }
  }
}

function duelJinx(d: Duel): boolean {
  const [a, b] = d.authors.map((p) => d.answers[p])
  if (!a || !b) return false
  const k = sameKey(a.text)
  return k !== '' && k === sameKey(b.text)
}
function finalJinx(f: Final): number[] {
  const groups = new Map<string, number[]>()
  for (const p of f.order) {
    const k = f.answers[p] ? sameKey(f.answers[p].text) : ''
    if (k) groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.values()].filter((g) => g.length > 1).flat()
}

function computeDuel(s: State, d: Duel): DuelResult {
  const pv: [number, number] = [0, 0]
  const av: [number, number] = [0, 0]
  for (const [k, c] of Object.entries(d.votes)) (s.players.includes(Number(k)) ? pv : av)[c]++
  return scoreDuel({
    playerVotes: pv,
    audienceVotes: av,
    safety: d.authors.map((p) => !!d.answers[p]?.safety) as [boolean, boolean],
    jinx: duelJinx(d),
    multiplier: s.rounds[1]?.includes(d) ? 2 : 1,
  })
}
function computeFinal(s: State, f: Final): FinalResult {
  const jinx = finalJinx(f)
  const playerTokens: Record<number, number> = {}
  const audienceTokens: Record<number, number> = {}
  let playerVoters = 0
  let audienceVoters = 0
  for (const [k, alloc] of Object.entries(f.tokens)) {
    const isPlayer = s.players.includes(Number(k))
    isPlayer ? playerVoters++ : audienceVoters++
    for (const [a, n] of Object.entries(alloc)) {
      const bucket = isPlayer ? playerTokens : audienceTokens
      bucket[Number(a)] = (bucket[Number(a)] ?? 0) + n
    }
  }
  const { points, best } = scoreFinal(
    f.order.map((p) => ({
      pid: p,
      playerTokens: playerTokens[p] ?? 0,
      audienceTokens: audienceTokens[p] ?? 0,
      safety: !!f.answers[p]?.safety,
      jinx: jinx.includes(p),
    })),
    s.players.length,
    playerVoters,
    audienceVoters,
  )
  return { points, best, playerTokens, audienceTokens, jinx }
}

// Points for the current duel / the final (pure; frozen once revealed).
function currentPoints(s: State): Record<number, number> {
  if (s.stage === 'write') return {}
  const d = current(s)
  if (d) {
    const r = d.result ?? computeDuel(s, d)
    return { [d.authors[0]]: r.points[0], [d.authors[1]]: r.points[1] }
  }
  return s.final ? { ...(s.final.result ?? computeFinal(s, s.final)).points } : {}
}

function reveal(s: State, t: number) {
  if (s.stage === 'revealed') return
  const d = current(s)
  if (d) d.result = computeDuel(s, d)
  else if (s.final) s.final.result = computeFinal(s, s.final)
  s.stage = 'revealed'
  s.revealAt = t
}
function openVote(s: State, t: number) {
  s.stage = 'vote'
  s.voteAt = t
  s.revealAt = null
  const d = current(s)
  if (d && duelJinx(d)) reveal(s, t) // identical answers: nothing to vote on
}

// --- views -----------------------------------------------------------------
function duelReveal(s: State, d: Duel, names: Record<number, string> = {}) {
  const r = d.result ?? computeDuel(s, d)
  const jinx = duelJinx(d)
  return {
    prompt: d.prompt,
    jinx,
    sweep: r.sweep,
    answers: d.authors.map((p, i) => {
      const voters = Object.entries(d.votes).filter(([, c]) => c === i).map(([k]) => Number(k))
      return {
        pid: p,
        name: names[p] ?? '?',
        text: d.answers[p]?.text ?? '',
        safety: !!d.answers[p]?.safety,
        voters: voters.filter((v) => s.players.includes(v)).map((v) => names[v] ?? '?'),
        audience: voters.filter((v) => !s.players.includes(v)).length,
        share: Math.round(r.share[i] * 100),
        points: r.points[i],
        winner: r.winner === i,
      }
    }),
  }
}
function finalReveal(s: State, f: Final, names: Record<number, string> = {}) {
  const r = f.result ?? computeFinal(s, f)
  return {
    prompt: f.prompt,
    entries: f.order
      .map((p) => ({
        pid: p,
        name: names[p] ?? '?',
        text: f.answers[p]?.text ?? '',
        safety: !!f.answers[p]?.safety,
        jinx: r.jinx.includes(p),
        tokens: r.playerTokens[p] ?? 0,
        audience: r.audienceTokens[p] ?? 0,
        points: r.points[p] ?? 0,
        best: r.best.includes(p),
      }))
      .sort((a, b) => b.points - a.points),
  }
}
function remainingOf(s: State, t: number): number {
  if (s.stage === 'write') return Math.max(0, Math.ceil(writeDuration(s) - t))
  if (s.stage === 'vote') return Math.max(0, Math.ceil((s.voteAt ?? 0) + voteDuration(s) - t))
  return 0
}
function header(s: State, t: number) {
  const ds = duels(s)
  return {
    game: 'riposta',
    round: s.round,
    multiplier: multiplier(s),
    kind: s.round === 3 ? 'final' : 'duel',
    stage: s.stage,
    matchNo: s.round === 3 ? 1 : s.dIdx + 1,
    matchCount: s.round === 3 ? 1 : ds.length,
    remaining: remainingOf(s, t),
    tier: TIER_LABEL[s.tier],
    maxAnswer: MAX_ANSWER,
    written: s.players.filter((p) => doneWriting(s, p)).length,
    total: s.players.length,
    voted: eligibleVoters(s).filter((p) => hasVoted(s, p)).length,
    eligible: eligibleVoters(s).length,
    nextIn: s.stage === 'revealed' && s.revealAt != null ? Math.max(0, Math.ceil(s.revealAt + resultSeconds(s) - t)) : 0,
  }
}
function resultSeconds(s: State) {
  return s.round === 3 ? FINAL_RESULT_SECONDS : RESULT_SECONDS
}

const riposta: GameModule<State> = {
  id: 'riposta',
  name: 'Riposta',
  minPlayers: MIN_PLAYERS,
  configFile: 'prompts.json',
  settings: [
    {
      key: 'tier',
      label: 'Poziom humoru',
      default: 'family',
      options: [
        { value: 'family', label: '👪 Rodzinny' },
        { value: 'adult', label: '🍷 Dla dorosłych' },
        { value: '18+', label: '🔥 18+' },
      ],
    },
    {
      key: 'writeSeconds',
      label: 'Czas na pisanie',
      default: 90,
      options: [60, 90, 120, 180].map((n) => ({ value: n, label: `${n} s` })),
    },
    {
      key: 'voteSeconds',
      label: 'Czas na głosowanie',
      default: 20,
      options: [15, 20, 30].map((n) => ({ value: n, label: `${n} s` })),
    },
  ],

  start(playerIds, cfg: Config, opts?: { settings?: Record<string, any>; used?: Set<number> }) {
    if (playerIds.length < MIN_PLAYERS) return `Riposta potrzebuje co najmniej ${MIN_PLAYERS} graczy.`
    const st = opts?.settings ?? {}
    const tier: Tier = st.tier === 'adult' || st.tier === '18+' ? st.tier : 'family'
    const players = playerIds.slice(0, MAX_PLAYERS) // the rest watch and vote as audience
    const allowed = new Set(TIER_MIX[tier].map(([t]) => t))
    const queue = pickPrompts(cfg.prompts, tier, players.length * 2, opts?.used)
    const [finalPrompt] = pickPrompts(cfg.finalPrompts, tier, 1, opts?.used)
    if (queue.length < players.length * 2 || !finalPrompt) return 'Za mało promptów na tym poziomie humoru.'
    for (const p of [...queue, finalPrompt]) opts?.used?.add(p.id)
    const s: State = {
      players,
      tier,
      writeSeconds: Number(st.writeSeconds) || 90,
      voteSeconds: Number(st.voteSeconds) || 20,
      round: 1,
      rounds: [],
      dIdx: 0,
      final: null,
      stage: 'write',
      voteAt: null,
      revealAt: null,
      queue,
      finalPrompt,
      quips: cfg.safetyQuips.filter((q) => allowed.has(q.tier)).map((q) => q.text),
      safetyRound: {},
      r1Pairs: new Set(),
    }
    newRound(s, 1)
    return s
  },

  scoringIds(s) {
    return s.players
  },

  tick(s, t, ctx?: TickContext) {
    const active = new Set(ctx?.activeIds ?? s.players)
    if (s.stage === 'write') {
      const writers = s.players.filter((p) => active.has(p))
      const allDone = writers.length > 0 && writers.every((p) => doneWriting(s, p))
      if (t >= writeDuration(s) || allDone) {
        fillAnswers(s)
        openVote(s, t)
      }
    }
    if (s.stage === 'vote') {
      const voters = eligibleVoters(s).filter((p) => active.has(p))
      const allVoted = voters.length > 0 && voters.every((p) => hasVoted(s, p))
      if (t >= (s.voteAt ?? 0) + voteDuration(s) || allVoted) reveal(s, t)
    }
    return s.stage === 'revealed'
  },

  autoAdvanceAt(s) {
    return s.stage === 'revealed' && s.revealAt != null ? s.revealAt + resultSeconds(s) : null
  },

  next(s) {
    if (s.round === 3) return false // final done → podium
    if (s.stage === 'write') fillAnswers(s) // GM skipped the writing: keep the round playable
    if (s.dIdx + 1 < duels(s).length) {
      s.dIdx++
      openVote(s, 0) // hub restarts its clock at 0 for the new question
    } else if (s.round === 1) newRound(s, 2)
    else newFinal(s)
    return true
  },

  // GM "replay": vote this duel (or the final) again; answers are kept.
  replay(s) {
    const d = current(s)
    if (d) {
      d.votes = {}
      d.result = null
    } else if (s.final) {
      s.final.tokens = {}
      s.final.result = null
    }
    if (s.stage === 'write') return // still writing — the clock restart just extends it
    openVote(s, 0)
  },

  flag(s, pid) {
    const target = current(s) ?? s.final
    if (!target || target.flaggedBy.includes(pid)) return null
    target.flaggedBy.push(pid)
    return { id: target.promptId, prompt: target.prompt }
  },

  submit(s, pid, payload, t) {
    const kind = payload?.kind
    const isPlayer = s.players.includes(pid)
    if (kind === 'draft' || kind === 'answer' || kind === 'safety') {
      if (s.stage !== 'write' || !isPlayer || t > writeDuration(s) + GRACE) return
      const target: Duel | Final | undefined =
        s.round === 3 ? (s.final?.id === payload.mid ? s.final : undefined) : myDuels(s, pid).find((d) => d.id === payload.mid)
      if (!target || target.answers[pid]) return // not your prompt, or already locked in
      if (kind === 'draft') {
        target.drafts[pid] = cleanAnswer(payload.text)
      } else if (kind === 'answer') {
        const text = cleanAnswer(payload.text)
        if (text) target.answers[pid] = { text, safety: false }
      } else {
        if (s.safetyRound[pid] === s.round) return // one Gotowiec per round
        s.safetyRound[pid] = s.round
        target.answers[pid] = { text: pickQuip(s, Object.values(target.answers).map((a) => a.text)), safety: true }
      }
      return
    }
    if (s.stage !== 'vote' || t > (s.voteAt ?? 0) + voteDuration(s) + GRACE) return
    if (kind === 'vote') {
      const d = current(s)
      if (!d || payload.mid !== d.id || d.authors.includes(pid) || d.votes[pid] != null) return
      if (payload.choice !== 0 && payload.choice !== 1) return
      d.votes[pid] = payload.choice
    } else if (kind === 'tokens') {
      const f = s.final
      if (s.round !== 3 || !f || payload.mid !== f.id || f.tokens[pid]) return
      const cap = isPlayer ? FINAL_TOKENS : 1
      const jinx = new Set(finalJinx(f))
      const byEntry = new Map(Object.entries(f.entryId).map(([p, e]) => [e, Number(p)]))
      const alloc: Record<number, number> = {}
      let sum = 0
      for (const [entry, raw] of Object.entries(payload.alloc ?? {})) {
        const author = byEntry.get(entry)
        const n = Number(raw)
        if (author == null || author === pid || jinx.has(author) || !Number.isInteger(n) || n < 0) return
        if (n === 0) continue
        alloc[author] = (alloc[author] ?? 0) + n
        sum += n
      }
      if (sum < 1 || sum > cap) return
      f.tokens[pid] = alloc
    }
  },

  // Points for the current duel / the final. Idempotent; the hub applies it once.
  score(s) {
    return currentPoints(s)
  },

  awards(s) {
    const sweeps: Record<number, number> = {}
    const votes: Record<number, number> = {}
    const jinx: Record<number, number> = {}
    for (const round of s.rounds) {
      for (const d of round) {
        if (!d.result) continue
        if (d.result.winner != null && d.result.sweep) sweeps[d.authors[d.result.winner]] = (sweeps[d.authors[d.result.winner]] ?? 0) + 1
        if (duelJinx(d)) for (const p of d.authors) jinx[p] = (jinx[p] ?? 0) + 1
        for (const c of Object.values(d.votes)) votes[d.authors[c]] = (votes[d.authors[c]] ?? 0) + 1
      }
    }
    const top = (m: Record<number, number>) => {
      let best: [number, number] | null = null
      for (const [k, v] of Object.entries(m)) if (!best || v > best[1]) best = [Number(k), v]
      return best
    }
    const out: GameAward[] = []
    const sw = top(sweeps)
    if (sw) out.push({ title: '🎯 Riposta doskonała', pid: sw[0], detail: `${sw[1]}× zgarnięte wszystkie głosy` })
    const v = top(votes)
    if (v) out.push({ title: '❤️ Ulubieniec sali', pid: v[0], detail: `${v[1]} głosów w pojedynkach` })
    const j = top(jinx)
    if (j) out.push({ title: '🧠 Telepata', pid: j[0], detail: `${j[1]}× ta sama odpowiedź co rywal` })
    return out
  },

  // TV view. Before a reveal it must never contain authors, assignments or live
  // vote splits — /api/gm/state is unauthenticated and any phone can read it.
  publicView(s, t, names) {
    const base = header(s, t)
    const d = current(s)
    if (s.stage === 'write') return { phase: 'playing', ...base }
    if (s.stage === 'vote') {
      if (d) return { phase: 'playing', ...base, prompt: d.prompt, answers: d.authors.map((p) => d.answers[p]?.text ?? '') }
      const f = s.final!
      return { phase: 'playing', ...base, prompt: f.prompt, entries: f.order.map((p) => ({ text: f.answers[p]?.text ?? '' })) }
    }
    if (d) return { phase: 'revealed', ...base, duel: duelReveal(s, d, names) }
    return { phase: 'revealed', ...base, final: finalReveal(s, s.final!, names) }
  },

  stateForPlayer(s, pid, t, names): PlayerView {
    const role = s.players.includes(pid) ? 'player' : 'audience'
    const base = { ...header(s, t), leaderboard: [] as any, role }
    const d = current(s)
    if (s.stage === 'write') {
      if (role === 'audience') return { phase: 'playing', ...base }
      const safetyLeft = s.safetyRound[pid] !== s.round
      if (s.round === 3) {
        const f = s.final!
        return {
          phase: 'playing',
          ...base,
          safetyLeft,
          myPrompts: [{ mid: f.id, prompt: f.prompt, answer: f.answers[pid]?.text ?? null, safety: !!f.answers[pid]?.safety, draft: f.drafts[pid] ?? '' }],
        }
      }
      return {
        phase: 'playing',
        ...base,
        safetyLeft,
        myPrompts: myDuels(s, pid).map((x) => ({
          mid: x.id,
          prompt: x.prompt,
          answer: x.answers[pid]?.text ?? null,
          safety: !!x.answers[pid]?.safety,
          draft: x.drafts[pid] ?? '',
        })),
      }
    }
    if (s.stage === 'vote') {
      if (d) {
        const mineIdx = d.authors.indexOf(pid)
        return {
          phase: 'playing',
          ...base,
          mid: d.id,
          prompt: d.prompt,
          answers: d.authors.map((p) => d.answers[p]?.text ?? ''),
          mine: mineIdx >= 0 ? mineIdx : null,
          myVote: d.votes[pid] ?? null,
        }
      }
      const f = s.final!
      const jinx = new Set(finalJinx(f))
      const mine = f.tokens[pid]
      return {
        phase: 'playing',
        ...base,
        mid: f.id,
        prompt: f.prompt,
        cap: role === 'player' ? FINAL_TOKENS : 1,
        entries: f.order.map((p) => ({ id: f.entryId[p], text: f.answers[p]?.text ?? '', mine: p === pid, jinx: jinx.has(p) })),
        myTokens: mine ? Object.fromEntries(Object.entries(mine).map(([a, n]) => [f.entryId[Number(a)], n])) : null,
      }
    }
    const reveal = d ? { duel: duelReveal(s, d, names) } : { final: finalReveal(s, s.final!, names) }
    const myPoints = currentPoints(s)[pid] ?? 0
    const target = d ?? s.final!
    return {
      phase: 'revealed',
      ...base,
      ...reveal,
      myPoints,
      flagged: target.flaggedBy.includes(pid),
      flagCount: target.flaggedBy.length,
    }
  },
}

export default riposta
