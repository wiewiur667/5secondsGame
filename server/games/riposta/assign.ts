// Who answers which prompt in a head-to-head round. Pure, RNG injectable for tests.

export type Rng = () => number

export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

// N players → N prompts, each prompt answered by 2 players, each player answers 2
// prompts: walk a random cycle and pair neighbours (p0,p1), (p1,p2) … (pN-1,p0).
// `avoid` = pairs that already met (round 1); with ≥5 players we retry up to 50
// shuffles to minimise rematches (with 3–4 players rematches are unavoidable).
export function assignPairs(players: number[], avoid: Set<string> = new Set(), rng: Rng = Math.random): Array<[number, number]> {
  const n = players.length
  if (n < 2) return []
  const build = (order: number[]) =>
    n === 2 ? [[order[0], order[1]] as [number, number]] : order.map((p, i) => [p, order[(i + 1) % n]] as [number, number])
  let best = build(shuffle(players, rng))
  if (n < 5 || !avoid.size) return best
  const clashes = (pairs: Array<[number, number]>) => pairs.filter(([a, b]) => avoid.has(pairKey(a, b))).length
  let bestClash = clashes(best)
  for (let tries = 0; tries < 50 && bestClash > 0; tries++) {
    const cand = build(shuffle(players, rng))
    const c = clashes(cand)
    if (c < bestClash) [best, bestClash] = [cand, c]
  }
  return best
}

export function pairSet(pairs: Array<[number, number]>): Set<string> {
  return new Set(pairs.map(([a, b]) => pairKey(a, b)))
}
