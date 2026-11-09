// Point maths for Riposta. Pure functions, all values from the design report.

export const DUEL_POOL = 1000 // split by vote share, ×round multiplier
export const WIN_BONUS = 100
export const SWEEP_BONUS = 250 // replaces WIN_BONUS
export const FINAL_POOL_PER_PLAYER = 1000
export const FINAL_BEST_BONUS = 300
export const FINAL_TOKENS = 3 // per player; an audience member has 1

const round10 = (x: number) => Math.round(x / 10) * 10
const floor10 = (x: number) => Math.floor(x / 10) * 10

// Combined weight of the whole audience, in player votes: never more than about
// half the voting players (≈ ⅓ of the total), at least 1 when anyone in the
// audience voted, and never more than the audience size itself.
export function audienceWeight(audienceVoters: number, playerVoters: number): number {
  if (audienceVoters <= 0) return 0
  return Math.min(audienceVoters, Math.max(1, Math.ceil(playerVoters / 2)))
}

export interface DuelInput {
  playerVotes: [number, number] // votes from players for answer 0 / 1
  audienceVotes: [number, number]
  safety: [boolean, boolean] // answer came from the "Gotowiec" button / timeout
  jinx: boolean // identical answers
  multiplier: number // 1 in round 1, 2 in round 2
}
export interface DuelResult {
  points: [number, number]
  share: [number, number] // 0..1 weighted vote share
  winner: 0 | 1 | null
  sweep: boolean
}

export function scoreDuel(d: DuelInput): DuelResult {
  const none: DuelResult = { points: [0, 0], share: [0, 0], winner: null, sweep: false }
  if (d.jinx) return none
  const pv = d.playerVotes[0] + d.playerVotes[1]
  const av = d.audienceVotes[0] + d.audienceVotes[1]
  const w = audienceWeight(av, pv)
  const weighted = [0, 1].map((i) => d.playerVotes[i] + (av ? (w * d.audienceVotes[i]) / av : 0))
  const total = weighted[0] + weighted[1]
  if (total <= 0) return none
  const share: [number, number] = [weighted[0] / total, weighted[1] / total]
  const winner = weighted[0] > weighted[1] ? 0 : weighted[1] > weighted[0] ? 1 : null
  let sweep = false
  if (winner != null) {
    const loser = 1 - winner
    sweep = pv >= 2 && d.playerVotes[loser] === 0 && (av === 0 || d.audienceVotes[winner] / av > 0.5)
  }
  const m = d.multiplier
  const points = [0, 1].map((i) => {
    let p = round10(DUEL_POOL * share[i]) * m
    if (winner === i) p += (sweep ? SWEEP_BONUS : WIN_BONUS) * m
    return d.safety[i] ? floor10(p / 2) : p
  }) as [number, number]
  return { points, share, winner, sweep }
}

export interface FinalEntry {
  pid: number
  playerTokens: number
  audienceTokens: number
  safety: boolean
  jinx: boolean
}

// Final: a pool of 1000 × players, split by weighted tokens; best answer(s) +300.
// Audience tokens are scaled to at most audienceWeight(…) players' worth of tokens.
export function scoreFinal(entries: FinalEntry[], playerCount: number, playerVoters: number, audienceVoters: number) {
  const aTotal = entries.reduce((n, e) => n + e.audienceTokens, 0)
  const aWeightTokens = audienceWeight(audienceVoters, playerVoters) * FINAL_TOKENS
  const weight = new Map<number, number>()
  for (const e of entries) {
    const w = e.jinx ? 0 : e.playerTokens + (aTotal ? (aWeightTokens * e.audienceTokens) / aTotal : 0)
    weight.set(e.pid, w)
  }
  const total = [...weight.values()].reduce((a, b) => a + b, 0)
  const top = Math.max(0, ...weight.values())
  const pool = FINAL_POOL_PER_PLAYER * playerCount
  const points: Record<number, number> = {}
  const best: number[] = []
  for (const e of entries) {
    const w = weight.get(e.pid) ?? 0
    let p = total > 0 ? round10((pool * w) / total) : 0
    if (top > 0 && w === top) {
      p += FINAL_BEST_BONUS
      best.push(e.pid)
    }
    points[e.pid] = e.safety ? floor10(p / 2) : p
  }
  return { points, best, weight }
}
