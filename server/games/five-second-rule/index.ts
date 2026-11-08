import type { GameAward, GameModule, PlayerView } from '../types'

interface Question {
  id: number
  prompt: string
  options: string[]
  correct: number[]
}
interface Config {
  timerSeconds: number
  picksRequired: number
  categories: Array<{ id: string; name: string; questions: Question[] }>
}
interface Result {
  correct: number // right picks on this question
  points: number // correct + speed/streak bonuses
  fast: boolean // perfect answer completed within the first half of the window
  streak: number // run of perfect answers including this question (0 if not perfect)
}
interface Stats {
  perfect: number
  bestStreak: number
  fastSum: number // total seconds-into-window of the perfect answers
  fastN: number
}
interface State {
  questions: Question[] // shuffled, for the chosen category
  idx: number
  picks: Record<number, number[]> // pid -> chosen option indices (current question)
  order: Record<number, number[]> // pid -> option indices in the order that phone displays them (current question)
  fullAt: Record<number, number> // pid -> seconds into the answer window when their answer became complete
  streaks: Record<number, number> // pid -> current run of perfect answers, as of the last scored question
  stats: Record<number, Stats> // per-player totals, feeds the end-of-game awards
  scoredIdx: number // index of the question whose score was last applied (-1 = none yet)
  lastResults: Record<number, Result> // results of that question
  undo: { streaks: Record<number, number>; stats: Record<number, Stats> } | null // pre-score snapshot, for replay
  flaggedBy: number[] // pids who reported the current question as bad
  timerSeconds: number
  picksRequired: number
  playerIds: number[] // snapshot of active players when the round started — "everyone answered" target
  startedAt: number | null // elapsed(s) when the timer button was pressed; null = not started
  revealed: boolean // true once answers are shown (timeout, manual reveal, or last player answering)
  revealAt: number | null // elapsed(s) at reveal — auto-advance is 10s after this
}

const MIN_READ_SECONDS = 5 // force at least this long to read the prompt before Start can fire
const STARTER_GRACE = 4 // the rotating starter goes first; everyone else may press Start this much later
const STREAK_BONUS_FROM = 3 // from this many perfect answers in a row, each perfect answer earns +1

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// Who is meant to press Start on this question — rotates through the round's players.
function starterOf(s: State): number | null {
  return s.playerIds.length ? s.playerIds[s.idx % s.playerIds.length] : null
}
function answeredCount(s: State): number {
  return s.playerIds.filter((p) => (s.picks[p]?.length ?? 0) === s.picksRequired).length
}
function nextIn(s: State, elapsedSec: number): number {
  return Math.max(0, Math.ceil((s.revealAt as number) + 10 - elapsedSec))
}
function resetQuestion(s: State) {
  s.picks = {}
  s.order = {}
  s.fullAt = {}
  s.flaggedBy = []
  s.startedAt = null
  s.revealed = false
  s.revealAt = null
}

// Results for the current question. Pure until score() applies them: the streak
// bonus is derived from the streaks of the *previous* questions. `penalize` =
// GM toggle: each wrong pick cancels a right one (floored at 0) — stops blind tapping.
function evaluate(s: State, penalize = false): Record<number, Result> {
  if (s.scoredIdx === s.idx) return s.lastResults
  const correct = new Set(s.questions[s.idx].correct)
  const out: Record<number, Result> = {}
  for (const pid of new Set([...s.playerIds, ...Object.keys(s.picks).map(Number)])) {
    const picks = s.picks[pid] ?? []
    const hits = picks.filter((p) => correct.has(p)).length
    const base = penalize ? Math.max(0, hits - (picks.length - hits)) : hits
    const perfect = hits === s.picksRequired
    const fast = perfect && (s.fullAt[pid] ?? Infinity) <= s.timerSeconds / 2
    const streak = perfect ? (s.streaks[pid] ?? 0) + 1 : 0
    const points = base + (fast ? 1 : 0) + (perfect && streak >= STREAK_BONUS_FROM ? 1 : 0)
    out[pid] = { correct: hits, points, fast, streak }
  }
  return out
}

// Everyone's answers on the current question, best first — shown on the reveal screens.
function resultRows(s: State, names: Record<number, string> | undefined) {
  const q = s.questions[s.idx]
  return Object.entries(evaluate(s))
    .map(([k, r]) => ({
      id: Number(k),
      name: names?.[Number(k)] ?? '?',
      picks: (s.picks[Number(k)] ?? []).map((i) => ({ t: q.options[i], ok: q.correct.includes(i) })),
      ...r,
    }))
    .sort((a, b) => b.points - a.points)
}

// cfg = questions.json. opts.category = chosen category id.
const fiveSecondRule: GameModule<State> = {
  id: 'five-second-rule',
  name: '5 Second Rule',
  minPlayers: 1,
  configFile: 'questions.json',

  // opts.questionCount: 0/undefined = every question in the chosen decks.
  // opts.used: question ids already played this session — they come last, and
  // the picked ids are added to it, so repeats only happen once the decks run dry.
  start(
    playerIds,
    cfg: Config,
    opts?: { categories?: string[]; timerSeconds?: number; questionCount?: number; used?: Set<number> },
  ) {
    const sel = opts?.categories || []
    if (!sel.length) return 'Wybierz co najmniej jedną kategorię.'
    const pool = cfg.categories.filter((c) => sel.includes(c.id)).flatMap((c) => c.questions)
    if (!pool.length) return 'Wybrane kategorie nie mają pytań.'
    const used = opts?.used
    const questions = [
      ...shuffle(pool.filter((q) => !used?.has(q.id))),
      ...shuffle(pool.filter((q) => used?.has(q.id))),
    ].slice(0, opts?.questionCount || pool.length)
    for (const q of questions) used?.add(q.id)
    return {
      questions,
      idx: 0,
      picks: {},
      order: {},
      fullAt: {},
      streaks: {},
      stats: {},
      scoredIdx: -1,
      lastResults: {},
      undo: null,
      flaggedBy: [],
      timerSeconds: opts?.timerSeconds || cfg.timerSeconds || 5,
      picksRequired: cfg.picksRequired || 3,
      playerIds: [...playerIds],
      startedAt: null,
      revealed: false,
      revealAt: null,
    }
  },

  // Round is "over" (score it) once the answers have been revealed.
  tick(s) {
    return s.revealed
  },

  // Auto-advance 10s after reveal (only once revealed).
  autoAdvanceAt(s) {
    return s.revealed && s.revealAt != null ? s.revealAt + 10 : null
  },

  // A player presses "Start" to begin this question's answer timer. Ignored
  // (no-op) before the read-wait has passed since the prompt appeared — an
  // eager tap doesn't rob everyone else of reading time. Capped at the GM's
  // chosen answer window so a 3s speed-round doesn't get a longer read-wait
  // than its own answer time. Only the rotating starter may press right away;
  // anyone else has to wait STARTER_GRACE longer (so a locked phone can't stall the game).
  startTimer(s, elapsedSec, pid) {
    const readSeconds = Math.min(MIN_READ_SECONDS, s.timerSeconds)
    const starter = starterOf(s)
    const grace = pid == null || starter == null || pid === starter ? 0 : STARTER_GRACE
    if (s.startedAt == null && elapsedSec >= readSeconds + grace) s.startedAt = elapsedSec
  },

  // Any player presses "Reveal" once the answer window has closed.
  reveal(s, elapsedSec) {
    if (s.startedAt != null && !s.revealed && elapsedSec >= s.startedAt + s.timerSeconds) {
      s.revealed = true
      s.revealAt = elapsedSec
    }
  },

  next(s, playerIds) {
    if (s.idx + 1 >= s.questions.length) return false // no more questions → end
    s.idx++
    if (playerIds) s.playerIds = [...playerIds] // late joiners in, leavers out
    resetQuestion(s)
    return true
  },

  // Same question again, as if it had never been asked — including its points.
  replay(s) {
    if (s.scoredIdx === s.idx && s.undo) {
      s.streaks = s.undo.streaks
      s.stats = s.undo.stats
      s.scoredIdx = -1
      s.lastResults = {}
      s.undo = null
    }
    resetQuestion(s)
  },

  flag(s, pid) {
    if (s.flaggedBy.includes(pid)) return null
    s.flaggedBy.push(pid)
    const q = s.questions[s.idx]
    return { id: q.id, prompt: q.prompt }
  },

  submit(s, pid, payload, elapsedSec, hubFlags) {
    if (!s.playerIds.includes(pid)) return // joined mid-question — plays from the next one
    if (s.startedAt == null || s.revealed) return // timer not started yet, or answers already shown
    if (elapsedSec > s.startedAt + s.timerSeconds) return // server-clock trust boundary — too late
    const optionCount = s.questions[s.idx].options.length
    const picks: number[] = Array.isArray(payload?.picks) ? payload.picks : []
    const valid = picks.filter((n) => Number.isInteger(n) && n >= 0 && n < optionCount)
    const deduped = [...new Set(valid)].slice(0, s.picksRequired)
    s.picks[pid] = deduped // overwrite, never append
    // When the answer first became complete — drives the speed bonus.
    if (deduped.length === s.picksRequired) s.fullAt[pid] ??= elapsedSec - s.startedAt
    else delete s.fullAt[pid]

    // Everyone who was in the round has submitted a FULL answer (all
    // picksRequired picks, not just a partial tap) — reveal now instead of
    // making them wait out the rest of the timer. GM can turn this off — read
    // live off the hub each call (not snapshotted) so the toggle applies
    // immediately, mid-game, like autoAdvance already does.
    const revealOnAllAnswered = hubFlags?.revealOnAllAnswered !== false
    if (
      revealOnAllAnswered &&
      !s.revealed &&
      s.playerIds.length > 0 &&
      answeredCount(s) === s.playerIds.length
    ) {
      s.revealed = true
      s.revealAt = elapsedSec
    }
  },

  // Points for the CURRENT question only; hub adds to running totals once at
  // reveal. Idempotent per question (streaks/stats advance only the first time).
  score(s, hubFlags) {
    const res = evaluate(s, !!hubFlags?.penalizeWrong)
    if (s.scoredIdx !== s.idx) {
      s.undo = { streaks: { ...s.streaks }, stats: structuredClone(s.stats) }
      for (const [k, r] of Object.entries(res)) {
        const pid = Number(k)
        s.streaks[pid] = r.streak
        const st = (s.stats[pid] ??= { perfect: 0, bestStreak: 0, fastSum: 0, fastN: 0 })
        if (r.streak > 0) {
          st.perfect++
          st.bestStreak = Math.max(st.bestStreak, r.streak)
          st.fastSum += s.fullAt[pid]
          st.fastN++
        }
      }
      s.lastResults = res
      s.scoredIdx = s.idx
    }
    return Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.points]))
  },

  awards(s) {
    const rows = Object.entries(s.stats).map(([k, st]) => ({ pid: Number(k), ...st }))
    const best = (list: typeof rows, value: (r: (typeof rows)[number]) => number) =>
      list.reduce<(typeof rows)[number] | undefined>((a, r) => (!a || value(r) > value(a) ? r : a), undefined)
    const out: GameAward[] = []
    const perfect = best(rows, (r) => r.perfect)
    if (perfect && perfect.perfect > 0)
      out.push({ title: '🎯 Perfekcjonista', pid: perfect.pid, detail: `${perfect.perfect}× komplet` })
    const quick = best(rows.filter((r) => r.fastN > 0), (r) => -r.fastSum / r.fastN)
    if (quick) out.push({ title: '⚡ Błyskawica', pid: quick.pid, detail: `śr. ${(quick.fastSum / quick.fastN).toFixed(1)} s` })
    const streak = best(rows, (r) => r.bestStreak)
    if (streak && streak.bestStreak >= 2)
      out.push({ title: '🔥 Król serii', pid: streak.pid, detail: `${streak.bestStreak} z rzędu` })
    return out
  },

  publicView(s, elapsedSec, names) {
    const q = s.questions[s.idx]
    const starter = starterOf(s)
    const base = {
      game: this.id,
      prompt: q.prompt,
      questionNo: s.idx + 1,
      questionCount: s.questions.length,
      answered: answeredCount(s),
      total: s.playerIds.length,
    }
    if (s.revealed) {
      return {
        phase: 'revealed',
        ...base,
        correct: q.correct.map((i) => q.options[i]),
        results: resultRows(s, names),
        nextIn: nextIn(s, elapsedSec),
      }
    }
    if (s.startedAt == null) {
      return { phase: 'playing', stage: 'reading', ...base, starterName: starter != null ? names[starter] : undefined }
    }
    const remaining = Math.max(0, Math.ceil(s.startedAt + s.timerSeconds - elapsedSec))
    return { phase: 'playing', stage: remaining > 0 ? 'answering' : 'closed', ...base, remaining }
  },

  stateForPlayer(s, pid, elapsedSec, names): PlayerView {
    const q = s.questions[s.idx]
    const yourPicks = s.picks[pid] || []
    // Each phone sees the options in its own (stable) order; picks and `correct`
    // stay in the original indices, so scoring is unaffected.
    const order = (s.order[pid] ??= shuffle(q.options.map((_, i) => i)))
    const common = {
      game: this.id,
      leaderboard: [] as any,
      prompt: q.prompt,
      options: q.options,
      order,
      picksRequired: s.picksRequired,
      questionNo: s.idx + 1,
      questionCount: s.questions.length,
      yourPicks,
      late: !s.playerIds.includes(pid), // joined mid-question: watches this one, plays from the next
    }
    // Revealed → interstitial with correct answers, everyone's results + auto-advance countdown.
    if (s.revealed) {
      const mine = evaluate(s)[pid]
      return {
        phase: 'revealed',
        ...common,
        correct: q.correct,
        gained: mine?.correct ?? 0,
        points: mine?.points ?? 0,
        fast: mine?.fast ?? false,
        streak: mine?.streak ?? 0,
        results: resultRows(s, names),
        nextIn: nextIn(s, elapsedSec),
        flagged: s.flaggedBy.includes(pid),
        flagCount: s.flaggedBy.length,
      }
    }
    const live = { answered: answeredCount(s), total: s.playerIds.length }
    if (common.late) return { phase: 'playing', ...common, ...live, remaining: 0 }
    // Not started yet → prompt shown, waiting for the starter to start the timer.
    // readWait > 0 means Start is still disabled (forced minimum read time);
    // startWait also includes the grace period for non-starters.
    if (s.startedAt == null) {
      const readSeconds = Math.min(MIN_READ_SECONDS, s.timerSeconds)
      const starter = starterOf(s)
      const youStart = starter == null || pid === starter
      return {
        phase: 'playing',
        ...common,
        ...live,
        awaitingStart: true,
        readWait: Math.max(0, Math.ceil(readSeconds - elapsedSec)),
        startWait: Math.max(0, Math.ceil(readSeconds + (youStart ? 0 : STARTER_GRACE) - elapsedSec)),
        youStart,
        starterName: starter != null ? names?.[starter] : undefined,
        remaining: s.timerSeconds,
      }
    }
    // Answer window closed but not revealed → waiting for someone to reveal.
    if (elapsedSec >= s.startedAt + s.timerSeconds) {
      return { phase: 'playing', ...common, ...live, awaitingReveal: true, remaining: 0 }
    }
    // Answering.
    return {
      phase: 'playing',
      ...common,
      ...live,
      remaining: Math.max(0, Math.ceil(s.startedAt + s.timerSeconds - elapsedSec)),
    }
  },
}

export default fiveSecondRule
