// End-to-end test of Riposta against the PRODUCTION build, over real WebSockets:
// 8 players + 1 audience member play a whole game (2 rounds of duels + final).
//
//   npm run build && npm run e2e
//
// By default it starts its own server from .output/ on a free port and stops it
// afterwards. To run against an already running server instead (this RESETS it —
// everyone gets logged out):  E2E_BASE=http://127.0.0.1:3333 npm run e2e
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`)
  else {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}
const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

// --- server -------------------------------------------------------------------
let server = null
let BASE = process.env.E2E_BASE
if (!BASE) {
  if (!existsSync('.output/server/index.mjs')) {
    console.error('Brak .output/ — najpierw: npm run build')
    process.exit(2)
  }
  const port = await freePort()
  BASE = `http://127.0.0.1:${port}`
  const flagFile = join(mkdtempSync(join(tmpdir(), 'riposta-e2e-')), 'flags.jsonl')
  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), FLAG_FILE: flagFile },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}
const WS = BASE.replace(/^http/, 'ws') + '/ws'
const stop = () => server?.kill()
process.on('exit', stop)

const post = (path, body = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
const gm = () => fetch(BASE + '/api/gm/state').then((r) => r.json())
// Poll until `pred` holds (state changes arrive asynchronously over WS).
async function until(pred, what, ms = 5000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if (await pred()) return true
    } catch {}
    await sleep(50)
  }
  throw new Error(`timeout: ${what}`)
}

for (let i = 0; ; i++) {
  try {
    await gm()
    break
  } catch {
    if (i > 100) throw new Error(`server at ${BASE} not reachable`)
    await sleep(100)
  }
}
console.log(`Riposta e2e → ${BASE}`)

async function joinAs(name) {
  const { id } = await post('/api/register', { name })
  const ws = new WebSocket(WS)
  const c = { name, id, ws, state: null }
  ws.onmessage = (e) => (c.state = JSON.parse(e.data))
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
  ws.send(JSON.stringify({ type: 'hello', id }))
  await until(() => c.state, `${name} got state`)
  return c
}
const send = (c, payload) => c.ws.send(JSON.stringify({ type: 'submit', payload }))
const clients = []

try {
  await post('/api/gm/reset')
  console.log('Lobby i ustawienia')
  for (const n of ['Ala', 'Bartek', 'Celina', 'Darek', 'Ewa', 'Franek', 'Gosia', 'Henio', 'Widz']) clients.push(await joinAs(n))
  const players = clients.slice(0, 8)
  const audience = clients[8]

  await post('/api/gm/select-game', { game: 'riposta' })
  await post('/api/gm/set-option', { key: 'tier', value: '18+' })
  await post('/api/gm/set-option', { key: 'writeSeconds', value: 60 })
  await post('/api/gm/set-option', { key: 'writeSeconds', value: 999 }) // not offered → ignored
  let g = await gm()
  check(g.settings.find((s) => s.key === 'tier')?.value === '18+', 'GM ustawia poziom humoru')
  check(g.settings.find((s) => s.key === 'writeSeconds')?.value === 60, 'wartość spoza listy jest ignorowana')

  // Oversized WS message must be dropped without hurting the server.
  const junk = new WebSocket(WS)
  await new Promise((r) => (junk.onopen = r))
  junk.send('x'.repeat(10_000))
  junk.close()

  const st = await post('/api/gm/start')
  check(st.ok, `start gry ${st.error ? `(${st.error})` : ''}`)
  await until(() => players.every((c) => c.state.phase === 'playing') && audience.state.phase === 'playing', 'phones in game')
  g = await gm()
  check(g.leaderboard.length === 8 && !g.leaderboard.some((r) => r.name === 'Widz'), '9. osoba jest widzem — brak jej w rankingu')
  check(audience.state.role === 'audience' && !audience.state.myPrompts, 'telefon widza: rola widza, bez promptów')
  check(players.every((c) => c.state.myPrompts?.length === 2), 'każdy gracz ma 2 prompty')
  check(!players.some((c) => JSON.stringify(g.live).includes(c.name)), 'TV podczas pisania: bez imion')

  const late = await joinAs('Spóźnialski')
  clients.push(late)
  await until(() => late.state.phase === 'playing', 'late joiner state')
  check(late.state.role === 'audience', 'dołączający w trakcie gry zostaje widzem')

  for (const round of [1, 2]) {
    console.log(`Runda ${round}`)
    // Ala uses a Gotowiec on her first prompt; everyone else writes answers.
    for (const c of players) {
      c.state.myPrompts.forEach((p, i) => {
        if (round === 1 && c.name === 'Ala' && i === 0) send(c, { kind: 'safety', mid: p.mid })
        else send(c, { kind: 'answer', mid: p.mid, text: `odpowiedź ${round}-${i} ${Math.random().toString(36).slice(2, 7)}` }) // no names: the TV anonymity check looks for them
      })
    }
    await until(async () => (await gm()).live?.stage === 'vote', `round ${round} voting opened`)
    check(true, 'pisanie kończy się od razu, gdy wszyscy wyślą')

    for (let i = 0; i < 8; i++) {
      await until(async () => {
        const v = await gm()
        return v.live?.stage === 'vote' && v.live.matchNo === i + 1
      }, `duel ${i + 1} voting`)
      g = await gm()
      const tv = JSON.stringify(g.live)
      const anon = !players.some((c) => tv.includes(`"${c.name}`)) && !tv.includes('"pid"')
      const voters = [...players, audience, late]
      await until(() => voters.every((c) => c.state.stage === 'vote' && c.state.matchNo === i + 1), 'phones on this duel')
      const authors = players.filter((c) => c.state.mine != null)
      check(anon && authors.length === 2, `pojedynek ${i + 1}: TV anonimowe, 2 autorów`)
      // An author's own vote must be ignored.
      send(authors[0], { kind: 'vote', mid: authors[0].state.mid, choice: 0 })
      for (const c of voters) if (c.state.mine == null) send(c, { kind: 'vote', mid: c.state.mid, choice: 0 })
      await until(async () => (await gm()).phase === 'revealed', `duel ${i + 1} revealed`)
      g = await gm()
      const d = g.live.duel
      const totalVotes = d.answers.reduce((n, a) => n + a.voters.length, 0)
      check(totalVotes === 6 && d.answers.every((a) => a.name), `pojedynek ${i + 1}: wynik z imionami, 6 głosów graczy (autorzy nie głosują)`)
      if (round === 1) {
        const ala = d.answers.find((a) => a.name === 'Ala' && a.safety)
        if (ala) check(ala.points % 10 === 0 && ala.points <= 625, 'gotowiec: połowa punktów')
      }
      await post('/api/gm/next')
    }
  }

  console.log('Finał')
  await until(async () => (await gm()).live?.round === 3, 'final started')
  await until(() => players.every((c) => c.state.round === 3 && c.state.myPrompts?.length === 1), 'final prompts on phones')
  for (const c of players) send(c, { kind: 'answer', mid: c.state.myPrompts[0].mid, text: `finał ${Math.random().toString(36).slice(2, 7)}` })
  await until(() => players.every((c) => c.state.stage === 'vote' && c.state.entries), 'final voting')
  const ala = players[0]
  const own = ala.state.entries.find((e) => e.mine)
  send(ala, { kind: 'tokens', mid: ala.state.mid, alloc: { [own.id]: 3 } }) // own answer → rejected
  await sleep(200)
  check(!ala.state.myTokens, 'żetony na własną odpowiedź są odrzucane')
  for (const c of [...players, audience, late]) {
    const target = c.state.entries.find((e) => !e.mine && !e.jinx)
    send(c, { kind: 'tokens', mid: c.state.mid, alloc: { [target.id]: c.state.cap } })
  }
  await until(async () => (await gm()).phase === 'revealed', 'final revealed')
  g = await gm()
  check(g.live.final.entries.length === 8 && g.live.final.entries.some((e) => e.best), 'finał: 8 odpowiedzi, wskazana najlepsza')

  await post('/api/gm/next')
  await until(async () => (await gm()).phase === 'lobby', 'game over')
  g = await gm()
  check(g.finalBoard.length === 8, 'podium: 8 graczy')
  check(g.finalAwards.length >= 1, `nagrody: ${g.finalAwards.map((a) => a.title).join(', ')}`)
  await until(() => players.every((c) => c.state.phase === 'gameover'), 'phones game over')
  check(true, 'telefony pokazują wyniki końcowe')
} catch (e) {
  failed++
  console.error(`  ✗ ${e.message}`)
} finally {
  for (const c of clients) c.ws.close()
  if (process.env.E2E_BASE) await post('/api/gm/reset').catch(() => {})
}

console.log(failed ? `\n${failed} błąd(ów)` : '\nWszystko OK')
stop()
process.exit(failed ? 1 : 0)
