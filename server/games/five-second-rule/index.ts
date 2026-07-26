import type { GameModule, PlayerView } from '../types'

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
interface State {
  questions: Question[] // shuffled, for the chosen category
  idx: number
  picks: Record<number, number[]> // pid -> chosen option indices (current question)
  timerSeconds: number
  picksRequired: number
  playerIds: number[] // snapshot of active players when the round started — "everyone answered" target
  startedAt: number | null // elapsed(s) when the timer button was pressed; null = not started
  revealed: boolean // true once answers are shown (timeout, manual reveal, or last player answering)
  revealAt: number | null // elapsed(s) at reveal — auto-advance is 10s after this
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

// cfg = questions.json. opts.category = chosen category id.
const fiveSecondRule: GameModule<State> = {
  id: 'five-second-rule',
  name: '5 Second Rule',
  minPlayers: 1,
  configFile: 'questions.json',

  start(playerIds, cfg: Config, opts?: { categories?: string[]; timerSeconds?: number }) {
    const sel = opts?.categories || []
    if (!sel.length) return 'Pick at least one category.'
    const pool = cfg.categories.filter((c) => sel.includes(c.id)).flatMap((c) => c.questions)
    if (!pool.length) return 'Those categories have no questions.'
    return {
      questions: shuffle(pool),
      idx: 0,
      picks: {},
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

  // Any player presses "Start" to begin this question's 5s timer.
  startTimer(s, elapsedSec) {
    if (s.startedAt == null) s.startedAt = elapsedSec
  },

  // Any player presses "Reveal" once the answer window has closed.
  reveal(s, elapsedSec) {
    if (s.startedAt != null && !s.revealed && elapsedSec >= s.startedAt + s.timerSeconds) {
      s.revealed = true
      s.revealAt = elapsedSec
    }
  },

  next(s) {
    if (s.idx + 1 >= s.questions.length) return false // no more questions → end
    s.idx++
    s.picks = {}
    s.startedAt = null
    s.revealed = false
    s.revealAt = null
    return true
  },

  submit(s, pid, payload, elapsedSec, hubFlags) {
    if (s.startedAt == null) return // timer not started yet
    if (elapsedSec > s.startedAt + s.timerSeconds) return // server-clock trust boundary — too late
    const picks: number[] = Array.isArray(payload?.picks) ? payload.picks : []
    const valid = picks.filter((n) => Number.isInteger(n))
    const deduped = [...new Set(valid)].slice(0, s.picksRequired)
    s.picks[pid] = deduped // overwrite, never append

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
      s.playerIds.every((p) => (s.picks[p]?.length ?? 0) === s.picksRequired)
    ) {
      s.revealed = true
      s.revealAt = elapsedSec
    }
  },

  // Points for the CURRENT question only; hub adds to running totals once at reveal.
  score(s) {
    const q = s.questions[s.idx]
    const correct = new Set(q.correct)
    const out: Record<number, number> = {}
    for (const [pid, picks] of Object.entries(s.picks)) {
      out[Number(pid)] = picks.filter((p) => correct.has(p)).length
    }
    return out
  },

  stateForPlayer(s, pid, elapsedSec): PlayerView {
    const q = s.questions[s.idx]
    const yourPicks = s.picks[pid] || []
    const common = {
      game: this.id,
      leaderboard: [] as any,
      prompt: q.prompt,
      options: q.options,
      picksRequired: s.picksRequired,
      questionNo: s.idx + 1,
      questionCount: s.questions.length,
      yourPicks,
    }
    // Revealed → interstitial with correct answers + auto-advance countdown.
    if (s.revealed) {
      const gained = yourPicks.filter((p) => q.correct.includes(p)).length
      const nextIn = Math.max(0, Math.ceil((s.revealAt as number) + 10 - elapsedSec))
      return { phase: 'revealed', ...common, correct: q.correct, gained, nextIn }
    }
    // Not started yet → prompt shown, waiting for someone to start the timer.
    if (s.startedAt == null) {
      return { phase: 'playing', ...common, awaitingStart: true, remaining: s.timerSeconds }
    }
    // Answer window closed but not revealed → waiting for someone to reveal.
    if (elapsedSec >= s.startedAt + s.timerSeconds) {
      return { phase: 'playing', ...common, awaitingReveal: true, remaining: 0 }
    }
    // Answering.
    return {
      phase: 'playing',
      ...common,
      remaining: Math.max(0, Math.ceil(s.startedAt + s.timerSeconds - elapsedSec)),
    }
  },
}

export default fiveSecondRule
