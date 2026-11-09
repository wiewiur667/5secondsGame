import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import obstaw, { boardSize, comboLabel, makeBoard, maxBet, START_MONEY } from '../server/games/obstaw/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const cfg = JSON.parse(readFileSync(here + '../server/games/obstaw/content.json', 'utf8'))
const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const names = Object.fromEntries(ids.map((i) => [i, `P${i}`]))
const begin = (n = 5, settings: Record<string, any> = {}, questionCount = 0) =>
  obstaw.start(ids.slice(0, n), cfg, { settings, used: new Set(), questionCount }) as any

// Start fresh games and roll until the first turn lands on a field of the wanted
// type (re-rolls on START/arrow stay within the turn).
function fresh(type: string, n = 5, settings: Record<string, any> = {}): any {
  for (let g = 0; g < 1000; g++) {
    const s = begin(n, settings)
    for (let i = 0; i < 6 && s.turn.stage === 'roll'; i++) obstaw.submit!(s, s.turn.performer, { kind: 'roll' }, 0)
    if (s.turn.kind === type && s.turn.stage !== 'roll' && s.turn.stage !== 'revealed') return s
  }
  throw new Error(`never landed on ${type}`)
}

test('obstaw: content is well formed', () => {
  for (const c of cfg.mental) assert.ok(c.valid.length >= c.need && [15, 30, 60].includes(c.sec))
  for (const c of cfg.skill) assert.ok(c.text.length > 10 && [15, 30, 60].includes(c.sec))
  for (const c of cfg.acting) assert.ok(c.first.length === 2 && c.second.length === 2)
  const all = [...cfg.skill, ...cfg.mental, ...cfg.acting].map((c: any) => c.id)
  assert.strictEqual(new Set(all).size, all.length, 'ids are unique')
})

test('obstaw: the board grows with the number of players', () => {
  const sizes = [3, 4, 6, 8, 10].map((n) => makeBoard(n).length)
  assert.deepStrictEqual(sizes, [3, 4, 6, 8, 10].map(boardSize))
  assert.ok(sizes.every((v, i) => i === 0 || v > sizes[i - 1]))
  for (let n = 3; n <= 10; n++) {
    const b = makeBoard(n)
    assert.strictEqual(b[0].t, 'start')
    assert.strictEqual(b.filter((c) => c.t === 'start').length, 1)
    for (const t of ['arrow', 'skill', 'mental', 'acting', 'blind', 'dice']) assert.ok(b.some((c) => c.t === t), `${t} on a ${n}-player board`)
    assert.ok(b.filter((c) => c.t === 'acting').every((c) => c.c >= 0 && c.c < 4))
  }
  assert.strictEqual(comboLabel(0), '1A')
  assert.strictEqual(comboLabel(3), '2B')
})

test('obstaw: start rules (3–10 players, no teams)', () => {
  assert.strictEqual(typeof obstaw.start([1, 2], cfg, {}), 'string')
  const s = begin(12 > ids.length ? 10 : 12)
  assert.strictEqual(s.players.length, 10)
  const t = begin(4, {}, 7)
  assert.strictEqual(t.turnLimit, 7)
  assert.ok(t.players.every((p: number) => t.money[p] === START_MONEY && t.markers[p].length === 3))
  assert.strictEqual(t.bank, 150 * 4)
  assert.strictEqual(begin(4, { bank: 0 }).bankLimited, false)
  assert.strictEqual(maxBet(80), 40)
  assert.strictEqual(maxBet(15), 0)
})

test('obstaw: passing START pays 50 from the bank; landing on START or an arrow re-rolls', () => {
  const s = begin(4)
  const p = s.turn.performer
  s.pos[p] = s.board.length - 1 // any roll passes START
  const bank = s.bank
  const orig0 = Math.random
  Math.random = () => 0.99 // die = 6
  obstaw.submit!(s, p, { kind: 'roll' }, 0)
  Math.random = orig0
  assert.strictEqual(s.money[p], 80 + 50)
  assert.strictEqual(s.bank, bank - 50)
  // landing exactly on START
  const u = begin(4)
  const q = u.turn.performer
  u.board[3] = { t: 'arrow', c: 0 }
  u.pos[q] = 0
  const orig = Math.random
  Math.random = () => 2 / 6 // die = 3
  obstaw.submit!(u, q, { kind: 'roll' }, 0)
  Math.random = orig
  assert.strictEqual(u.turn.stage, 'roll', 'arrow → roll again')
  assert.strictEqual(u.turn.again, 'arrow')
  assert.strictEqual(u.turn.performer, q)
})

test('obstaw: bets are validated and hidden from the TV', () => {
  const t = fresh('skill')
  const tk = t.turn
  const [b, other] = t.players.filter((p: number) => p !== tk.performer)
  assert.strictEqual(tk.stage, 'bet')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 50 }, 1)
  assert.ok(!tk.bets[b], 'over half is rejected')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 15 }, 1)
  assert.ok(!tk.bets[b], 'not a multiple of 10')
  obstaw.submit!(t, tk.performer, { kind: 'bet', yes: true, amount: 10 }, 1)
  assert.ok(!tk.bets[tk.performer], 'performer cannot bet')
  obstaw.submit!(t, b, { kind: 'bet', yes: true, amount: 40 }, 1)
  assert.deepStrictEqual(tk.bets[b], { yes: true, amount: 40 })
  const tv = JSON.stringify(obstaw.publicView!(t, 2, names))
  assert.ok(!tv.includes('"yes"') && !tv.includes('"amount"'), 'no bets on TV before the reveal')
  assert.strictEqual((obstaw.stateForPlayer(t, tk.performer, 2, names) as any).content, null, 'performer cannot peek before bets close')
  assert.ok(other)
})

test('obstaw: the judge (left neighbour) bets by default and can be excluded by a setting', () => {
  const t = fresh('skill', 5)
  const tk = t.turn
  const left = t.players[(t.players.indexOf(tk.performer) + 1) % 5]
  assert.strictEqual(tk.judge, left)
  obstaw.submit!(t, left, { kind: 'bet', yes: true, amount: 10 }, 1)
  assert.ok(tk.bets[left], 'judge bets (as in the original)')
  const u = fresh('skill', 5, { judgeBets: 0 })
  obstaw.submit!(u, u.turn.judge, { kind: 'bet', yes: true, amount: 10 }, 1)
  assert.ok(!u.turn.bets[u.turn.judge])
})

test('obstaw: skill/mental turn settles money like the classic rules; only the judge rules', () => {
  for (const kind of ['skill', 'mental']) {
    const s = fresh(kind, 5)
    const tk = s.turn
    const perf = tk.performer
    const others = s.players.filter((p: number) => p !== perf)
    const [a, b, c] = others
    const bank = s.bank
    const m0 = { ...s.money }
    obstaw.submit!(s, a, { kind: 'bet', yes: true, amount: 40 }, 1)
    obstaw.submit!(s, b, { kind: 'bet', yes: false, amount: 20 }, 1)
    obstaw.submit!(s, c, { kind: 'bet', yes: true, amount: 10 }, 1)
    obstaw.tick!(s, 1000)
    assert.strictEqual(tk.stage, 'ready')
    obstaw.submit!(s, perf, { kind: 'start' }, 31)
    assert.strictEqual(tk.stage, 'act')
    obstaw.submit!(s, perf, { kind: 'done' }, 40)
    assert.strictEqual(tk.stage, 'judge')
    obstaw.submit!(s, perf, { kind: 'ruling', ok: true }, 41)
    assert.strictEqual(tk.stage, 'judge', 'performer cannot rule on themselves')
    obstaw.submit!(s, tk.judge, { kind: 'ruling', ok: true }, 41)
    assert.strictEqual(tk.stage, 'revealed')
    const pool = 70
    const startPay = tk.startPay
    assert.strictEqual(s.money[perf], m0[perf] + pool)
    assert.strictEqual(s.money[a], m0[a] + 40)
    assert.strictEqual(s.money[b], m0[b] - 20)
    assert.strictEqual(s.money[c], m0[c] + 10)
    // bank: pays pool + right bets (40+10), receives the wrong bet (20)
    assert.strictEqual(s.bank, bank - (pool + 50) + 20)
    assert.ok(startPay >= 0)
    const pts = obstaw.score!(s)
    assert.strictEqual(pts[perf], s.money[perf])
    assert.deepStrictEqual(obstaw.score!(s), {}, 'score is idempotent')
  }
})

test('obstaw: a failed task pays out only the right NO bets', () => {
  const s = fresh('skill', 4)
  const tk = s.turn
  const [a, b] = s.players.filter((p: number) => p !== tk.performer)
  obstaw.submit!(s, a, { kind: 'bet', yes: false, amount: 20 }, 1)
  obstaw.submit!(s, b, { kind: 'bet', yes: true, amount: 10 }, 1)
  const m = { ...s.money }
  obstaw.tick!(s, 1000)
  obstaw.submit!(s, tk.performer, { kind: 'start' }, 31)
  obstaw.tick!(s, 1000)
  obstaw.tick!(s, 2000) // act timeout → judge timeout → fail
  assert.strictEqual(tk.success, false)
  assert.strictEqual(s.money[tk.performer], m[tk.performer])
  assert.strictEqual(s.money[a], m[a] + 20)
  assert.strictEqual(s.money[b], m[b] - 10)
})

test('obstaw: blind bet hides the content until bets close', () => {
  const s = fresh('blind', 5)
  const tk = s.turn
  assert.strictEqual(tk.stage, 'choose')
  obstaw.submit!(s, tk.performer, { kind: 'pick', type: 'mental' }, 1)
  assert.strictEqual(tk.task, 'mental')
  const bettor = s.players.find((p: number) => p !== tk.performer && p !== tk.judge)
  assert.strictEqual((obstaw.stateForPlayer(s, bettor, 2, names) as any).content, null)
  obstaw.tick!(s, 1000)
  assert.ok((obstaw.stateForPlayer(s, bettor, 1001, names) as any).content.text)
})

test('obstaw: acting uses markers, the field combo, and never leaks the phrase', () => {
  const s = fresh('acting', 5)
  const tk = s.turn
  const perf = tk.performer
  const partner = s.markers[perf][0]
  obstaw.submit!(s, perf, { kind: 'pick', partner: perf }, 1)
  assert.strictEqual(tk.stage, 'choose', 'cannot pick yourself')
  obstaw.submit!(s, perf, { kind: 'pick', partner }, 1)
  assert.strictEqual(tk.partner, partner)
  assert.ok(!s.markers[perf].includes(partner), 'marker spent')
  assert.notStrictEqual(tk.judge, partner)
  assert.ok(!bettorsInclude(s, partner) && !bettorsInclude(s, perf))
  const c = s.board[tk.field].c
  const card = tk.card
  assert.strictEqual(tk.phrase, `${card.first[c >> 1]} ${card.second[c & 1]}`)
  obstaw.tick!(s, 1000)
  obstaw.submit!(s, perf, { kind: 'start' }, 31)
  assert.ok(!JSON.stringify(obstaw.publicView!(s, 32, names)).includes(tk.phrase))
  assert.strictEqual((obstaw.stateForPlayer(s, partner, 32, names) as any).content, null)
  assert.strictEqual((obstaw.stateForPlayer(s, perf, 32, names) as any).content.text, tk.phrase)
  obstaw.submit!(s, perf, { kind: 'done' }, 40)
  obstaw.submit!(s, tk.judge, { kind: 'ruling', ok: true }, 41)
  const pool = Object.values(tk.bets).reduce((n: number, b: any) => n + b.amount, 0)
  assert.ok(pool >= 0)
  assert.strictEqual(tk.delta[partner] ?? 0, pool, 'partner gets the pool too')
})
function bettorsInclude(s: any, pid: number) {
  return Object.keys(s.turn.bets).map(Number).includes(pid)
}

test('obstaw: acting without markers passes the turn', () => {
  const s = begin(4)
  const perf = s.turn.performer
  s.markers[perf] = []
  const idx = s.board.findIndex((c: any) => c.t === 'acting')
  s.pos[perf] = idx - 1
  s.board[idx].t = 'acting'
  const orig = Math.random
  Math.random = () => 0 // die = 1
  obstaw.submit!(s, perf, { kind: 'roll' }, 0)
  Math.random = orig
  assert.strictEqual(s.turn.skipped, true)
  assert.strictEqual(s.turn.stage, 'revealed')
})

test('obstaw: dice duel needs strictly more; a tie loses', () => {
  for (const [roll, win] of [[[5, 2], true], [[3, 3], false], [[1, 6], false]] as const) {
    const s = fresh('dice', 4)
    const tk = s.turn
    const opp = s.players.find((p: number) => p !== tk.performer)
    const m = { ...s.money }
    obstaw.submit!(s, tk.performer, { kind: 'pick', opponent: opp, stake: 50 }, 1) // above half → ignored
    assert.strictEqual(tk.stage, 'choose')
    const seq = [...roll]
    const orig = Math.random
    Math.random = () => (seq.shift()! - 1) / 6 + 0.01
    obstaw.submit!(s, tk.performer, { kind: 'pick', opponent: opp, stake: 30 }, 1)
    Math.random = orig
    assert.strictEqual(tk.success, win)
    assert.strictEqual(s.money[tk.performer], m[tk.performer] + (win ? 30 : -30))
    assert.strictEqual(s.money[opp], m[opp] + (win ? 0 : 30), 'loser pays the opponent, not the bank')
  }
})

test('obstaw: a limited bank pays out at most what it holds', () => {
  const s = fresh('skill', 4, {})
  s.bank = 30
  const tk = s.turn
  const [a, b] = s.players.filter((p: number) => p !== tk.performer)
  obstaw.submit!(s, a, { kind: 'bet', yes: true, amount: 40 }, 1)
  obstaw.submit!(s, b, { kind: 'bet', yes: true, amount: 40 }, 1)
  obstaw.tick!(s, 1000)
  obstaw.submit!(s, tk.performer, { kind: 'start' }, 31)
  obstaw.submit!(s, tk.performer, { kind: 'done' }, 32)
  obstaw.submit!(s, tk.judge, { kind: 'ruling', ok: true }, 33)
  assert.ok(s.bank >= 0)
  assert.ok(s.bank < 10 || s.bank % 10 === 0)
})

test('obstaw: free number of turns; game also ends on an empty bank or no markers', () => {
  const play = (s: any) => {
    let turns = 1
    for (let guard = 0; guard < 2000; guard++) {
      let t = 0
      for (let i = 0; i < 30 && s.turn.stage !== 'revealed'; i++) obstaw.tick!(s, (t += 100))
      s.players.forEach((p: number) => assert.ok(s.money[p] >= 0))
      if (!obstaw.next!(s)) return turns
      turns++
    }
    return -1
  }
  assert.strictEqual(play(begin(4, { bank: 0 }, 1)), 1)
  assert.strictEqual(play(begin(4, { bank: 0 }, 13)), 13)
  const n = play(begin(4, { bank: 0 }, 0)) // no limit, no bank: only markers can end it
  assert.ok(n > 0, 'ended by markers')
  const s = begin(4, {}, 0)
  s.bank = 0
  assert.strictEqual(obstaw.next!(s), false, 'empty bank ends the game')
  assert.ok(Array.isArray(obstaw.awards!(s)))
})
