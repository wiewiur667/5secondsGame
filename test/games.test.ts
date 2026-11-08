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
  fiveSecondRule.submit!(s, 1, { picks: correct }, 9.5) // late in the window → base points only, no speed bonus
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

// --- scoring bonuses, starter rotation, shuffle, deck limits, awards, results ---

const startSolo = (opts: any = {}) =>
  fiveSecondRule.start([1], questionsCfg, { categories: ['couples'], ...opts }) as any
const wrongPicks = (s: any) => {
  const ok = new Set<number>(s.questions[s.idx].correct)
  return s.questions[s.idx].options.map((_: string, i: number) => i).filter((i: number) => !ok.has(i)).slice(0, 3)
}
// Plays one question: Start at 5s, answer at `at`s (default late → no speed bonus), score, advance.
function play(s: any, picks: number[], at = 9.5): number {
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks }, at)
  const pts = fiveSecondRule.score!(s)[1]
  fiveSecondRule.next!(s)
  return pts
}

test('5sr: a perfect answer in the first half of the window earns a +1 speed bonus', () => {
  const fast = startSolo()
  fiveSecondRule.startTimer!(fast, 5)
  fiveSecondRule.submit!(fast, 1, { picks: fast.questions[0].correct }, 6) // 1s into a 5s window
  assert.strictEqual(fiveSecondRule.score!(fast)[1], 4)

  const slow = startSolo()
  fiveSecondRule.startTimer!(slow, 5)
  fiveSecondRule.submit!(slow, 1, { picks: slow.questions[0].correct }, 9) // 4s in
  assert.strictEqual(fiveSecondRule.score!(slow)[1], 3)
})

test('5sr: 3 perfect answers in a row earn a streak bonus; a miss resets it', () => {
  const s = startSolo()
  const pts = [1, 2, 3, 4].map(() => play(s, s.questions[s.idx].correct))
  assert.deepStrictEqual(pts, [3, 3, 4, 4]) // bonus from the 3rd perfect answer on
  assert.strictEqual(play(s, wrongPicks(s)), 0)
  assert.strictEqual(play(s, s.questions[s.idx].correct), 3) // streak restarted
})

test('5sr: score() is idempotent per question (streaks advance once)', () => {
  const s = startSolo()
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: s.questions[0].correct }, 9.5)
  fiveSecondRule.score!(s)
  assert.strictEqual(fiveSecondRule.score!(s)[1], 3)
  assert.strictEqual(s.streaks[1], 1)
  assert.strictEqual(s.stats[1].perfect, 1)
})

test('5sr: out-of-range or non-integer picks are discarded', () => {
  const s = startSolo()
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 99, -1, 1.5] }, 6)
  assert.deepStrictEqual(s.picks[1], [0])
})

test('5sr: answers are locked once the answers are revealed', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6.5) // everyone full → revealed
  fiveSecondRule.submit!(s, 1, { picks: [3, 4, 5] }, 7) // too late to change
  assert.deepStrictEqual(s.picks[1], [0, 1, 2])
})

test('5sr: the starter rotates per question; others wait a grace period', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5, 2) // not the starter on question 1 → too early
  fiveSecondRule.startTimer!(s, 8.9, 2)
  assert.strictEqual(s.startedAt, null)
  const starterView = fiveSecondRule.stateForPlayer(s, 1, 2, { 1: 'Ania', 2: 'Bartek' }) as any
  const otherView = fiveSecondRule.stateForPlayer(s, 2, 2, { 1: 'Ania', 2: 'Bartek' }) as any
  assert.strictEqual(starterView.youStart, true)
  assert.strictEqual(otherView.youStart, false)
  assert.strictEqual(otherView.starterName, 'Ania')
  assert.strictEqual(otherView.startWait, starterView.startWait + 4)
  fiveSecondRule.startTimer!(s, 9, 2) // grace over → anyone may start
  assert.strictEqual(s.startedAt, 9)

  const t = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.next!(t) // question 2 → player 2 is the starter
  fiveSecondRule.startTimer!(t, 5, 1)
  assert.strictEqual(t.startedAt, null)
  fiveSecondRule.startTimer!(t, 5, 2)
  assert.strictEqual(t.startedAt, 5)
})

test('5sr: each phone gets its own stable option order, reset per question', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  const all = s.questions[0].options.map((_: string, i: number) => i)
  const v1 = fiveSecondRule.stateForPlayer(s, 1, 0) as any
  assert.deepStrictEqual([...v1.order].sort(), all) // a permutation of the options
  assert.deepStrictEqual((fiveSecondRule.stateForPlayer(s, 1, 3) as any).order, v1.order) // stable on re-render
  assert.deepStrictEqual(v1.options, s.questions[0].options) // content (and scoring indices) untouched
  fiveSecondRule.next!(s)
  assert.deepStrictEqual(s.order, {})
})

test('5sr: question limit and no repeats across games in a session', () => {
  const used = new Set<number>()
  const a = startSolo({ questionCount: 10, used })
  const b = startSolo({ questionCount: 10, used })
  assert.strictEqual(a.questions.length, 10)
  const aIds = new Set(a.questions.map((q: any) => q.id))
  assert(b.questions.every((q: any) => !aIds.has(q.id)))
  const c = startSolo({ questionCount: 95, used }) // 80 fresh + 15 repeats
  assert.strictEqual(c.questions.length, 95)
  assert.strictEqual(used.size, 100)
  assert.strictEqual(startSolo({ questionCount: 0 }).questions.length, 100) // 0 = all
})

test('5sr: players see how many have answered', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [0, 1, 2] }, 6)
  const v = fiveSecondRule.stateForPlayer(s, 2, 6) as any
  assert.deepStrictEqual([v.answered, v.total], [1, 2])
})

test('5sr: reveal lists everyone with picks, points and bonuses', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  const q = s.questions[0]
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: q.correct }, 6) // perfect + fast
  fiveSecondRule.submit!(s, 2, { picks: [...wrongPicks(s).slice(0, 2), q.correct[0]] }, 6.5) // 1 right
  const v = fiveSecondRule.stateForPlayer(s, 2, 6.5, { 1: 'Ania', 2: 'Bartek' }) as any
  assert.strictEqual(v.phase, 'revealed')
  assert.deepStrictEqual([v.gained, v.points], [1, 1])
  assert.deepStrictEqual(v.results.map((r: any) => [r.name, r.points, r.fast]), [['Ania', 4, true], ['Bartek', 1, false]])
  assert.strictEqual(v.results[0].picks.every((p: any) => p.ok), true)
  assert.strictEqual(v.results[1].picks.filter((p: any) => p.ok).length, 1)
  assert.strictEqual((fiveSecondRule.publicView!(s, 6.5, { 1: 'Ania', 2: 'Bartek' }) as any).correct.length, 3)
})

test('5sr: awards go to the perfect, fastest and streakiest players', () => {
  const s = startSolo()
  assert.deepStrictEqual(fiveSecondRule.awards!(s), []) // nothing scored yet
  for (let i = 0; i < 3; i++) {
    fiveSecondRule.startTimer!(s, 5)
    fiveSecondRule.submit!(s, 1, { picks: s.questions[s.idx].correct }, 6)
    fiveSecondRule.score!(s)
    fiveSecondRule.next!(s)
  }
  const awards = fiveSecondRule.awards!(s)
  assert.deepStrictEqual(awards.map((a) => a.pid), [1, 1, 1])
  assert.deepStrictEqual(awards.map((a) => a.detail), ['3× komplet', 'śr. 1.0 s', '3 z rzędu'])
})

test('5sr: TV view exposes the question and answered count, not option indices', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  const reading = fiveSecondRule.publicView!(s, 1, { 1: 'Ania', 2: 'Bartek' }) as any
  assert.deepStrictEqual([reading.stage, reading.starterName, reading.total], ['reading', 'Ania', 2])
  fiveSecondRule.startTimer!(s, 5)
  assert.strictEqual((fiveSecondRule.publicView!(s, 6, {}) as any).stage, 'answering')
  assert.strictEqual((fiveSecondRule.publicView!(s, 11, {}) as any).stage, 'closed')
})

test('5sr: penalty toggle — wrong picks cancel right ones, floored at 0 (read live)', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  const q = s.questions[0]
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: [q.correct[0], ...wrongPicks(s).slice(0, 2)] }, 9) // 1 right, 2 wrong
  fiveSecondRule.submit!(s, 2, { picks: [q.correct[0], q.correct[1], wrongPicks(s)[0]] }, 9) // 2 right, 1 wrong
  const on = fiveSecondRule.score!(s, { penalizeWrong: true })
  assert.deepStrictEqual([on[1], on[2]], [0, 1])
  const t = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(t, 5)
  fiveSecondRule.submit!(t, 1, { picks: [t.questions[0].correct[0], ...wrongPicks(t).slice(0, 2)] }, 9)
  assert.strictEqual(fiveSecondRule.score!(t, { penalizeWrong: false })[1], 1) // off → plain count
})

test('5sr: replay re-asks the question and undoes its streak/stats effects', () => {
  const s = startSolo()
  play(s, s.questions[s.idx].correct) // q1 perfect → streak 1
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: s.questions[s.idx].correct }, 6)
  fiveSecondRule.score!(s) // q2 perfect+fast → streak 2
  assert.deepStrictEqual([s.streaks[1], s.stats[1].perfect, s.stats[1].fastN], [2, 2, 2])
  fiveSecondRule.replay!(s)
  assert.deepStrictEqual([s.streaks[1], s.stats[1].perfect, s.stats[1].fastN, s.scoredIdx], [1, 1, 1, -1])
  assert.deepStrictEqual([s.startedAt, s.revealed, s.picks, s.flaggedBy], [null, false, {}, []])
  assert.strictEqual(s.idx, 1) // same question
  assert.strictEqual(play(s, s.questions[s.idx].correct), 3) // can be scored again, once
})

test('5sr: flag is logged once per player per question and resets on next', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  const f = fiveSecondRule.flag!(s, 1)
  assert.deepStrictEqual(f, { id: s.questions[0].id, prompt: s.questions[0].prompt })
  assert.strictEqual(fiveSecondRule.flag!(s, 1), null)
  assert.ok(fiveSecondRule.flag!(s, 2))
  assert.strictEqual(s.flaggedBy.length, 2)
  fiveSecondRule.next!(s)
  assert.deepStrictEqual(s.flaggedBy, [])
})

test('5sr: a late joiner watches the current question and plays from the next one', () => {
  const s = fiveSecondRule.start([1], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6) // pid 2 is not in this question
  assert.strictEqual(s.picks[2], undefined)
  const v = fiveSecondRule.stateForPlayer(s, 2, 6) as any
  assert.deepStrictEqual([v.phase, v.late, v.awaitingStart], ['playing', true, undefined])
  assert.strictEqual((fiveSecondRule.stateForPlayer(s, 1, 6) as any).late, false)
  fiveSecondRule.next!(s, [1, 2]) // hub passes the live roster
  assert.deepStrictEqual(s.playerIds, [1, 2])
  assert.strictEqual((fiveSecondRule.stateForPlayer(s, 2, 0) as any).late, false)
  fiveSecondRule.next!(s, [2]) // player 1 left → no longer blocks "everyone answered"
  fiveSecondRule.startTimer!(s, 5, 2)
  fiveSecondRule.submit!(s, 2, { picks: [0, 1, 2] }, 6)
  assert.strictEqual(s.revealed, true)
})

test('5sr: swapping one full answer for another restarts the speed-bonus clock', () => {
  const s = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any // 2 players → no early reveal
  const q = s.questions[0]
  fiveSecondRule.startTimer!(s, 5)
  fiveSecondRule.submit!(s, 1, { picks: wrongPicks(s) }, 5.2) // blind 3 at 0.2s
  fiveSecondRule.submit!(s, 1, { picks: q.correct }, 9.8) // corrected at 4.8s of 5s
  assert.strictEqual(fiveSecondRule.score!(s)[1], 3) // no ⚡

  const t = fiveSecondRule.start([1, 2], questionsCfg, { categories: ['couples'] }) as any
  fiveSecondRule.startTimer!(t, 5)
  fiveSecondRule.submit!(t, 1, { picks: t.questions[0].correct }, 6)
  fiveSecondRule.submit!(t, 1, { picks: [...t.questions[0].correct].reverse() }, 9.8) // same set re-sent
  assert.strictEqual(fiveSecondRule.score!(t)[1], 4) // keeps the original time
})
