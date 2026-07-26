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

  start(playerIds, cfg: Config, opts?: { category?: string }) {
    const cat = cfg.categories.find((c) => c.id === opts?.category)
    if (!cat) return 'Pick a category first.'
    if (!cat.questions.length) return 'That category has no questions.'
    return {
      questions: shuffle(cat.questions),
      idx: 0,
      picks: {},
      timerSeconds: cfg.timerSeconds || 5,
      picksRequired: cfg.picksRequired || 3,
    }
  },

  tick(s, elapsedSec) {
    return elapsedSec >= s.timerSeconds
  },

  next(s) {
    if (s.idx + 1 >= s.questions.length) return false // no more questions → end
    s.idx++
    s.picks = {}
    return true
  },

  submit(s, pid, payload, elapsedSec) {
    if (elapsedSec > s.timerSeconds) return // server-clock trust boundary — too late
    const picks: number[] = Array.isArray(payload?.picks) ? payload.picks : []
    const valid = picks.filter((n) => Number.isInteger(n))
    const deduped = [...new Set(valid)].slice(0, s.picksRequired)
    s.picks[pid] = deduped // overwrite, never append
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
    const remaining = Math.max(0, Math.ceil(s.timerSeconds - elapsedSec))
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
    if (elapsedSec >= s.timerSeconds) {
      const gained = yourPicks.filter((p) => q.correct.includes(p)).length
      return { phase: 'revealed', ...common, correct: q.correct, gained }
    }
    return { phase: 'playing', ...common, remaining }
  },
}

export default fiveSecondRule
