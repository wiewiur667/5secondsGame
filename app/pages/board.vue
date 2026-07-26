<script setup lang="ts">
import { computed } from 'vue'

// Passive display — no controls. Meant for a TV/projector: big, no interaction.
const { gm: state } = useGm()
const qr = useQrCode(computed(() => state.value?.joinUrl))

const gameName = computed(() => state.value?.games.find((g) => g.id === state.value?.gameId)?.name)
</script>

<template>
  <div v-if="state" class="board">
    <header class="top">
      <span class="brand">🎉 Party Hub</span>
      <span v-if="gameName" class="game">{{ gameName }}</span>
    </header>

    <!-- lobby: big QR so the room can scan and join -->
    <section v-if="state.phase === 'lobby'" class="join center">
      <div v-if="qr" class="qr" v-html="qr" />
      <div class="url">{{ state.joinUrl }}</div>
      <div class="roster">
        <span v-for="p in state.players" :key="p.id" class="chip" :class="{ gone: p.gone }">{{ p.name }}</span>
      </div>
      <p class="hint">{{ state.players.length }} joined — scan to play</p>
    </section>

    <!-- in a game / between rounds: hero leaderboard -->
    <section v-else class="lbwrap">
      <ol class="lb">
        <li v-for="(row, i) in state.leaderboard" :key="row.id" :class="{ top: i === 0 && row.score > 0 }">
          <span class="rank">{{ row.score > 0 ? (['🥇', '🥈', '🥉'][i] || i + 1) : i + 1 }}</span>
          <span class="nm">{{ row.name }}</span>
          <span class="sc">{{ row.score }}</span>
        </li>
        <li v-if="!state.leaderboard.length" class="empty">No scores yet</li>
      </ol>
      <div class="foot">
        <div v-if="qr" class="qr-sm" v-html="qr" />
        <span class="url-sm">{{ state.joinUrl }}</span>
      </div>
    </section>
  </div>
  <div v-else class="board center">Loading…</div>
</template>

<style scoped>
.board {
  min-height: 100dvh;
  padding: 3vh 4vw;
  display: flex;
  flex-direction: column;
  gap: 3vh;
  box-sizing: border-box;
}
.center { align-items: center; justify-content: center; display: flex; font-size: 2rem; color: var(--muted); }

.top { display: flex; align-items: center; justify-content: space-between; }
.brand { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3vw, 2.5rem); }
.game {
  font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.5rem);
  padding: 8px 20px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--accent);
}

.join { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3vh; }
.qr { width: clamp(220px, 24vw, 420px); height: clamp(220px, 24vw, 420px); border-radius: 16px; background: #fff; padding: 16px; }
.qr :deep(svg) { width: 100%; height: 100%; display: block; }
.url { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3.5vw, 3rem); color: var(--accent); }
.roster { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; max-width: 900px; }
.chip { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 1.6vw, 1.4rem); padding: 10px 20px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); }
.chip.gone { opacity: 0.35; text-decoration: line-through; }
.hint { color: var(--muted); font-size: clamp(1rem, 1.5vw, 1.3rem); margin: 0; }

.lbwrap { flex: 1; display: flex; flex-direction: column; gap: 2vh; }
.lb { flex: 1; list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1.2vh; overflow-y: auto; }
.lb li {
  display: flex; align-items: center; gap: 24px;
  padding: 1.6vh 2vw; border-radius: 18px;
  background: var(--surface); border: 1px solid var(--border);
}
.lb li.top { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, var(--surface)); box-shadow: 0 0 40px -12px var(--gold); }
.lb .rank { width: clamp(40px, 4vw, 64px); text-align: center; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3vw, 2.5rem); }
.lb .nm { flex: 1; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3.2vw, 2.8rem); }
.lb .sc { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 3.2vw, 2.8rem); color: var(--primary); }
.lb .empty { justify-content: center; color: var(--muted); font-size: clamp(1.2rem, 2vw, 1.8rem); background: none; border: none; }

.foot { display: flex; align-items: center; gap: 16px; opacity: 0.75; }
.qr-sm { width: 64px; height: 64px; border-radius: 8px; background: #fff; padding: 4px; }
.qr-sm :deep(svg) { width: 100%; height: 100%; display: block; }
.url-sm { font-family: var(--font-display); font-size: 1.1rem; color: var(--muted); }
</style>
