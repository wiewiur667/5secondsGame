import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import riposta, { pickPrompts } from '../server/games/riposta/index.ts'
import { assignPairs, pairSet } from '../server/games/riposta/assign.ts'
import { audienceWeight, scoreDuel, scoreFinal } from '../server/games/riposta/scoring.ts'
import { cleanAnswer, sameKey, MAX_ANSWER } from '../server/games/riposta/normalize.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const cfg = JSON.parse(readFileSync(here + '../server/games/riposta/prompts.json', 'utf8'))

// Deterministic RNG for the pairing tests.
function rng(seed: number) {
  // mulberry32
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const names = (ids: number[]) => Object.fromEntries(ids.map((i) => [i, `P${i}`]))
const start = (ids: number[], settings: Record<string, any> = {}) => {
  const s = riposta.start(ids, cfg, { settings, used: new Set() })
  assert.strictEqual(typeof s, 'object', String(s))
  return s as any
}
// Every player answers both of their prompts with a unique text.
function writeAll(s: any, ids: number[], t = 1) {
  for (const pid of ids) {
    const v: any = riposta.stateForPlayer(s, pid, t)
    for (const p of v.myPrompts) riposta.submit!(s, pid, { kind: 'answer', mid: p.mid, text: `odp ${pid} ${p.mid}` }, t)
  }
}

// --- pure helpers -----------------------------------------------------------

test('riposta: pairing gives every player exactly 2 prompts, never against themselves', () => {
  for (let n = 3; n <= 8; n++) {
    const ids = Array.from({ length: n }, (_, i) => i + 1)
    const pairs = assignPairs(ids, new Set(), rng(n))
    assert.strictEqual(pairs.length, n)
    for (const id of ids) assert.strictEqual(pairs.flat().filter((p) => p === id).length, 2, `n=${n} pid=${id}`)
    assert(pairs.every(([a, b]) => a !== b))
  }
})

test('riposta: round 2 pairing avoids round 1 rematches with 5+ players', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8]
    const r1 = pairSet(assignPairs(ids, new Set(), rng(seed)))
    const r2 = assignPairs(ids, r1, rng(seed + 100))
    const clashes = r2.filter(([a, b]) => r1.has(a < b ? `${a}-${b}` : `${b}-${a}`)).length
    assert(clashes <= 1, `seed ${seed}: ${clashes} rematches`)
  }
})

test('riposta: duel points = share × 1000 + 100 win bonus, ×2 in round 2', () => {
  const r = scoreDuel({ playerVotes: [3, 1], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 1 })
  assert.deepStrictEqual(r.points, [850, 250])
  assert.strictEqual(r.winner, 0)
  assert.strictEqual(r.sweep, false)
  const r2 = scoreDuel({ playerVotes: [3, 1], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 2 })
  assert.deepStrictEqual(r2.points, [1700, 500])
})

test('riposta: sweep needs ≥2 player votes and none for the opponent', () => {
  const sweep = scoreDuel({ playerVotes: [2, 0], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 1 })
  assert.strictEqual(sweep.sweep, true)
  assert.deepStrictEqual(sweep.points, [1250, 0])
  const lone = scoreDuel({ playerVotes: [1, 0], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 1 })
  assert.strictEqual(lone.sweep, false, 'a 3-player game (1 voter) cannot sweep')
  assert.deepStrictEqual(lone.points, [1100, 0])
  const audienceSplit = scoreDuel({ playerVotes: [2, 0], audienceVotes: [1, 3], safety: [false, false], jinx: false, multiplier: 1 })
  assert.strictEqual(audienceSplit.sweep, false, 'audience majority against the winner breaks the sweep')
})

test('riposta: tie splits 50/50 with no bonus; no votes = 0; jinx = 0', () => {
  const tie = scoreDuel({ playerVotes: [1, 1], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 1 })
  assert.deepStrictEqual(tie.points, [500, 500])
  assert.strictEqual(tie.winner, null)
  const none = scoreDuel({ playerVotes: [0, 0], audienceVotes: [0, 0], safety: [false, false], jinx: false, multiplier: 1 })
  assert.deepStrictEqual(none.points, [0, 0])
  const jinx = scoreDuel({ playerVotes: [3, 0], audienceVotes: [0, 0], safety: [false, false], jinx: true, multiplier: 1 })
  assert.deepStrictEqual(jinx.points, [0, 0])
})

test('riposta: Gotowiec earns half (floored to 10), can still win', () => {
  const r = scoreDuel({ playerVotes: [3, 1], audienceVotes: [0, 0], safety: [true, false], jinx: false, multiplier: 1 })
  assert.deepStrictEqual(r.points, [420, 250])
})

test('riposta: audience weighs at most ~half the voting players combined', () => {
  assert.strictEqual(audienceWeight(0, 6), 0)
  assert.strictEqual(audienceWeight(100, 6), 3)
  assert.strictEqual(audienceWeight(1, 6), 1)
  assert.strictEqual(audienceWeight(50, 1), 1)
  // 100 audience votes for B can't outweigh 6 player votes for A
  const r = scoreDuel({ playerVotes: [6, 0], audienceVotes: [0, 100], safety: [false, false], jinx: false, multiplier: 1 })
  assert.strictEqual(r.winner, 0)
})

test('riposta: final splits 1000×N by tokens, best answer +300', () => {
  const r = scoreFinal(
    [
      { pid: 1, playerTokens: 6, audienceTokens: 0, safety: false, jinx: false },
      { pid: 2, playerTokens: 3, audienceTokens: 0, safety: false, jinx: false },
      { pid: 3, playerTokens: 3, audienceTokens: 0, safety: false, jinx: false },
    ],
    3,
    3,
    0,
  )
  assert.deepStrictEqual(r.points, { 1: 1800, 2: 750, 3: 750 })
  assert.deepStrictEqual(r.best, [1])
})

test('riposta: answers are cleaned and capped; Telepatia ignores case/diacritics/punctuation', () => {
  assert.strictEqual(cleanAnswer('  a​  b\n c  '), 'a b c')
  assert.strictEqual(Array.from(cleanAnswer('ż'.repeat(200))).length, MAX_ANSWER)
  assert.strictEqual(cleanAnswer(42), '')
  assert.strictEqual(sameKey('Żółw!'), sameKey('zolw'))
  assert.strictEqual(sameKey('Łódź'), 'lodz')
  assert.notStrictEqual(sameKey('kot'), sameKey('pies'))
})

test('riposta: tier mixing — family draws only family; 18+ also mixes lower tiers', () => {
  const fam = pickPrompts(cfg.prompts, 'family', 50)
  assert(fam.every((p: any) => p.tier === 'family'))
  const x = pickPrompts(cfg.prompts, '18+', 200)
  const tiers = new Set(x.map((p: any) => p.tier))
  assert(tiers.has('18+') && tiers.has('adult') && tiers.has('family'))
})

test('riposta: unused prompts are drawn before already-played ones', () => {
  const used = new Set<number>(cfg.prompts.filter((p: any) => p.tier === 'family').slice(0, 90).map((p: any) => p.id))
  const got = pickPrompts(cfg.prompts, 'family', 10, used)
  assert(got.every((p: any) => !used.has(p.id)))
})

// --- game flow ----------------------------------------------------------------

test('riposta: needs 3 players; 9th+ player becomes audience (no score row)', () => {
  assert.strictEqual(typeof riposta.start([1, 2], cfg, {}), 'string')
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const s = start(ids)
  assert.deepStrictEqual(riposta.scoringIds!(s), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.strictEqual((riposta.stateForPlayer(s, 9, 0) as any).role, 'audience')
  assert.strictEqual((riposta.stateForPlayer(s, 9, 0) as any).myPrompts, undefined)
})

test('riposta: writing phase — 2 own prompts, only own prompt accepted, locked once sent', () => {
  const s = start([1, 2, 3, 4])
  const v: any = riposta.stateForPlayer(s, 1, 0)
  assert.strictEqual(v.myPrompts.length, 2)
  const other: any = riposta.stateForPlayer(s, 2, 0)
  const foreign = other.myPrompts.find((p: any) => !v.myPrompts.some((m: any) => m.mid === p.mid))
  riposta.submit!(s, 1, { kind: 'answer', mid: foreign.mid, text: 'hack' }, 1)
  assert(!JSON.stringify(s.rounds[0]).includes('hack'), "can't answer someone else's prompt")
  riposta.submit!(s, 1, { kind: 'answer', mid: v.myPrompts[0].mid, text: 'pierwsza' }, 1)
  riposta.submit!(s, 1, { kind: 'answer', mid: v.myPrompts[0].mid, text: 'druga' }, 2)
  const again: any = riposta.stateForPlayer(s, 1, 2)
  assert.strictEqual(again.myPrompts[0].answer, 'pierwsza')
})

test('riposta: late answers (after deadline + grace) are rejected', () => {
  const s = start([1, 2, 3])
  const v: any = riposta.stateForPlayer(s, 1, 0)
  riposta.submit!(s, 1, { kind: 'answer', mid: v.myPrompts[0].mid, text: 'za późno' }, 95)
  assert.strictEqual((riposta.stateForPlayer(s, 1, 0) as any).myPrompts[0].answer, null)
})

test('riposta: one Gotowiec per round; timeout fills drafts first, then Gotowce', () => {
  const s = start([1, 2, 3])
  const v: any = riposta.stateForPlayer(s, 1, 0)
  riposta.submit!(s, 1, { kind: 'safety', mid: v.myPrompts[0].mid }, 1)
  riposta.submit!(s, 1, { kind: 'safety', mid: v.myPrompts[1].mid }, 1)
  const after: any = riposta.stateForPlayer(s, 1, 1)
  assert.strictEqual(after.myPrompts[0].safety, true)
  assert.strictEqual(after.myPrompts[1].answer, null, 'second Gotowiec in the same round ignored')
  assert.strictEqual(after.safetyLeft, false)
  riposta.submit!(s, 1, { kind: 'draft', mid: v.myPrompts[1].mid, text: 'niewysłany szkic' }, 5)
  assert.strictEqual(riposta.tick!(s, 90), false, 'writing closes; voting opens (not revealed yet)')
  assert.strictEqual(s.stage, 'vote')
  const all = s.rounds[0].flatMap((d: any) => Object.values(d.answers))
  assert.strictEqual(all.length, 6, 'every author has an answer after the deadline')
  const drafted = s.rounds[0].find((d: any) => d.id === v.myPrompts[1].mid)
  assert.deepStrictEqual(drafted.answers[1], { text: 'niewysłany szkic', safety: false })
})

test('riposta: writing ends early once every active player has answered', () => {
  const s = start([1, 2, 3, 4])
  writeAll(s, [1, 2, 3])
  assert.strictEqual(riposta.tick!(s, 10, { activeIds: [1, 2, 3, 4] }), false)
  assert.strictEqual(s.stage, 'write', 'player 4 still writing')
  riposta.tick!(s, 10, { activeIds: [1, 2, 3] }) // player 4 left the room
  assert.strictEqual(s.stage, 'vote')
})

test('riposta: nothing leaks authors before the reveal (TV and phones)', () => {
  const ids = [11, 12, 13, 14, 15]
  const s = start(ids)
  writeAll(s, ids)
  riposta.tick!(s, 5)
  const tv = JSON.stringify(riposta.publicView!(s, 5, names(ids)))
  for (const id of ids) assert(!tv.includes(`P${id}`), 'no names on TV before reveal')
  assert(!/"pid"|authors/.test(tv))
  const d = s.rounds[0][0]
  const voter = ids.find((p) => !d.authors.includes(p))!
  const phone = JSON.stringify(riposta.stateForPlayer(s, voter, 5, names(ids)))
  for (const id of ids) assert(!phone.includes(`P${id}`), 'no names on a voter phone before reveal')
  assert.strictEqual(JSON.parse(phone).mine, null)
  // and the write stage TV only shows counts
  const s2 = start(ids)
  const tv2 = JSON.stringify(riposta.publicView!(s2, 1, names(ids)))
  assert(!tv2.includes('odp') && !tv2.includes('P1'))
})

test('riposta: voting rules — authors cannot vote, one vote each, audience counted separately', () => {
  const ids = [1, 2, 3, 4]
  const s = start(ids)
  writeAll(s, ids)
  riposta.tick!(s, 5)
  const d = s.rounds[0][0]
  const [a] = d.authors
  const voters = ids.filter((p) => !d.authors.includes(p))
  riposta.submit!(s, a, { kind: 'vote', mid: d.id, choice: 0 }, 6)
  assert.strictEqual(d.votes[a], undefined)
  riposta.submit!(s, voters[0], { kind: 'vote', mid: d.id, choice: 0 }, 6)
  riposta.submit!(s, voters[0], { kind: 'vote', mid: d.id, choice: 1 }, 6)
  assert.strictEqual(d.votes[voters[0]], 0, 'first vote sticks')
  riposta.submit!(s, voters[1], { kind: 'vote', mid: 'stale', choice: 1 }, 6)
  assert.strictEqual(d.votes[voters[1]], undefined, 'vote for another duel ignored')
  riposta.submit!(s, 99, { kind: 'vote', mid: d.id, choice: 1 }, 6) // audience
  riposta.submit!(s, voters[1], { kind: 'vote', mid: d.id, choice: 0 }, 6)
  assert.strictEqual(riposta.tick!(s, 6, { activeIds: [...ids, 99] }), true, 'all players voted → reveal (audience does not block)')
  const pts = riposta.score!(s)
  // 2 player votes for A + audience (weight 1) for B → A 2/3, B 1/3
  assert.deepStrictEqual(pts, { [d.authors[0]]: 670 + 100, [d.authors[1]]: 330 })
  const v: any = riposta.stateForPlayer(s, voters[0], 7, names([...ids, 99]))
  assert.strictEqual(v.phase, 'revealed')
  assert.strictEqual(v.duel.answers[0].name, `P${d.authors[0]}`)
  assert.strictEqual(v.duel.answers[1].audience, 1)
})

test('riposta: identical answers (Telepatia) skip the vote and score 0', () => {
  const s = start([1, 2, 3])
  const d = s.rounds[0][0]
  for (const p of [1, 2, 3]) {
    for (const x of s.rounds[0].filter((q: any) => q.authors.includes(p))) {
      riposta.submit!(s, p, { kind: 'answer', mid: x.id, text: x === d ? (p === d.authors[0] ? 'Żółw' : 'zolw!') : `x${p}${x.id}` }, 1)
    }
  }
  assert.strictEqual(riposta.tick!(s, 2), true)
  assert.deepStrictEqual(riposta.score!(s), { [d.authors[0]]: 0, [d.authors[1]]: 0 })
})

test('riposta: full game — 2 rounds of duels (round 2 doubled), final with tokens, then end', () => {
  const ids = [1, 2, 3, 4]
  const s = start(ids)
  const totals: Record<number, number> = {}
  const add = (pts: Record<number, number>) => {
    for (const [k, v] of Object.entries(pts)) totals[Number(k)] = (totals[Number(k)] ?? 0) + v
  }
  for (const round of [1, 2]) {
    writeAll(s, ids)
    for (let i = 0; i < ids.length; i++) {
      riposta.tick!(s, 2)
      assert.strictEqual(s.stage, 'vote')
      const d = s.rounds[round - 1][s.dIdx]
      for (const p of ids) if (!d.authors.includes(p)) riposta.submit!(s, p, { kind: 'vote', mid: d.id, choice: 0 }, 3)
      assert.strictEqual(riposta.tick!(s, 3), true)
      const pts = riposta.score!(s)
      assert.strictEqual(pts[d.authors[0]], round === 1 ? 1250 : 2500, 'unanimous 2 votes = sweep')
      add(pts)
      assert.strictEqual(riposta.next!(s), true)
    }
  }
  assert.strictEqual(s.round, 3)
  for (const p of ids) {
    const v: any = riposta.stateForPlayer(s, p, 1)
    riposta.submit!(s, p, { kind: 'answer', mid: v.myPrompts[0].mid, text: `final ${p}` }, 1)
  }
  riposta.tick!(s, 2)
  assert.strictEqual(s.stage, 'vote')
  const v1: any = riposta.stateForPlayer(s, 1, 2)
  const own = v1.entries.find((e: any) => e.mine)
  const others = v1.entries.filter((e: any) => !e.mine)
  riposta.submit!(s, 1, { kind: 'tokens', mid: v1.mid, alloc: { [own.id]: 3 } }, 3)
  assert.strictEqual(s.final.tokens[1], undefined, 'no tokens on your own answer')
  riposta.submit!(s, 1, { kind: 'tokens', mid: v1.mid, alloc: { [others[0].id]: 4 } }, 3)
  assert.strictEqual(s.final.tokens[1], undefined, 'max 3 tokens')
  for (const p of ids) {
    const v: any = riposta.stateForPlayer(s, p, 3)
    const target = v.entries.find((e: any) => !e.mine)
    riposta.submit!(s, p, { kind: 'tokens', mid: v.mid, alloc: { [target.id]: 3 } }, 3)
  }
  assert.strictEqual(riposta.tick!(s, 4), true)
  const fpts = riposta.score!(s)
  assert.strictEqual(Object.values(fpts).reduce((a, b) => a + b, 0) >= 4000, true)
  add(fpts)
  assert.strictEqual(riposta.next!(s), false, 'after the final the game ends')
  assert(riposta.awards!(s).length >= 1)
})

test('riposta: GM skip during writing still leaves every duel playable', () => {
  const s = start([1, 2, 3])
  assert.strictEqual(riposta.next!(s), true)
  assert.strictEqual(s.stage, 'vote')
  assert(s.rounds[0].every((d: any) => d.authors.every((p: number) => d.answers[p])))
})

test('riposta: replay clears the votes of the current duel and reopens voting', () => {
  const ids = [1, 2, 3, 4]
  const s = start(ids)
  writeAll(s, ids)
  riposta.tick!(s, 2)
  const d = s.rounds[0][0]
  for (const p of ids) if (!d.authors.includes(p)) riposta.submit!(s, p, { kind: 'vote', mid: d.id, choice: 1 }, 3)
  riposta.tick!(s, 3)
  riposta.replay!(s)
  assert.strictEqual(s.stage, 'vote')
  assert.deepStrictEqual(d.votes, {})
  assert.strictEqual(s.voteAt, 0)
})

test('riposta: prompt bank — unique ids, valid tiers, enough per tier for an 8-player game', () => {
  const all = [...cfg.prompts, ...cfg.finalPrompts]
  assert.strictEqual(new Set(all.map((p: any) => p.id)).size, all.length)
  for (const tier of ['family', 'adult', '18+']) {
    assert(cfg.prompts.filter((p: any) => p.tier === tier).length >= 100, `${tier}: ≥100 prompts`)
    assert(cfg.finalPrompts.filter((p: any) => p.tier === tier).length >= 20, `${tier}: ≥20 finals`)
    assert(cfg.safetyQuips.filter((p: any) => p.tier === tier).length >= 10, `${tier}: ≥10 Gotowce`)
  }
  for (const p of all) {
    assert(['family', 'adult', '18+'].includes(p.tier))
    assert(p.text.length <= 90, p.text)
    assert(!p.text.includes('___'), 'blank is implicit at the end')
  }
  for (const q of cfg.safetyQuips) assert(Array.from(q.text).length <= MAX_ANSWER, q.text)
})
