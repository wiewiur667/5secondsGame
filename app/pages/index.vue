<script setup lang="ts">
import MusicImpostor from '~/components/games/MusicImpostor.vue'
import FiveSecondRule from '~/components/games/FiveSecondRule.vue'
import GmBar from '~/components/GmBar.vue'

const { state, id, register, submit, startTimer, reveal, continueRound, logout } = useHub()
const name = ref('')

function join() {
  const n = name.value.trim()
  if (n) register(n)
}

const ownName = computed(() => name.value.trim())
</script>

<template>
  <main class="wrap">
    <!-- host controls, inline, so the game master plays too -->
    <GmBar v-if="state && state.phase !== 'register' && state.isGm" />

    <!-- register / cold start -->
    <section v-if="!state || state.phase === 'register'" class="card center stack">
      <div class="brand">
        <span class="logo">🎉</span>
        <h1>Party Hub</h1>
        <p class="muted">Join the game on your phone</p>
      </div>
      <input v-model="name" class="field" placeholder="Your name" maxlength="20" @keyup.enter="join" />
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
      <button class="btn logout" @click="logout">Log out</button>
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
      <button class="btn logout" @click="logout">Log out</button>
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
  min-height: 100dvh;
  padding: max(24px, env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.card { width: 100%; max-width: 440px; }
.center { text-align: center; }
.stack { display: flex; flex-direction: column; gap: 16px; }
.block { width: 100%; }
.muted { color: var(--muted); margin: 0; }

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
.block { width: 100%; }
.gmlink { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; margin-top: 4px; }
.logout { align-self: center; min-height: 42px; font-size: 0.95rem; color: var(--muted); background: transparent; border: 1px solid var(--border); margin-top: 4px; }

.trophy { font-size: 56px; }

/* pulsing "waiting" dots */
.dots { display: flex; gap: 8px; justify-content: center; }
.dots span { width: 12px; height: 12px; border-radius: 50%; background: var(--primary); animation: bounce 1.2s infinite ease-in-out; }
.dots span:nth-child(2) { background: var(--accent); animation-delay: 0.15s; }
.dots span:nth-child(3) { background: var(--gold); animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.6; } 40% { transform: translateY(-8px); opacity: 1; } }
</style>
