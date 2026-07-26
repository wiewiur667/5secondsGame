<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'

// Full-page host controls. Shares state/actions with the inline GmBar.
const { gm: state, startError, post } = useGm()
const qr = ref('')

// Regenerate QR only when joinUrl changes.
watch(
  () => state.value?.joinUrl,
  async (url) => {
    if (url) qr.value = await QRCode.toDataURL(url)
  },
)

const needCategory = computed(
  () => state.value?.gameId === 'five-second-rule' && !state.value?.selected?.length,
)
const startDisabled = computed(() => !state.value?.gameId || needCategory.value)
</script>

<template>
  <div v-if="state" class="gm">
    <header class="topbar">
      <span class="badge">🎛️ Game Master</span>
      <span class="phase" :class="state.phase">{{ state.phase }}</span>
    </header>

    <section class="join card">
      <div class="join-text">
        <p class="join-label">Players join at</p>
        <div class="url">{{ state.joinUrl }}</div>
      </div>
      <img v-if="qr" :src="qr" alt="Join QR code" class="qr" />
    </section>

    <div class="setup card">
      <p class="section-label">Game</p>
      <div class="grid">
        <button
          v-for="g in state.games"
          :key="g.id"
          class="btn"
          :class="{ sel: state.gameId === g.id }"
          @click="post('select-game', { game: g.id })"
        >
          {{ g.name }}
        </button>
      </div>

      <template v-if="state.gameId === 'five-second-rule' && state.categories.length">
        <p class="section-label">Categories <span class="hint">· pick one or more</span></p>
        <div class="grid">
          <button
            v-for="c in state.categories"
            :key="c.id"
            class="btn"
            :class="{ sel: state.selected.includes(c.id) }"
            @click="post('select-category', { category: c.id })"
          >
            {{ c.name }}
          </button>
        </div>
      </template>
    </div>

    <label v-if="state.gameId === 'five-second-rule'" class="auto">
      <input type="checkbox" :checked="state.autoAdvance" @change="post('set-auto', { on: ($event.target as HTMLInputElement).checked })" />
      <span>Auto-advance to next question (10s after reveal)</span>
    </label>

    <section class="flow">
      <button v-if="state.phase === 'lobby'" class="btn btn-primary big" :disabled="startDisabled" @click="post('start')">
        ▶ Start game
      </button>
      <template v-else>
        <button class="btn btn-accent big" @click="post('next')">Next ▶</button>
        <button class="btn btn-danger big" @click="post('end')">End</button>
      </template>
      <p v-if="startError" class="err">{{ startError }}</p>
    </section>

    <div class="cols">
      <section class="card panel">
        <h2>Players · {{ state.players.filter(p => !p.gone).length }}</h2>
        <div class="chips">
          <span v-for="p in state.players" :key="p.id" class="chip" :class="{ gone: p.gone }">{{ p.name }}</span>
          <span v-if="!state.players.length" class="empty">No one yet…</span>
        </div>
      </section>

      <section class="card panel">
        <h2>Leaderboard</h2>
        <ol class="lb">
          <li v-for="(l, i) in state.leaderboard" :key="l.id">
            <span class="rank">{{ i + 1 }}</span>
            <span class="nm">{{ l.name }}</span>
            <span class="sc">{{ l.score }}</span>
          </li>
        </ol>
        <p v-if="!state.leaderboard.length" class="empty">No scores yet</p>
      </section>
    </div>
  </div>
  <div v-else class="gm loading">Loading…</div>
</template>

<style scoped>
.gm {
  min-height: 100dvh;
  max-width: 720px;
  margin: 0 auto;
  padding: max(20px, env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.loading { align-items: center; justify-content: center; display: flex; font-size: 1.5rem; color: var(--muted); }

.topbar { display: flex; align-items: center; justify-content: space-between; }
.badge { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; }
.phase {
  font-family: var(--font-display); font-weight: 600; text-transform: capitalize;
  padding: 4px 14px; border-radius: 999px; font-size: 0.9rem;
  background: var(--surface-2); color: var(--muted); border: 1px solid var(--border);
}
.phase.playing { color: var(--success); border-color: var(--success); }
.phase.revealed { color: var(--warn); border-color: var(--warn); }

.join { display: flex; align-items: center; gap: 20px; justify-content: space-between; }
.join-text { text-align: left; }
.join-label { color: var(--muted); margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.8rem; }
.url { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; word-break: break-all; color: var(--accent); }
.qr { width: 132px; height: 132px; border-radius: 12px; background: #fff; padding: 8px; flex: none; }

.setup { display: flex; flex-direction: column; gap: 10px; }
.section-label { color: var(--muted); margin: 4px 0 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; }
.section-label .hint { text-transform: none; letter-spacing: 0; opacity: 0.7; }
.auto { display: flex; align-items: center; gap: 10px; font-size: 1rem; color: var(--text); cursor: pointer; padding: 4px 2px; }
.auto input { width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }

.flow { display: flex; flex-wrap: wrap; gap: 12px; }
.flow .btn { flex: 1 1 auto; }
.big { min-height: 68px; font-size: 1.4rem; }
.err { flex-basis: 100%; color: #fca5a5; font-size: 1.05rem; margin: 4px 0 0; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 560px) { .cols { grid-template-columns: 1fr; } }
.panel h2 { font-size: 1rem; margin: 0 0 12px; color: var(--muted); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-family: var(--font-display); font-weight: 600; padding: 7px 13px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); }
.chip.gone { opacity: 0.35; text-decoration: line-through; }
.empty { color: var(--muted); font-size: 0.95rem; }
</style>
