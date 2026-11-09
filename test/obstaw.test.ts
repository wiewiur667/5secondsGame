import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import obstaw, { maxBet, START_MONEY } from '../server/games/obstaw/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const cfg = JSON.parse(readFileSync(here + '../server/games/obstaw/content.json', 'utf8'))
const ids = [1, 2, 3, 4, 5]
const names = Object.fromEntries(ids.map((i) => [i, `P${i}`]))
const begin = (n = 5) => obstaw.start(ids.slice(0, n), cfg, { settings: {}, used: new Set() }) as any

const bettorsOf = (s: any) => s.players.filter((p: number) => ![s.turn.performer, s.turn.partner, s.turn.judge].includes(p))

test('obstaw: content is well formed', () => {
  for (const c of cfg.mental) {
    assert.ok(c.valid.length >= c.need, `mental ${c.id}: enough valid answers`)
    assert.ok([15, 30, 60].includes(c.sec))
  }
  for (const c of cfg.skill) assert.ok(c.text.length > 10 && [15, 30, 60].includes(c.sec))
  for (const c of cfg.acting) assert.ok(c.first.length === 2 && c.second.length === 2)
  const all = [...cfg.skill, ...cfg.mental, ...cfg.acting].map((c: any) => c.id)
  assert.strictEqual(new Set(all).size, all.length, 'ids are unique')
})

test('obstaw: start rules', () => {
  assert.strictEqual(typeof obstaw.start([1, 2, 3], cfg, {}), 'string')
  const s = begin(5)
  assert.strictEqual(s.total, 15) // 5 players × 3 rounds
  assert.strictEqual(obstaw.scoringIds!(s).length, 5)
  assert.ok(s.players.every((p: number) => s.money[p] === START_MONEY))
  assert.strictEqual(maxBet(80), 40)
  assert.strictEqual(maxBet(25), 10)
})

test('obstaw: bets are validated and hidden from the TV', () => {
  let t = begin()
  while (t.turn.kind !== 'skill') t = begin() // skill: bettors = everyone but performer and judge
  const [b] = bettorsOf(t)
  const other = bettorsOf(t)[1]
  assert.strictEqual(t.turn.stage, 'bet')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 50 }, 1) // > half of 80
  assert.ok(!t.turn.bets[b], 'over the limit is rejected')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 15 }, 1)
  assert.ok(!t.turn.bets[b], 'not a multiple of 10')
  obstaw.submit!(t, t.turn.performer, { kind: 'bet', yes: true, amount: 10 }, 1)
  assert.ok(!t.turn.bets[t.turn.performer], 'performer cannot bet')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 40 }, 1)
  assert.deepStrictEqual(t.turn.bets[b], { yes: true, amount: 40 })
  const tv = JSON.stringify(obstaw.publicView!(t, 2, names))
  assert.ok(!tv.includes('"yes"') && !tv.includes('"amount"'), 'no bets on TV before the reveal')
  assert.strictEqual((obstaw.stateForPlayer(t, t.turn.performer, 2, names) as any).content, null, 'performer cannot peek before bets close')
  obstaw.submit!(t, other, { kind: 'bet', yes: false, amount: 20 }, 2)
})

test('obstaw: skill turn settles money like the classic bet rules', () => {
  let s = begin(5)
  while (s.turn.kind !== 'skill') s = begin(5)
  const perf = s.turn.performer
  const [a, b, c] = bettorsOf(s).filter((p: number) => p !== s.turn.judge)
  obstaw.submit!(s, a, { kind: 'bet', yes: true, amount: 40 }, 1)
  obstaw.submit!(s, b, { kind: 'bet', yes: false, amount: 20 }, 1)
  obstaw.submit!(s, c, { kind: 'bet', yes: true, amount: 10 }, 1)
  obstaw.tick!(s, 1000) // bets lock (all in or timeout)
  assert.strictEqual(s.turn.stage, 'ready')
  obstaw.submit!(s, perf, { kind: 'start' }, 31)
  assert.strictEqual(s.turn.stage, 'act')
  obstaw.submit!(s, perf, { kind: 'done' }, 40)
  assert.strictEqual(s.turn.stage, 'judge')
  obstaw.submit!(s, perf, { kind: 'ruling', ok: true }, 41) // the performer cannot judge themselves
  assert.strictEqual(s.turn.stage, 'judge')
  obstaw.submit!(s, s.turn.judge, { kind: 'ruling', ok: true }, 41)
  assert.strictEqual(s.turn.stage, 'revealed')
  assert.strictEqual(s.money[perf], 80 + 70, 'performer takes the whole pool')
  assert.strictEqual(s.money[a], 80 + 40)
  assert.strictEqual(s.money[b], 80 - 20)
  assert.strictEqual(s.money[c], 80 + 10)
  const pts = obstaw.score!(s)
  assert.strictEqual(pts[perf], 80 + 70) // first report includes the starting money
  assert.deepStrictEqual(obstaw.score!(s), {}, 'score is idempotent')
})

test('obstaw: mental turn is judged by the server', () => {
  let s = begin(4)
  while (s.turn.kind !== 'mental') s = begin(4)
  const perf = s.turn.performer
  obstaw.tick!(s, 1000)
  obstaw.submit!(s, perf, { kind: 'start' }, 31)
  const card = s.turn.card
  for (const v of card.valid.slice(0, card.need)) obstaw.submit!(s, perf, { kind: 'answer', text: v.toUpperCase() }, 40)
  assert.strictEqual(s.turn.stage, 'revealed')
  assert.strictEqual(s.turn.success, true)
  let f = begin(4)
  while (f.turn.kind !== 'mental') f = begin(4)
  obstaw.tick!(f, 1000)
  obstaw.submit!(f, f.turn.performer, { kind: 'start' }, 31)
  obstaw.submit!(f, f.turn.performer, { kind: 'answer', text: 'zzzzz' }, 32)
  assert.ok(obstaw.tick!(f, 31 + 60), 'time runs out → fail')
  assert.strictEqual(f.turn.success, false)
})

test('obstaw: acting phrase never reaches the TV or the partner before the reveal', () => {
  let s = begin(5)
  while (s.turn.kind !== 'acting') s = begin(5)
  const perf = s.turn.performer
  const partner = s.players.find((p: number) => p !== perf)
  obstaw.submit!(s, perf, { kind: 'pick', partner }, 1)
  assert.strictEqual(s.turn.partner, partner)
  assert.notStrictEqual(s.turn.judge, partner)
  assert.notStrictEqual(s.turn.judge, perf)
  const phrase = s.turn.phrase
  obstaw.tick!(s, 1000)
  obstaw.submit!(s, perf, { kind: 'start' }, 31)
  assert.ok(!JSON.stringify(obstaw.publicView!(s, 32, names)).includes(phrase))
  assert.strictEqual((obstaw.stateForPlayer(s, partner, 32, names) as any).content, null)
  assert.strictEqual((obstaw.stateForPlayer(s, perf, 32, names) as any).content.text, phrase)
  assert.strictEqual((obstaw.stateForPlayer(s, s.turn.judge, 32, names) as any).content.text, phrase)
  obstaw.submit!(s, perf, { kind: 'done' }, 40)
  obstaw.submit!(s, s.turn.judge, { kind: 'ruling', ok: true }, 41)
  const pool = Object.values(s.turn.bets).reduce((n: number, b: any) => n + b.amount, 0)
  assert.strictEqual(s.money[perf], 80 + pool)
  assert.strictEqual(s.money[partner], 80 + pool, 'partner gets the pool too')
})

test('obstaw: dice duel', () => {
  let s = begin(4)
  while (s.turn.kind !== 'dice') s = begin(4)
  const perf = s.turn.performer
  const opp = s.players.find((p: number) => p !== perf)
  obstaw.submit!(s, perf, { kind: 'pick', opponent: opp, stake: 50 }, 1) // above half → ignored
  assert.strictEqual(s.turn.stage, 'choose')
  obstaw.submit!(s, perf, { kind: 'pick', opponent: opp, stake: 30 }, 1)
  assert.strictEqual(s.turn.stage, 'revealed')
  const [a, b] = s.turn.dice
  assert.notStrictEqual(a, b)
  if (a > b) assert.strictEqual(s.money[perf], 110)
  else {
    assert.strictEqual(s.money[perf], 50)
    assert.strictEqual(s.money[opp], 110)
  }
})

test('obstaw: whole game ends after every player had their turns; broke players are topped up', () => {
  const s = begin(4)
  let turns = 1
  for (;;) {
    for (let i = 0; i < 12 && s.turn.stage !== 'revealed'; i++) obstaw.tick!(s, 10_000)
    s.players.forEach((p: number) => assert.ok(s.money[p] >= 0))
    if (!obstaw.next!(s)) break
    turns++
    assert.ok(s.players.every((p: number) => s.money[p] >= 20), 'bank top-up')
  }
  assert.strictEqual(turns, 12)
  assert.ok(Array.isArray(obstaw.awards!(s)))
})
