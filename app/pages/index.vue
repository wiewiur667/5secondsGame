<script setup lang="ts">
import { useWakeLock } from '@vueuse/core'
import MusicImpostor from '~/components/games/MusicImpostor.vue'
import FiveSecondRule from '~/components/games/FiveSecondRule.vue'
import Riposta from '~/components/games/Riposta.vue'

const { state, id, offline, register, rejoinable, submit, startTimer, reveal, continueRound, flag, logout } = useHub()
const { muted, toggleMute } = useFeedback()
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

// Passing a seat = take back a disconnected player's place (tap-to-rejoin).
async function join(seat?: { id: number; name: string }) {
  const n = (seat?.name ?? name.value).trim()
  if (!n) return
  joinError.value = ''
  awaitingGmRedirect = true
  const res = await register(n, seat?.id)
  if (!res.ok) {
    awaitingGmRedirect = false
    joinError.value =
      res.reason === 'rejoin'
        ? 'To imię należy do rozłączonego gracza — dotknij go poniżej, aby wrócić, albo wybierz inne.'
        : 'To imię jest zajęte — wybierz inne.'
    loadSeats()
  }
}

const ownName = computed(() => name.value.trim())

// Seats of disconnected players, listed on the register screen while it's open.
// Skipped for a returning phone that still holds its id (its state arrives in a moment).
const seats = ref<{ id: number; name: string }[]>([])
const showSeats = computed(() => (!state.value || state.value.phase === 'register') && id.value == null)
async function loadSeats() {
  seats.value = await rejoinable()
}
let seatTimer: ReturnType<typeof setInterval> | undefined
watch(showSeats, (on) => {
  clearInterval(seatTimer)
  if (!on) return (seats.value = [])
  if (!import.meta.client) return
  loadSeats()
  seatTimer = setInterval(loadSeats, 3000)
}, { immediate: true })
onScopeDispose(() => clearInterval(seatTimer))

// Keep the screen on while in the room — a locked phone drops out mid-question.
// (Browsers only expose this on https/localhost; on plain-http LAN it's a no-op.)
const wake = useWakeLock()
watch(
  () => !!state.value && state.value.phase !== 'register',
  (inRoom) => (inRoom ? wake.request('screen').catch(() => {}) : wake.release()),
  { immediate: true },
)
onScopeDispose(() => wake.release())

// Game screens (potentially tall/scrollable) start at the top; the simple
// register/lobby/gameover cards stay vertically centered like before.
const isGameScreen = computed(() => state.value?.phase === 'playing' || state.value?.phase === 'revealed')

function doLogout() {
  if (confirm('Wylogować się? Opuścisz grę i będziesz musiał dołączyć ponownie.')) logout()
}
</script>

<template>
  <main class="wrap" :class="{ 'wrap-top': isGameScreen }">
    <!-- in-flow (not floating) so it always reserves space — never overlaps game content -->
    <div v-if="state && state.phase !== 'register'" class="topbar">
      <a v-if="state.isGm" href="/gm" class="topbar-link">🎛️ Panel gospodarza</a>
      <button class="corner-logout" :aria-label="muted ? 'Włącz dźwięk' : 'Wyłącz dźwięk'" @click="toggleMute">
        {{ muted ? '🔇' : '🔊' }}
      </button>
      <button class="corner-logout" @click="doLogout">Wyloguj</button>
    </div>
    <div v-if="offline && state && state.phase !== 'register'" class="offline" role="status">
      📡 Brak połączenia — łączę ponownie…
    </div>

    <!-- register / cold start -->
    <section v-if="!state || state.phase === 'register'" class="card center stack">
      <div class="brand">
        <span class="logo">🎉</span>
        <h1>Party Hub</h1>
        <p class="muted">Dołącz do gry na swoim telefonie</p>
      </div>
      <input v-model="name" class="field" placeholder="Twoje imię" maxlength="20" @keyup.enter="join()" />
      <p v-if="joinError" class="join-err">{{ joinError }}</p>
      <button class="btn btn-primary block" :disabled="!ownName" @click="join()">Dołącz do imprezy</button>
      <div v-if="seats.length" class="stack seats">
        <p class="muted">Wracasz do gry? Dotknij swojego imienia:</p>
        <div class="roster">
          <button v-for="s in seats" :key="s.id" class="chip seat" @click="join(s)">{{ s.name }}</button>
        </div>
      </div>
    </section>

    <!-- lobby -->
    <section v-else-if="state.phase === 'waiting'" class="card center stack">
      <div class="dots"><span /><span /><span /></div>
      <h2>Czekamy na mistrza gry…</h2>
      <p class="muted">Jesteś w grze. Poczekaj chwilę — zaraz się zacznie.</p>
      <div class="roster">
        <span v-for="p in state.roster" :key="p" class="chip" :class="{ me: p === ownName }">{{ p }}</span>
      </div>
      <p class="count">Graczy w pokoju: {{ state.roster.length }}</p>
    </section>

    <!-- game over — podium, final scores, awards -->
    <section v-else-if="state.phase === 'gameover'" class="card center stack">
      <h2>Wyniki końcowe</h2>
      <FinalScores :board="state.leaderboard" :awards="state.awards" :me-id="id" />
      <p class="muted">Czekamy na następną grę…</p>
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
      @flag="flag"
    />
    <Riposta
      v-else-if="state.game === 'riposta'"
      :state="state"
      :me-id="id"
      @submit="submit"
      @continue="continueRound"
      @flag="flag"
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
.offline {
  width: 100%; max-width: 480px; margin-bottom: 8px; padding: 8px 12px; text-align: center;
  font-size: 0.9rem; font-weight: 600; color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, var(--surface-2)); border: 1px solid var(--warn); border-radius: var(--r-sm);
}
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
.seat { cursor: pointer; color: var(--text); font-size: 1rem; }
.seat:active { transform: scale(0.96); }
.count { color: var(--muted); font-size: 0.9rem; margin: 0; }

/* pulsing "waiting" dots */
.dots { display: flex; gap: 8px; justify-content: center; }
.dots span { width: 12px; height: 12px; border-radius: 50%; background: var(--primary); animation: bounce 1.2s infinite ease-in-out; }
.dots span:nth-child(2) { background: var(--accent); animation-delay: 0.15s; }
.dots span:nth-child(3) { background: var(--gold); animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.6; } 40% { transform: translateY(-8px); opacity: 1; } }
</style>
