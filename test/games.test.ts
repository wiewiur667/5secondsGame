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
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, { category: 'food' }), 'object')
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, { category: 'nope' }), 'string')
  assert.strictEqual(typeof fiveSecondRule.start([1], questionsCfg, {}), 'string')
})

test('5sr: submit correct picks in time scores count', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { category: 'food' }) as any
  const correct: number[] = s.questions[s.idx].correct
  fiveSecondRule.submit!(s, 1, { picks: correct }, 1)
  assert.strictEqual(fiveSecondRule.score!(s)[1], correct.length)
})

test('5sr: picksRequired caps stored picks', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { category: 'food' }) as any
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2, 3, 4] }, 1)
  assert(s.picks[1].length <= s.picksRequired)
  assert(fiveSecondRule.score!(s)[1] <= s.picksRequired)
})

test('5sr: late submit is ignored', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { category: 'food' }) as any
  const correct: number[] = s.questions[s.idx].correct
  fiveSecondRule.submit!(s, 2, { picks: correct }, 99)
  const score = fiveSecondRule.score!(s)[2]
  assert(score === undefined || score === 0)
})

test('5sr: duplicate picks are deduped', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { category: 'food' }) as any
  fiveSecondRule.submit!(s, 1, { picks: [0, 0, 1] }, 1)
  assert.deepStrictEqual(s.picks[1], [0, 1])
})

test('5sr: next advances idx and returns false past last question', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { category: 'food' }) as any
  const start = s.idx
  assert.strictEqual(fiveSecondRule.next!(s), true)
  assert.strictEqual(s.idx, start + 1)
  while (s.idx < s.questions.length - 1) fiveSecondRule.next!(s)
  assert.strictEqual(fiveSecondRule.next!(s), false)
})
