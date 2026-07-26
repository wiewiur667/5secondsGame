import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import musicImpostor from '../server/games/music-impostor/index.ts'
import fiveSecondRule from '../server/games/five-second-rule/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const musicCfg: string[] = JSON.parse(
  readFileSync(here + '../server/games/music-impostor/music.json', 'utf8'),
)
const questionsCfg = JSON.parse(
  readFileSync(here + '../server/games/five-second-rule/questions.json', 'utf8'),
)

test('music: start with 3 players returns state object', () => {
  const s = musicImpostor.start([1, 2, 3], musicCfg)
  assert.strictEqual(typeof s, 'object')
})

test('music: exactly one impostor, phase playing', () => {
  const s = musicImpostor.start([1, 2, 3], musicCfg) as any
  const views = [1, 2, 3].map((pid) => musicImpostor.stateForPlayer(s, pid, 0))
  assert(views.every((v) => v.phase === 'playing'))
  const vids = views.map((v: any) => v.videoId)
  const uniq = [...new Set(vids)]
  assert.strictEqual(uniq.length, 2, 'exactly two distinct video ids')
  const minorityId = vids.find((v) => vids.filter((x) => x === v).length === 1)
  assert(minorityId, 'exactly one player is the odd-one-out')
  const impostorIdx = vids.indexOf(minorityId)
  assert.strictEqual([1, 2, 3][impostorIdx], s.impostorPid)
})

test('music: no youWereImpostor leak before reveal', () => {
  const s = musicImpostor.start([1, 2, 3], musicCfg) as any
  for (const pid of [1, 2, 3]) {
    const v = musicImpostor.stateForPlayer(s, pid, 0) as any
    assert.strictEqual(v.youWereImpostor, undefined)
  }
})

test('music: tick + reveal flags exactly the impostor', () => {
  const s = musicImpostor.start([1, 2, 3], musicCfg) as any
  assert.strictEqual(musicImpostor.tick!(s, 999), true)
  const views = [1, 2, 3].map((pid) => musicImpostor.stateForPlayer(s, pid, 999) as any)
  assert(views.every((v) => v.phase === 'revealed'))
  const flagged = views.filter((v) => v.youWereImpostor === true)
  assert.strictEqual(flagged.length, 1)
  const flaggedPid = [1, 2, 3][views.findIndex((v) => v.youWereImpostor === true)]
  assert.strictEqual(flaggedPid, s.impostorPid)
})

test('music: 1 player returns error string', () => {
  assert.strictEqual(typeof musicImpostor.start([1], musicCfg), 'string')
})

test('music: <2 valid links returns error string', () => {
  assert.strictEqual(typeof musicImpostor.start([1, 2, 3], ['not-a-youtube-url']), 'string')
})

test('5sr: start with valid category returns state; unknown/empty returns error', () => {
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }), 'object')
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, { categories: ['nope'] }), 'string')
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, {}), 'string')
})

test('5sr: multiple categories pool their questions', () => {
  const one = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  const two = fiveSecondRule.start([1], questionsCfg, { categories: ['couples', 'party'] }) as any
  assert(two.questions.length > one.questions.length)
  assert.strictEqual(two.questions.length, 200) // 100 + 100
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, { categories: [] }), 'string')
})

test('5sr: submit before timer starts is ignored', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.submit!(s, 1, { picks: s.questions[s.idx].correct }, 1)
  assert.strictEqual(s.picks[1], undefined) // timer not started → no answer stored
})

test('5sr: submit correct picks in time scores count', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  const correct: number[] = s.questions[s.idx].correct
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: correct }, 6)
  assert.strictEqual(fiveSecondRule.score!(s)[1], correct.length)
})

test('5sr: picksRequired caps stored picks', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2, 3, 4] }, 6)
  assert(s.picks[1].length <= s.picksRequired)
  assert(fiveSecondRule.score!(s)[1] <= s.picksRequired)
})

test('5sr: late submit is ignored', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 2, { picks: s.questions[s.idx].correct }, 99)
  const score = fiveSecondRule.score!(s)[2]
  assert(score === undefined || score === 0)
})

test('5sr: reveal gates on the closed window + drives auto-advance', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.reveal!(s, 7) // too early (window still open) → ignored
  assert.strictEqual(s.revealed, false)
  assert.strictEqual(fiveSecondRule.autoAdvanceAt!(s), null)
  fiveSecondRule.reveal!(s, s.startedAt + s.timerSeconds + 1) // window closed → reveals
  assert.strictEqual(s.revealed, true)
  assert.strictEqual(fiveSecondRule.tick!(s, 99), true) // scored once revealed
  assert.strictEqual(fiveSecondRule.autoAdvanceAt!(s), s.startedAt + s.timerSeconds + 1 + 10)
})

test('5sr: reveals immediately once every player has FULLY answered', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6)
  assert.strictEqual(s.revealed, false) // only 1 of 2 players answered
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6.5) // well before the 5s window closes
  assert.strictEqual(s.revealed, true)
  assert.strictEqual(s.revealAt, 6.5)
})

test('5sr: GM can disable reveal-on-all-answered (read live, not snapshotted)', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  const off = { revealOnAllAnswered: false }
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6, off)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6.5, off) // everyone answered, but toggle is off
  assert.strictEqual(s.revealed, false) // must wait for timeout or manual reveal
  fiveSecondRule.reveal!(s, s.startedAt + s.timerSeconds + 1)
  assert.strictEqual(s.revealed, true)
})

test('5sr: reveal-on-all-answered toggle applies mid-game, not just at start', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  // Same round object, no restart — GM flips the toggle live between submits.
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6, { revealOnAllAnswered: false })
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6.5, { revealOnAllAnswered: true })
  assert.strictEqual(s.revealed, true) // the live flag at time of the deciding submit wins
})

test('5sr: a partial submission does NOT count as answered for last-player reveal', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6) // full
  fiveSecondRule.submit!(s, 2, { picks: [0] }, 6.5) // partial — only 1 of 3 picks
  assert.strictEqual(s.revealed, false)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1] }, 6.8) // still partial
  assert.strictEqual(s.revealed, false)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 7) // now full
  assert.strictEqual(s.revealed, true)
})

test('5sr: startTimer is ignored before the minimum read time, honored at/after it', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 2) // too early — must read the prompt first
  assert.strictEqual(s.startedAt, null)
  assert.strictEqual((fiveSecondRule.stateForPlayer(s, 1, 2) as any).readWait, 3)
  fiveSecondRule.startTimer!(s, 4.9) // still just under the minimum
  assert.strictEqual(s.startedAt, null)
  fiveSecondRule.startTimer!(s, 5) // minimum reached — now it takes effect
  assert.strictEqual(s.startedAt, 5)
  assert.strictEqual((fiveSecondRule.stateForPlayer(s, 1, 5) as any).readWait, undefined) // no longer awaitingStart
})

test('5sr: read-wait is capped at the answer window on short (speed-round) timers', () => {
  const s = fiveSecondRule.start([1], questionsCfg, {
    categories: ['couples'],
    timerSeconds: 3, // GM-picked speed round, shorter than the usual 5s read-wait
  }) as any
  assert.strictEqual((fiveSecondRule.stateForPlayer(s, 1, 0) as any).readWait, 3) // capped, not 5
  fiveSecondRule.startTimer!(s, 2.9) // still under the 3s cap
  assert.strictEqual(s.startedAt, null)
  fiveSecondRule.startTimer!(s, 3) // cap reached — takes effect (would've needed 5 uncapped)
  assert.strictEqual(s.startedAt, 3)
})

test('5sr: duplicate picks are deduped', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 0, 1] }, 6)
  assert.deepStrictEqual(s.picks[1], [0, 1])
})

test('5sr: next advances idx and returns false past last question', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  const start = s.idx
  assert.strictEqual(fiveSecondRule.next!(s), true)
  assert.strictEqual(s.idx, start + 1)
  while (s.idx < s.questions.length - 1) fiveSecondRule.next!(s)
  assert.strictEqual(fiveSecondRule.next!(s), false)
})
