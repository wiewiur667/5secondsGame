# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Nuxt 4 / Nitro LAN party-game hub ("Party Hub"). Players join from phones, the first player to join is the game master (GM). Two games: Music Impostor and 5 Second Rule (600 Polish questions across 6 categories). All state is in-memory — one party session per server process; restart to reset.

## Commands

```bash
npm test                                          # Node built-in runner (node --test), discovers test/*.test.ts
node --test --test-name-pattern="5sr: reveal"     # single test by name pattern
npm run build                                     # Nuxt/Nitro build → .output/
HOST=0.0.0.0 PORT=3333 node .output/server/index.mjs   # prod run — use this for real play
npm run dev                                       # dev on 0.0.0.0:3333 with QR (has --publicURL baked in)
docker compose up -d --build                      # NAS/Docker deploy
```

- Tests run as native TypeScript via Node 24 type-stripping — no flags, no framework, plain `node:test` + `assert`.
- **Run the prod build for actual play.** Dev-mode WebSockets are flaky: the Nitro dev worker drops WS upgrades during HMR reloads ("No worker available").
- `postinstall` runs `patch-package`: `patches/vue-router+5.2.0.patch` null-guards an unconditional upstream crash (`instance.__vrv_devtools` on a null component instance — a mobile-Safari timing race present in every vue-router 5.2.0 dist build). The Dockerfile copies `patches/` **before** `npm ci` so the build-stage install can apply it — keep that order.

## Architecture

### Hub / game-module seam
`server/utils/hub.ts` is a singleton stored on `globalThis` (survives dev HMR). It owns everything game-agnostic: players map, WS peers, GM role, round clock (`startMs`/`elapsed()`), score totals, 1s tick loop, broadcast. Games implement `GameModule` (`server/games/types.ts` — `start/tick/next/submit/score/stateForPlayer` plus any-player hooks `startTimer`/`reveal`) and register in `server/games/index.ts`.

**Adding a game** = a folder under `server/games/<id>/` (module + config JSON) + one registry line + one Vue component in `app/components/games/` dispatched on `state.game`.

### Per-player state — never a shared broadcast
`hub.stateFor(pid)` builds a personalized `PlayerView` for each phone (Music Impostor sends the impostor a *different* videoId than everyone else). The hub keeps `Map<pid, peer>` and calls `peer.send()` per player; crossws channel pub/sub is deliberately not used — a shared payload would leak/break per-player views.

### Transport
WebSocket (`server/routes/ws.ts` ↔ `app/composables/useHub.ts`): client sends `{type:'hello', id}` to bind its socket to a registered player; actions are small typed messages (`submit`, `start-timer`, `reveal`, `continue`, `logout`). Fallback: 2s polling of `GET /api/state?id=` whenever the socket isn't OPEN, plus a `visibilitychange` listener that forces reconnect when a locked phone wakes. Player id lives in localStorage `mi_id`; a stale/unknown id gets `{phase:'register'}` back and the client re-prompts for a name.

### Server-authoritative game rules
All validity checks run server-side against the hub's own clock — client-supplied timing is never trusted. This covers: the answer-submit window, pick count caps + dedupe, late-submit rejection, and the minimum read-wait before `startTimer` takes effect (5s, capped at the GM's chosen answer window). Client-side disabled buttons/labels are UI hints only.

**Live GM toggles** (`autoAdvance`, `revealOnAllAnswered`) are read fresh off the hub on every call (`tick`/`submit` receive them as arguments) — never snapshotted into round state. A snapshot once made a toggle silently dead mid-game; don't reintroduce that.

### GM model
GM = earliest-registered *active* player, computed live by `currentGm()`. It reassigns on explicit logout/kick, but deliberately **not** on socket drop — phones lock constantly, and `detach()` keeps the player in the game (the WS auto-reconnects). GM endpoints (`server/api/gm/[action].post.ts`) have no auth — an accepted tradeoff for trusted-LAN play. Pages: `/` (player), `/gm` (host controls; the GM is auto-redirected here after joining), `/board` (read-only TV leaderboard). All poll/share state via `useGm`/`useHub` composables.

### 5 Second Rule question flow
Per question (`server/games/five-second-rule/index.ts`): `awaitingStart` (Start disabled for `readWait` seconds) → any player presses Start → answer window (`timerSeconds`, GM-configurable 3–60s) → reveal via any-player button after timeout, **or early** as soon as every player in the round-start `playerIds` snapshot has submitted a *full* `picksRequired`-length answer → `revealed` interstitial (scores applied exactly once, guarded by `scored`) → auto-advance 10s later (toggleable) or an any-player Continue button.

The register/rejoin flow uses a claims map (`hub.claimRejoin` + TTL) to close a TOCTOU race where two browsers could claim the same disconnected player's name concurrently — don't simplify it into a plain check-then-grant.

### Question content
`server/games/five-second-rule/questions.json`: 6 Polish categories × 100 questions; `correct` = exactly 3 indices into exactly 6 `options`. Scoring is exact-index auto-match, so distractors are deliberately same-topic near-misses that must remain **unambiguously wrong** — when editing questions, a distractor a reasonable player could defend as valid is a scoring bug, not a nit. `server/games/music-impostor/music.json` = YouTube URLs; ≥2 required or `start` fails.

## Gotchas

- QR codes must stay SVG (`app/composables/useQrCode.ts` + `v-html`) — canvas `toDataURL` silently produces nothing on restricted embedded browsers (Fire TV Silk).
- If phones can't reach the server on LAN, suspect router client/AP isolation; a mobile hotspot bypasses it.
- Keep the player-page top controls (`.topbar`) in normal document flow — an absolute-positioned button previously floated over and covered the game timer.
