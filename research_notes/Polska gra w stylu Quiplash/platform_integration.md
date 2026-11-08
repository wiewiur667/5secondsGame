# Platform integration: a Quiplash-style game in the Party Hub codebase

Scope: how a Quiplash-style game (write funny answers to prompts → anonymous 1v1 matchups voted by non-authors → results; round 2 multiplier; final round where everyone answers one prompt; "QUIPLASH" all-votes bonus; safety-quip fallback; audience voters beyond the player cap; TV `/board` + phones; GM settings incl. family/adult/18+ tier) would plug into `/home/user/5secondsGame` (Nuxt 4 / Nitro). All "sources" below are files in this repo, cited as `path:line`. Every claim about current behavior was read directly from the code at commit `a031863` (HEAD at research time). The test suite was run: 38/38 pass (`npm test`, Node v22.23.4 in this sandbox — CLAUDE.md says Node 24; type-stripping works on 22.23 too). Game-design facts about Quiplash itself are out of scope here (other researchers cover them); where a design decision depends on them it is marked as an assumption.

---

## 1. How the current platform works (GameModule, hub, registry, WS, composables, /board, game components) and which hooks exist

### Takeaway
The hub is a single in-memory singleton that owns players, sockets, GM role, one round clock, score totals and a 1 s tick; games are pure state machines implementing `GameModule` (`start/tick/next/replay/flag/autoAdvanceAt/startTimer/reveal/submit/score/awards/publicView/stateForPlayer`). The hub's "round" model is "one scored *question* at a time, scored exactly once, then `next()`" — a Quiplash *matchup* maps cleanly onto a hub "question", and multi-stage flow (write → vote → result) can live inside the game's own state, exactly as 5 Second Rule already does with `awaitingStart → answering → revealed`.

### Cited Findings

**GameModule contract** (`server/games/types.ts`)
- `PlayerView` union: `register | waiting(roster,isGm) | gameover(leaderboard,isGm,awards) | playing(game,leaderboard,…any) | revealed(game,leaderboard,…any)` — games attach arbitrary fields to `playing`/`revealed` — `server/games/types.ts:9-14`.
- `start(playerIds, cfg, opts?) → S | string` (string = rejection message shown to GM) — `types.ts:24`.
- `tick?(s, elapsedSec) → boolean` "true once the round is over (triggers reveal + scoring)" — `types.ts:27`. Note: tick receives **no** player list and **no** hub flags.
- `next?(s, playerIds?) → boolean` (false → hub ends game); receives current active ids so games refresh their per-question snapshot — `types.ts:29-32`.
- `replay?(s)`, `flag?(s,pid) → {id,prompt}|null`, `autoAdvanceAt?(s) → seconds|null` — `types.ts:35-42`.
- Any-player hooks `startTimer?(s, elapsedSec, pid?)` and `reveal?(s, elapsedSec)` — `types.ts:44-47`.
- `submit?(s, pid, payload:any, elapsedSec, hubFlags?)` — "The GAME enforces validity server-side (timing, count, dedupe)"; `hubFlags` are live GM toggles, never snapshotted — `types.ts:49-53`.
- `score?(s, hubFlags?) → Record<pid, points>` "Points earned THIS round… Hub applies once on the playing→revealed edge" — `types.ts:55-57`.
- `awards?(s) → GameAward[]`, `publicView?(s, elapsedSec, names)` ("Spectator view for the TV board… without any per-player data"), `stateForPlayer(s, pid, elapsedSec, names?)` ("Never throw for an unknown pid") — `types.ts:59-67`.
- `configFile?` exists on the interface (`types.ts:20`) but the hub does **not** use it: configs are statically imported and hard-mapped in `server/utils/hub.ts:3-4,12-15`. So adding a game currently also requires editing `hub.ts` (CLAUDE.md's "one registry line" is slightly understated).

**Registry** — `server/games/index.ts:6-9` maps `id → module`; `gameList` at `:12` (hub recomputes the same list in `gmState`, `hub.ts:458`).

**Hub** (`server/utils/hub.ts`)
- Singleton on `globalThis.__partyHub` — `hub.ts:489-491`; 1 s `setInterval(tick)` — `hub.ts:52-54`.
- Player = `{name, gone}` only — `hub.ts:19-22`; ids are monotonically increasing `nextId` — `hub.ts:26,94-100`; names trimmed/capped at 20 chars — `hub.ts:95`. No concept of role (player vs. audience).
- `activeIds()` = players not `gone` — `hub.ts:106-108`; `currentGm()` = smallest active id — `hub.ts:115-119`.
- Sockets: `attach(pid, peer)` (unknown pid → `{phase:'register'}`; overwrites stale peer; clears rejoin claim; sends personal state then broadcasts) — `hub.ts:122-138`; `logoutPeer` deletes the player entirely — `hub.ts:140-148`; `detach` only drops the socket, never marks gone — `hub.ts:149-159`; `removePlayer` (GM kick) — `hub.ts:163-173`.
- Rejoin claim map with 8 s TTL closes a TOCTOU race — `hub.ts:29-31,69-87`; used by `server/api/register.post.ts:156-160`.
- GM settings are **bespoke hub fields** with bespoke setters: `autoAdvance`, `revealOnAllAnswered`, `penalizeWrong`, `timerSeconds` (clamped 3–60), `questionLimit` (0–1000), `categories` — `hub.ts:33-42,184-211`; all reset in `reset()` — `hub.ts:213-237`.
- `start()` passes `opts = {names, categories, timerSeconds, questionCount, used}` — `hub.ts:241-247`; initializes `totals` to 0 for **all** active ids if the game has `score` — `hub.ts:255`.
- `next(score=true)`: `applyScore()` first, then `game.next(round, activeIds())`; false → `end()`; late joiners are inserted into totals at the current minimum score ("floor") — `hub.ts:263-286`. Games without `next` get a fresh `start()` instead — `hub.ts:272-280`. `startMs` resets on every `next`, so `elapsedSec` is per-"question" — `hub.ts:281`.
- `skip()` = `next(false)` — `hub.ts:287-289`; `replay()` reverses `lastPts` — `hub.ts:291-305`; `togglePause()` freezes the clock by shifting `startMs` — `hub.ts:306-314`; `adjustScore` — `hub.ts:319-324`.
- `flagByPeer` appends a JSON line `{at, game, id, prompt, by}` to `FLAG_FILE` (env, default `flagged-questions.jsonl`) — `hub.ts:9,325-333`.
- `end()` snapshots `finalBoard` + `finalAwards` (mapping award pids to names) — `hub.ts:334-346`.
- `submit()` is dropped while paused; passes `{revealOnAllAnswered}` as hubFlags; then `settle()` + `broadcast()` — `hub.ts:347-354`. `startTimer`/`reveal` likewise ignore pause — `hub.ts:360-376`. `playerContinue` only works when `!autoAdvance && scored` — `hub.ts:379-381`.
- `applyScore()` guarded by `this.scored`, computes `rankDelta` — `hub.ts:387-404`; `settle()` = `if game.tick() → applyScore()` — `hub.ts:410-412`; `tick()` auto-advances when `autoAdvance && scored && elapsed ≥ autoAdvanceAt` — `hub.ts:413-422`.
- `stateFor(pid)` → per-player view; hub decorates `playing`/`revealed` views with `leaderboard`, `autoAdvance`, `paused`, `isGm` — `hub.ts:431-449`.
- `gmState(port)` → game list, categories (hard-coded `if gameId === 'five-second-rule'`), toggles, phase (`lobby|playing|revealed` derived from `scored`), players, leaderboard, `live: game.publicView(...)`, final board/awards, `joinUrl` — `hub.ts:450-476`.
- `broadcast()` sends `stateFor(pid)` to each peer individually (no pub/sub) — `hub.ts:478-486`.

**Transport**
- `server/routes/ws.ts:6-17`: messages `hello{id}`, `submit{payload}`, `start-timer`, `reveal`, `continue`, `flag`, `logout`; malformed JSON silently ignored; no payload-size check.
- HTTP: `GET /api/state?id=` (poll fallback) — `server/api/state.get.ts`; `POST /api/register` — `server/api/register.post.ts:9-31`; `GET /api/rejoinable` — `server/api/rejoinable.get.ts`; GM: `POST /api/gm/[action]` switch (select-game, select-category, set-auto, set-reveal-on-answer, set-penalty, pause, skip, replay, adjust-score, set-timer, set-length, reset, start, next, end, remove-player) — `server/api/gm/[action].post.ts:4-25`; `GET /api/gm/state` — `server/api/gm/state.get.ts:5-8`. GM endpoints have no auth (CLAUDE.md, accepted tradeoff).

**Client composables**
- `useHub()` — WS with infinite 2 s auto-reconnect, `hello` on connect, `apply()` drops `mi_id` on `register`, 2 s poll of `/api/state` whenever socket not OPEN, `visibilitychange` forced reconnect — `app/composables/useHub.ts:66-106`. Actions: `submit(payload)` (generic, any payload) — `:53-55`; `action(type)` for bare messages — `:56-58`; exports `startTimer/reveal/continueRound/flag/logout` — `:108-120`.
- `useGm()` — polls `/api/gm/state` every 1 s and `post(action, body)` — `app/composables/useGm.ts:22-44`. `GmState` type has 5SR-specific fields (`categories`, `selected`, `timerSeconds`, `questionLimit`) — `useGm.ts:2-21`.

**Pages / components**
- `app/pages/index.vue:126-136` dispatches on `state.game` to `<MusicImpostor>` / `<FiveSecondRule>` with `@submit @start-timer @reveal @continue @flag`; topbar in normal flow — `index.vue:78-84`; wake-lock while in room — `index.vue:58-64`.
- `app/pages/gm.vue`: 5SR-specific settings blocks gated by `state.gameId === 'five-second-rule'` — `gm.vue:8-11,65-115`; flow buttons Next/End/Pause/Skip/Replay — `gm.vue:117-132`.
- `app/pages/board.vue`: uses **`useGm()` polling (1 s)**, not WS — `board.vue:5`; lobby = big SVG QR + roster — `board.vue:29-36`; live section hard-codes 5SR fields (`questionNo`, `stage`, `remaining`, `prompt`, `correct`, `results` with `fast/streak`) — `board.vue:40-77`; leaderboard with rank deltas — `board.vue:79-89`.
- `app/components/games/FiveSecondRule.vue:1-15` — props `{state, meId}`, emits `submit({picks})`, `startTimer`, `reveal`, `continue`, `flag`; local selection mirrors `yourPicks` and resets on `questionNo` change — `:13-16`; client caps picks "too" but server is authoritative — `:25-32`.

**5 Second Rule as the reference implementation** (`server/games/five-second-rule/index.ts`)
- State with per-question snapshot `playerIds`, `startedAt`, `revealed`, `revealAt`, `scoredIdx`, `undo` — `:26-44`.
- `tick` returns `s.revealed` (scoring edge) — `:159-161`; `autoAdvanceAt = revealAt + 10` — `:164-166`; `startTimer` read-wait + starter grace — `:174-179`; `reveal` only after window closes — `:182-187`; `next` refreshes `playerIds` — `:189-195`; `submit` validates membership/timing/range/dedupe/cap and triggers early reveal reading the live hub flag — `:216-249`; `score` idempotent per question via `scoredIdx` — `:253-272`; `publicView` — `:290-315`; `stateForPlayer` with `late` flag for mid-question joiners — `:317-384`.
- Music Impostor shows the per-player-different-view pattern (impostor gets a different `videoId`; `youWereImpostor` only after reveal) — `server/games/music-impostor/index.ts:51-66`.

### Inferences
- **Recommended mapping:** one hub "question" = one Quiplash *matchup* (the unit that is scored once). The *write* stage is folded into the first matchup of each round as an internal sub-phase (like 5SR's `awaitingStart`), with the game tracking its own `phaseStartedAt` in `elapsedSec` units. Flow per hub-question:
  - Matchup 0 of a round: `stage:'write'` (deadline `writeSeconds`) → internal switch to `stage:'vote'` (deadline `voteSeconds`, `phaseStartedAt = elapsedSec`) → `revealed` (tick returns true → hub scores once) → `autoAdvanceAt = revealAt + resultSeconds` → hub `next()` → game `next()` moves to matchup 1 (`stage:'vote'`, since answers already exist) … after the last matchup of the round → optional "round scoreboard" interstitial → next round's write stage. Final round: one shared prompt, `stage:'write'` → `stage:'finalVote'` → revealed.
  - This keeps `applyScore` once-per-matchup, gives per-matchup `rankDelta` on the board for free, and reuses GM Next/Skip/Pause/End unchanged.
- An alternative — modelling write/vote/result each as separate hub questions — would make `tick()` return true at end of write (scoring `{}`), flip `scored`, and make `playerContinue` / phase label "revealed" fire on a non-reveal; worse fit.
- `next()` must return `false` after the final round so the hub's `end()` produces the podium (`hub.ts:268`).
- `replay` for Quiplash: reasonable semantics = "re-run this matchup's vote" (clear votes, keep answers); the hub already undoes points via `lastPts` (`hub.ts:293-297`).

### Gaps
- No hub-level tests exist, so hub behaviors (pause, auto-advance, late-joiner floor) are only verified by reading code (see §6).

---

## 2. What must change in the hub/types for multi-phase rounds, free text, per-player prompt assignment, votes, audience, richer /board, GM settings

### Takeaway
Free text, votes, per-player prompt assignment and multi-phase flow need **no transport or hub changes** — they fit inside `submit(payload:any)` and game state. The real hub/type gaps are: (a) game-specific GM settings (currently hard-coded per-setting hub fields + switch cases + gm.vue `v-if`s), (b) audience/roles (hub assumes every active player scores and pads late joiners into the leaderboard), (c) game liveness info in `tick` (tick gets no active-player list), (d) per-game config loading (hard-coded imports), (e) a game-dispatching /board, and optionally (f) WS push to the board instead of 1 s polling.

### Cited Findings
- `submit` payload is untyped `any` end-to-end: `useHub.submit(payload)` → WS `{type:'submit', payload}` → `hub.submitByPeer` → `game.submit(s, pid, payload, …)` — `app/composables/useHub.ts:53-55`, `server/routes/ws.ts:11`, `server/utils/hub.ts:347-358`, `server/games/types.ts:53`. 5SR's `{picks:number[]}` shape is purely a game convention (`five-second-rule/index.ts:221`).
- Per-player different content is already a first-class pattern (`stateForPlayer` per pid; impostor gets different video) — `server/games/music-impostor/index.ts:63-64`; hub never broadcasts a shared payload — `hub.ts:478-486`.
- Hub only distinguishes `playing`/`revealed` for decoration and GM `phase` — `hub.ts:440,456`; any game-internal stage name can ride in extra fields (5SR uses `stage`, `awaitingStart`, `awaitingReveal`) — `five-second-rule/index.ts:311-314,365,375`.
- Hub-wide totals: all active ids at `start()` get 0 — `hub.ts:255`; at every `next()` any active id not in totals is inserted at the minimum score — `hub.ts:269-271`. → Audience members would appear on the leaderboard and be treated as scorers.
- `tick(s, elapsedSec)` has no player list or flags — `types.ts:27`, called at `hub.ts:411`. 5SR copes because its early reveal happens inside `submit` (which gets hubFlags) — `five-second-rule/index.ts:239-248`.
- GM settings path today: hub field (`hub.ts:38-39`) → setter with clamping (`hub.ts:202-211`) → switch case (`server/api/gm/[action].post.ts:15-16`) → `gmState` field (`hub.ts:466-467`) → `GmState` type (`useGm.ts:11-12`) → bespoke buttons in `gm.vue:79-99` → passed into `start()` opts (`hub.ts:244-245`).
- `gmState.categories` is computed only for `five-second-rule` — `hub.ts:451-454`; `needCategory` start gating is 5SR-specific — `gm.vue:8-11`.
- `/board` live panel renders 5SR field names unconditionally — `board.vue:40-77`.
- `usedQuestions` (no-repeat across games in a session) is a single hub `Set<number>` keyed by question id — `hub.ts:40,246`; 5SR adds to it — `five-second-rule/index.ts:131-136`.

### Inferences — proposed changes (minimal, in priority order)

1. **Game-declared settings (generic).** Add to `GameModule`:
   ```ts
   settings?: Record<string, { type: 'enum'|'int'|'bool'; default: any; values?: string[]; min?: number; max?: number; label: string }>
   ```
   Hub: `gameSettings: Record<string, any>` (reset on `selectGame`/`reset`), one setter `setOption(key, value)` that validates/clamps against the active module's schema, one GM action `set-option` (`[action].post.ts`), expose `settings` + schema in `gmState`, pass `opts.settings` into `start()`. `gm.vue` renders the schema generically (or a `GmQuiplash.vue` block keyed on `gameId`, matching current style). Quiplash settings: `tier: 'family'|'adult'|'18+'` (default `family`), `rounds` (2 + final, or 1–3), `writeSeconds` (e.g. 60–120), `voteSeconds` (10–30), `resultSeconds`, `promptsPerPlayer` (2), `audienceEnabled`, `useOnlinePrompts` (see §5). Leave existing 5SR fields alone to avoid regressions. Important: per CLAUDE.md, *live toggles* that should apply mid-game must be read off the hub per call, never snapshotted; round-structure settings (rounds, tier, timers) are legitimately snapshotted at `start()`.
2. **Roles / audience.** Extend hub `Player` with `role: 'player'|'audience'` (`hub.ts:19-22`), or keep roles inside the game (preferred, less hub surface): the game's `start()` takes the first N≤`maxPlayers` (Quiplash 3–8, assumption from brief) of `playerIds` as contestants, everyone else (and every later joiner) is audience. The hub then needs one hook so it does not pad audience into `totals`:
   ```ts
   scoringIds?(s: S): number[]   // hub uses this instead of activeIds() at hub.ts:255 and :269-271
   maxPlayers?: number           // optional: GM UI / board show "audience" chips
   ```
   Also `minPlayers: 3` is already a field (`types.ts:19`) but the hub never checks it — the game's `start()` must return the Polish error string itself (as Music Impostor does, `music-impostor/index.ts:30`).
3. **Liveness in tick.** Pass live context to `tick` the same way `submit` gets hubFlags: `tick?(s, elapsedSec, ctx?: { activeIds: number[]; connected: number[] })`. Needed so "all contestants answered/voted → advance early" can ignore players who logged out/were kicked (`players.delete` at `hub.ts:145,170`). Alternative without type change: do the early-advance check in `submit` (5SR pattern) and rely on deadlines + safety quips for departed players.
4. **Per-game config loading.** Replace the hard-coded `configs` map (`hub.ts:3-4,12-15`) with a `config` field on the module (static JSON import inside the game folder, so the bundler still inlines it) — then adding Quiplash truly is "folder + one registry line". Keep JSON static imports: the comment at `hub.ts:11` notes "JSON imports are inlined by the bundler — no runtime fs", which matters for the self-contained Docker `.output` (`Dockerfile:10-14`).
5. **Per-game "used" set.** Change `usedQuestions` to `Map<gameId, Set<number>>` (or namespace ids) so Quiplash prompt ids don't collide with 5SR question ids (both are small integers).
6. **Board dispatch.** `board.vue` should dispatch `state.live.game` → `components/board/FiveSecondRuleBoard.vue` / `QuiplashBoard.vue` (move the current 5SR markup out of `board.vue:40-77`). Quiplash TV needs per-stage layouts: write (prompt count + "X/Y wrote" progress, *no* text), vote (prompt + answer A vs B, big), reveal (votes per side with voter names, author names, %/points, "QUIPLASH!" banner), round scoreboard, final (all answers grid, then results). Phones in vote stage show only the two buttons (or the answer texts + buttons).
7. **Optional: board over WS.** The board polls at 1 s (`board.vue:5`, `useGm.ts:40`); reveal animations would be choppy and each poll recomputes `gmState`. Option: a `{type:'hello-board'}` WS message registering a non-player peer set in the hub that receives `publicView` on each `broadcast()`. Not required for v1.
8. **Client.** New `app/components/games/Quiplash.vue` + one `v-else-if="state.game === 'quiplash'"` in `index.vue:126-136`, emitting `submit({kind:'answer'|'vote'|…})`. Text inputs need the existing in-flow layout discipline (CLAUDE.md `.topbar` gotcha) and `maxlength` mirroring the server cap (cf. name input `index.vue:96`).

### Gaps
- Exact Quiplash timings/caps (answer length, vote time, player cap 8, audience size) are game-design facts outside this scope; values above are placeholders.

---

## 3. Server-authoritative checks: where they live and how to apply them to Quiplash

### Takeaway
All rule enforcement belongs in the game module's `submit`/`startTimer`/`reveal`/`tick`, using the hub-supplied `elapsedSec` (hub clock, pause-aware) — the hub only blocks actions while paused and resolves `peer → pid`. Quiplash needs the same discipline for text length/sanitization, prompt ownership, stage/deadline gating, vote eligibility (not an author of either answer, contestant or audience), one-vote-per-voter dedupe, and safety-quip semantics.

### Cited Findings
- Identity is resolved server-side from the socket, never from the payload: `submitByPeer` uses `peerPid.get(peer)` — `hub.ts:355-358`; likewise `startTimerByPeer`, `flagByPeer` — `hub.ts:366-369,325-327`. `reveal`/`continue` are anonymous — `ws.ts:12-13`.
- Pause blocks submit/startTimer/reveal — `hub.ts:348,361,371`; clock is the hub's `elapsed()` — `hub.ts:384-386`.
- 5SR checks: membership in round snapshot — `five-second-rule/index.ts:217`; stage gating — `:218`; deadline vs. server clock — `:219`; integer/range filter — `:220-222`; dedupe + cap — `:223`; overwrite-never-append — `:225`; min read-wait/grace in `startTimer` — `:174-179`; reveal only after window closed — `:183`; score idempotence via `scoredIdx` — `:255`.
- CLAUDE.md: "client-supplied timing is never trusted"; client disabled buttons are UI hints only; live GM toggles read fresh, never snapshotted.
- WS handler does no size limiting before `JSON.parse` — `ws.ts:8`.
- Names are capped at 20 chars server-side — `hub.ts:95`.

### Inferences — Quiplash checks (all in `server/games/quiplash/index.ts`)
- **Answer submit** `{kind:'answer', promptId, text}`:
  - `stage === 'write'` (or `'finalWrite'`) and `elapsedSec <= phaseStartedAt + writeSeconds` (+ small grace, e.g. 1 s, for network latency — explicit and tested).
  - `pid` is a contestant this round, and `promptId` is one of **this pid's assigned** prompts (`assignments[pid]` includes it). Audience can never answer.
  - Text: `String(text)`, normalize (`.normalize('NFC')`), strip control/zero-width chars, collapse whitespace, trim, cap length (e.g. 45–80 chars; mirror in `maxlength`). Reject empty after trim (treat as "no answer").
  - Overwrite allowed until deadline/lock (like 5SR's overwrite), or lock on first submit — pick one and test it.
  - Optional server-side profanity filter only for `tier:'family'` display (do not block, but could mask) — design choice.
  - Early advance: when every *live* contestant has answered all assigned prompts → switch to vote (needs §2.3 liveness or check in `submit`).
- **Safety quip** `{kind:'safety', promptId}`: returns a server-chosen canned answer from the prompt JSON's tier-filtered safety list; mark `answer.safety = true` so scoring can apply the Quiplash safety-quip rule (assumption: reduced/no points — confirm with game-mechanics research). Server picks the text — never accept client text flagged as safety. Also at write deadline, auto-fill missing answers with a safety quip or a "(brak odpowiedzi)" marker so matchups never stall (decision for design; both are deterministic and testable).
- **Vote submit** `{kind:'vote', choice: 0|1}` (or `{kind:'vote', matchupId, choice}` to reject stale votes from a phone still showing the previous matchup):
  - `stage === 'vote'`, `elapsedSec <= phaseStartedAt + voteSeconds`, `matchupId === current`.
  - Voter is not an author of *either* answer in the matchup (`matchup.authors.includes(pid)` → ignore). In the final round, voters cannot vote for their own answer; final-round vote allocation (e.g. multiple votes) validated server-side.
  - Voter must be a registered player (`players.has`) — contestants not in this matchup + audience (separate tallies: `votes` vs `audienceVotes`).
  - Dedupe: `votes[pid] = choice` (map, one per voter; overwrite or first-wins).
  - `Number.isInteger(choice) && (choice === 0 || choice === 1)`.
  - Early reveal when all eligible live contestant voters have voted (audience shouldn't block; Jackbox-style audience is optional and should never hold up the game).
- **Scoring** (pure function of state, idempotent via `scoredMatchup` like 5SR `scoredIdx`): per-vote points × round multiplier (round 2 ×2, final ×3 — assumption), winner bonus, QUIPLASH bonus when one side gets 100% of eligible contestant votes (define whether audience counts and what happens when 0 votes are cast — must be tested), safety-quip modifier, audience votes either converted into a weighted share or a separate bonus. Keep `score()` returning points for contestants only.
- **Transport hardening (small, hub-wide):** reject WS messages over e.g. 2–4 KB before `JSON.parse` in `ws.ts:8` — free-text is the first payload that is user-sized.
- **Never render text with `v-html`.** Current `v-html` use is limited to the SVG QR (`board.vue:23,30,91`, `gm.vue:48`); Vue `{{ }}` interpolation escapes, so answers are XSS-safe as long as that stays true.

### Gaps
- No rate-limiting exists anywhere (trusted LAN); a malicious phone could spam submits. Acceptable per CLAUDE.md's trust model, but worth a cheap per-pid throttle if text is involved.

---

## 4. Per-player state leakage, reconnect, GM reassignment, leaving mid-round

### Takeaway
The per-player view architecture already prevents phone-to-phone leaks, but **`publicView` is served from an unauthenticated endpoint (`/api/gm/state`) that any phone can poll**, so anything in `publicView` is effectively public. Authorship, unrevealed answers and prompt assignments must be absent from both `publicView` and other players' `stateForPlayer` until reveal. Reconnect is already robust (state is rebuilt from scratch on every push); the hard cases are a contestant who logs out/is kicked with prompts assigned, and audience/late joiners.

### Cited Findings
- `gmState().live = game.publicView(...)` — `hub.ts:471`; served by `GET /api/gm/state` with no auth — `server/api/gm/state.get.ts:5-8`; consumed by `/board` and `/gm` — `board.vue:5`, `gm.vue:5`.
- `stateForPlayer` gets the full `names` map — `hub.ts:439`; hub appends leaderboard to `playing`/`revealed` — `hub.ts:440-447`.
- Precedent test for "no leak before reveal": `test/games.test.ts:34-40` (`youWereImpostor` undefined while playing); 5SR TV view test asserts option indices are not exposed — `test/games.test.ts:347-354`.
- Every push is a full recomputed view (`peer.send(JSON.stringify(this.stateFor(pid)))`) — `hub.ts:136,481`; reconnect sends `hello` and the client gets full state — `useHub.ts:75`, `hub.ts:136`; poll fallback returns the same `stateFor` — `state.get.ts`.
- Socket drop does not remove the player or reassign GM — `hub.ts:149-159`; logout/kick deletes the player → GM role moves to next-lowest id — `hub.ts:140-148,163-173,115-119`.
- After deletion, leaderboard shows `'(left)'` for that pid — `hub.ts:425`; `names()` no longer contains them — `hub.ts:101-105`.
- 5SR late-joiner precedent: joiner sees `late:true`, plays from next question; `next(s, playerIds)` refreshes snapshot so leavers stop blocking "everyone answered" — `five-second-rule/index.ts:192,217,333,353`; `test/games.test.ts:395-410`.
- Client keeps local UI state and resets on question change (`watch(questionNo)`) — `FiveSecondRule.vue:13-16`.

### Inferences
- **Leak rules for Quiplash (each deserves a test):**
  - Write stage: a phone sees only *its own* assigned prompts and its own draft/submitted text. `publicView` shows counts ("5/8 wrote") — never prompts-per-player (prompt assignment reveals who will face whom) and never text.
  - Vote stage: phones and `publicView` show prompt + answer texts in a per-matchup **random A/B order** (store the order in state; don't derive from author pid order). No `authorId`, no author names, no "is mine" flag for anyone but the author's own phone. Don't send vote tallies live (would let late voters herd); send only "X voted".
  - Pid-based ids anywhere in a pre-reveal payload are a leak (pids map to names via the leaderboard). Use opaque per-answer ids (index or random string).
  - Reveal: now include authors, voter names per side (Jackbox shows these — design choice), points, QUIPLASH flag.
  - `/api/gm/state` is public → treat `publicView` as public; GM does not need privileged hidden data. If GM ever needs moderation (e.g. hide an offensive answer before it hits the TV), it must be a separate field computed only in a `/gm`-specific path — but with no auth this is still visible to anyone hitting the URL; acceptable on a trusted LAN only.
- **Reconnect:** the phone's draft text is client-only until submitted; on reconnect `stateForPlayer` must return the server-stored submitted text (`yourAnswers[promptId]`), and the component should only overwrite its local textarea when the prompt id changes (mirror `FiveSecondRule.vue:13-16`), else a reconnect mid-typing would wipe a draft. Consider submitting drafts on blur / debounced so a locked phone doesn't lose work (server keeps last text; deadline still enforced).
- **GM reassignment mid-round:** harmless — GM is only a UI role; Quiplash state should never key behavior on `isGm`. Stage advancement must not depend on the GM's phone (use deadlines + any-player Continue, like 5SR).
- **Contestant leaves (logout/kick) with prompts assigned:** at write deadline the missing answer is auto-filled (safety quip or "no answer") so the opponent's matchup still runs; scoring rule for a forfeit must be defined (e.g. opponent gets the win/QUIPLASH or reduced points). Leaver is excluded from "all answered/all voted" early-advance (needs live ids — §2.3). Their totals row remains as `(left)` (current hub behavior).
- **Socket drop (phone locked):** player remains a contestant; deadlines keep the game moving; safety quip fills the gap. Don't wait on disconnected sockets for early-advance either — use `hub.peers.has(pid)` via a ctx parameter if early-advance should ignore them (design choice; 5SR waits only on the snapshot).
- **Joining mid-game:** joiner becomes audience until the game ends (prompt assignment is fixed per round; Jackbox semantics — assumption). Also beyond `maxPlayers` at start → audience. Hub `next()` must not pad them into totals (§2.2).
- **Rejoin as same name** (`register.post.ts` + claims) restores the same pid → retains contestant role and assignments automatically, since all game state is keyed by pid.

### Gaps
- Whether audience members should be able to become GM if all contestants leave: currently GM = min active id regardless; harmless but untested.

---

## 5. Content loading (questions.json + flagging) and a tiered prompt JSON; optional online/LLM prompts

### Takeaway
5SR content is a static JSON bundled at build time and flagged to an append-only JSONL file; a Quiplash `prompts.json` with per-prompt `tier` and a per-tier safety-quip list can mirror it exactly. LLM-generated prompts must be strictly optional: server-side, env-gated, time-boxed, validated, cached ahead of `start()` (which is synchronous), and always falling back to the bundled JSON so the LAN/offline game never depends on the internet.

### Cited Findings
- `questions.json` top-level keys: `version, timerSeconds, picksRequired, categories`; each category `{id, name, questions:[{id, prompt, options[6], correct[3]}]}` (verified by parsing the file; first question id 1, category `couples` "Dla Par").
- Imported statically into the hub bundle — `hub.ts:4,12-15`, comment "JSON imports are inlined by the bundler — no runtime fs" — `hub.ts:11`.
- Category selection: multi-select toggles in hub — `hub.ts:184-189`; pooled at start, unused-first then used, limited by `questionCount`, ids added to `used` — `five-second-rule/index.ts:127-136`; covered by tests `test/games.test.ts:61-73,297-308`.
- Flagging: `flag(s,pid)` once per player per question → `{id,prompt}` — `five-second-rule/index.ts:209-214`; hub appends `{at, game, id, prompt, by}` JSONL to `FLAG_FILE` — `hub.ts:9,325-333`; file is git-ignored — `.gitignore` (last lines); test `test/games.test.ts:384-393`.
- CLAUDE.md: ids unique across categories; content quality rules (distractors unambiguously wrong).
- Runtime is self-contained `.output` in `node:24-alpine`, no `node_modules` at runtime — `Dockerfile:10-14`; package has no LLM SDK dependency — `package.json` dependencies (`@vueuse/core`, `nuxt`, `qrcode`, `vue`). Node 24 has global `fetch`, so an HTTP call needs no new dependency.
- `start()` is synchronous (`types.ts:24`), but the GM HTTP handler is already `async` (`server/api/gm/[action].post.ts:4-5`), so an `await` before `hub.start()` would be possible there.

### Inferences
- **Proposed `server/games/quiplash/prompts.json`:**
  ```json
  {
    "version": 1,
    "tiers": [
      {"id": "family", "name": "Rodzinny"},
      {"id": "adult",  "name": "Dla dorosłych"},
      {"id": "18+",    "name": "18+"}
    ],
    "prompts": [{"id": 1, "text": "…", "tier": "family", "tags": ["jedzenie"]}],
    "finalPrompts": [{"id": 9001, "text": "…", "tier": "family"}],
    "safetyQuips": [{"id": 1, "text": "…", "tier": "family"}]
  }
  ```
  Tier selection is **cumulative** (`adult` = family+adult; `18+` = all) — so the pool never runs dry at higher tiers; enforce `family` never includes adult content. Unique ids across all arrays (as in 5SR). Validation test: every prompt has a valid tier, unique id, non-empty text under a length cap, enough prompts per tier for max players × prompts-per-player × rounds without repeats, and ≥N safety quips per tier.
- **Prompt assignment** (pure, seeded-shuffle-testable): N contestants, each round N prompts, each prompt given to exactly 2 players, each player gets exactly 2 prompts, and no two players share both prompts (a cyclic pairing i ↔ i+1 mod N achieves this for N≥3). Unused-first selection exactly like 5SR's `used` set (`five-second-rule/index.ts:132-136`) with a per-game set (§2.5).
- **Flagging:** implement `flag(s,pid)` returning `{id, prompt}` for the current prompt — the hub's JSONL logging works unchanged and records `game:'quiplash'`. Optionally a second flag kind for *answers* (offensive player text) — that would need a new hub path or a game-defined return shape, since `flag` returns `{id, prompt}` only (`types.ts:39`).
- **Optional LLM prompts (online, gated):**
  - Gate: env var (e.g. `QUIPLASH_LLM_KEY` / provider-specific key) **and** a GM setting `useOnlinePrompts` (default off); `gmState` exposes `onlineAvailable` (key present) so the GM toggle is disabled offline.
  - Where: a server-only module `server/games/quiplash/llm.ts` called **asynchronously ahead of start** (on `select-game`/toggle on, or `await`ed in the async GM `start` handler with a hard timeout ~5–8 s), storing results in a hub/game cache; `start()` stays synchronous and simply merges `cache[tier]` with the static pool.
  - Validation of generated prompts: JSON-schema shape, length cap, dedupe vs. static prompts, Polish language, tier label respected; for `family`, drop anything failing a keyword blocklist. Mark generated prompts with negative/namespaced ids (`'gen-…'`) so flags in `FLAG_FILE` can be distinguished.
  - Fallback: any error, timeout, empty result, or no network → bundled JSON silently (log server-side). Never send keys or raw LLM output to clients before validation. The game must be fully playable with the feature compiled in but unconfigured — test with no env var.
  - The same hook could later generate safety quips or AI "filler" answers for odd player counts; keep it behind the same gate.

### Gaps
- Which LLM provider/model and its Polish-humor quality were not evaluated here (no network research performed in this scope). Provider choice and API details should be verified at implementation time.

---

## 6. How tests are written and what tests a Quiplash module would need

### Takeaway
Tests are pure-function tests of game modules with `node:test` + `node:assert`, loading JSON via `readFileSync`, driving the module with hand-chosen `elapsedSec` values — no hub, no HTTP, no browser. The hub itself is not importable under plain Node (directory import + JSON import), so hub changes needed for Quiplash (settings, audience/scoringIds, tick ctx) currently can't be unit-tested without a small refactor.

### Cited Findings
- Imports and config loading: `test/games.test.ts:1-14` (`node:test`, `node:assert`, `readFileSync` of `music.json` / `questions.json`, direct `.ts` imports of modules).
- Style: direct calls with synthetic clocks, e.g. `fiveSecondRule.startTimer!(s, 5); fiveSecondRule.submit!(s, 1, {picks}, 9.5)` — `test/games.test.ts:81-87`; leak test — `:34-40`; live-toggle-not-snapshotted tests — `:129-147`; idempotent scoring — `:238-246`; out-of-range input — `:248-253`; late joiner — `:395-410`; TV view shape — `:347-354`; randomness-flake fix noted in commit `13d6060` ("fix ~5% random failure").
- 38 tests, all pass, ~145 ms (ran `npm test` in this session).
- `npm test` = `node --test` discovering `test/*.test.ts` — `package.json` scripts; CLAUDE.md single-test pattern `node --test --test-name-pattern="…"`.
- Importing the hub under Node fails: `ERR_UNSUPPORTED_DIR_IMPORT … '/server/games' is not supported resolving ES modules imported from …/server/utils/hub.ts` (verified in this session); `hub.ts:1` imports `'../games'` (directory) and `hub.ts:3-4` import JSON without import attributes; the constructor also starts a `setInterval` (`hub.ts:53`) that would keep a test process alive.

### Inferences — test list for `test/quiplash.test.ts` (same style)
- **Content:** prompts.json schema (ids unique, tiers valid, lengths), enough prompts per tier for 8 players × rounds, safety quips per tier, cumulative tier filter (family never contains adult/18+).
- **start():** `<3` players → Polish error string; `>maxPlayers` → extras become audience; tier respected; no prompt repeats within a game; `used` set honored across games.
- **Assignment:** each contestant gets exactly K prompts, each prompt exactly 2 authors, no pair shares two prompts, deterministic under a seeded RNG (inject RNG to avoid the kind of random flake fixed in `13d6060`).
- **Write stage:** answer before/after deadline; answer for a prompt not assigned to you ignored; audience answer ignored; length cap + trim + control-char strip; empty → not counted; overwrite semantics; early switch to vote when all contestants answered; missing answers auto-filled at deadline (safety/no-answer).
- **Safety quip:** server-chosen text, flagged `safety`, scoring modifier applied.
- **Vote stage:** author of either answer can't vote; non-integer/out-of-range choice ignored; one vote per voter (dedupe/overwrite); stale `matchupId` ignored; late vote ignored; audience votes tallied separately and don't block early reveal; early reveal when all eligible voters voted.
- **Scoring:** round multiplier (R1 ×1, R2 ×2, final ×3 — per final design), QUIPLASH bonus at 100% of eligible votes, 0-votes edge case, forfeit by departed author, `score()` idempotent per matchup, `replay` clears votes and allows rescoring once.
- **Leaks:** before reveal, no view (`stateForPlayer` for every pid incl. audience, and `publicView`) contains author pids/names, other players' prompt assignments, or answer texts during write; A/B order not correlated with author id; vote tallies hidden until reveal; after reveal authors present.
- **Flow:** `next()` walks matchups → round 2 → final → returns `false`; `autoAdvanceAt` only after reveal; `stateForPlayer` never throws for unknown pid (contract `types.ts:65-66`).
- **Live toggles:** any mid-game toggle (e.g. auto-advance, reveal-on-all-voted) read from hubFlags/ctx, not snapshotted — mirror `test/games.test.ts:129-147`.
- **Hub tests (enabling refactor):** export the `Hub` class separately from the singleton, change `'../games'` → `'../games/index.ts'`-compatible import or inject the registry/configs, and make the interval opt-in; then test `scoringIds` padding, `set-option` validation/clamping, and that `publicView` reaches `gmState.live`.

### Gaps
- No front-end/component or end-to-end tests exist in the repo, so UI behavior (draft preservation on reconnect, board layouts) would be verified manually against the prod build (CLAUDE.md: dev-mode WebSockets are flaky during HMR).
