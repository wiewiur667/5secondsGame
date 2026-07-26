<script setup lang="ts">
import MusicImpostor from '~/components/games/MusicImpostor.vue'
import FiveSecondRule from '~/components/games/FiveSecondRule.vue'

const { state, id, register, submit, startTimer, reveal, continueRound, logout } = useHub()
const name = ref('')
const joinError = ref('')

// The player who becomes GM (first to join) is sent straight to the control
// panel. Only fires right after THIS join — not on every later state push.
let awaitingGmRedirect = false
watch(state, (v) => {
  if (!awaitingGmRedirect) return
  awaitingGmRedirect = false // consume on the first state push after join, GM or not
  if (v?.isGm) navigateTo('/gm')
})

async function join() {
  const n = name.value.trim()
  if (!n) return
  joinError.value = ''
  awaitingGmRedirect = true
  const res = await register(n)
  if (!res.ok) {
    awaitingGmRedirect = false
    joinError.value =
      res.reason === 'declined' ? 'Pick a different name, or rejoin under that one.' : 'That name is taken — try another.'
  }
}

const ownName = computed(() => name.value.trim())

// Game screens (potentially tall/scrollable) start at the top; the simple
// register/lobby/gameover cards stay vertically centered like before.
const isGameScreen = computed(() => state.value?.phase === 'playing' || state.value?.phase === 'revealed')

function doLogout() {
  if (confirm("Log out? You'll leave the game and need to rejoin.")) logout()
}
</script>

<template>
  <main class="wrap" :class="{ 'wrap-top': isGameScreen }">
    <!-- in-flow (not floating) so it always reserves space — never overlaps game content -->
    <div v-if="state && state.phase !== 'register'" class="topbar">
      <a v-if="state.isGm" href="/gm" class="topbar-link">🎛️ Host panel</a>
      <button class="corner-logout" @click="doLogout">Log out</button>
    </div>

    <!-- register / cold start -->
    <section v-if="!state || state.phase === 'register'" class="card center stack">
      <div class="brand">
        <span class="logo">🎉</span>
        <h1>Party Hub</h1>
        <p class="muted">Join the game on your phone</p>
      </div>
      <input v-model="name" class="field" placeholder="Your name" maxlength="20" @keyup.enter="join" />
      <p v-if="joinError" class="join-err">{{ joinError }}</p>
      <button class="btn btn-primary block" :disabled="!ownName" @click="join">Join the party</button>
    </section>

    <!-- lobby -->
    <section v-else-if="state.phase === 'waiting'" class="card center stack">
      <div class="dots"><span /><span /><span /></div>
      <h2>Waiting for the game master…</h2>
      <p class="muted">You're in. Sit tight — the game's about to start.</p>
      <div class="roster">
        <span v-for="p in state.roster" :key="p" class="chip" :class="{ me: p === ownName }">{{ p }}</span>
      </div>
      <p class="count">{{ state.roster.length }} in the room</p>
    </section>

    <!-- game over — final scores -->
    <section v-else-if="state.phase === 'gameover'" class="card center stack">
      <div class="trophy">🏆</div>
      <h2>Final Scores</h2>
      <ol class="lb">
        <li v-for="(row, i) in state.leaderboard" :key="row.id" :class="{ me: row.id === id }">
          <span class="rank">{{ i + 1 }}</span>
          <span class="nm">{{ row.name }}</span>
          <span class="sc">{{ row.score }}</span>
        </li>
      </ol>
      <p class="muted">Waiting for the next game…</p>
    </section>

    <!-- in a game -->
    <MusicImpostor v-else-if="state.game === 'music-impostor'" :state="state" />
    <FiveSecondRule
      v-else-if="state.game === 'five-second-rule'"
      :state="state"
      :me-id="id"
      @submit="submit"
      @start-timer="startTimer"
      @reveal="reveal"
      @continue="continueRound"
    />
  </main>
</template>

<style scoped>
.wrap {
  position: relative;
  min-height: 100dvh;
  /* iOS Chrome's floating toolbar overlaps content and its
     safe-area-inset-bottom reporting lags the toolbar's actual state (a
     known WKWebView quirk, unlike Safari) — don't rely on it alone, add a
     real fixed buffer beneath so the last button is never covered. */
  padding: max(14px, env(safe-area-inset-top)) 16px calc(48px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
/* game screens can be tall/scrollable — top-align so overflow scrolls down,
   not so centering hides the top of content on a short viewport */
.wrap-top { justify-content: flex-start; }
.topbar { width: 100%; max-width: 480px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 8px; }
.topbar-link {
  min-height: 36px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  text-decoration: none;
}
.corner-logout {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.85rem;
  color: var(--muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
}
.corner-logout:active { transform: scale(0.96); }
.card { width: 100%; max-width: 440px; }
.center { text-align: center; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.block { width: 100%; }
.muted { color: var(--muted); margin: 0; }
.join-err { color: var(--danger); margin: -8px 0 0; font-size: 0.9rem; }

.brand { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 4px; }
.logo { font-size: 52px; line-height: 1; }
.brand h1 {
  font-size: 40px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.roster { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.chip { font-family: var(--font-display); font-weight: 600; padding: 8px 14px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); }
.chip.me { border-color: var(--success); background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); color: #d7ffe9; }
.count { color: var(--muted); font-size: 0.9rem; margin: 0; }

.trophy { font-size: 56px; }

/* pulsing "waiting" dots */
.dots { display: flex; gap: 8px; justify-content: center; }
.dots span { width: 12px; height: 12px; border-radius: 50%; background: var(--primary); animation: bounce 1.2s infinite ease-in-out; }
.dots span:nth-child(2) { background: var(--accent); animation-delay: 0.15s; }
.dots span:nth-child(3) { background: var(--gold); animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.6; } 40% { transform: translateY(-8px); opacity: 1; } }
</style>
