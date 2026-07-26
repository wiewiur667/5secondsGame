<script setup lang="ts">
import type { PlayerView } from '~/composables/useHub'

const props = defineProps<{ state: PlayerView }>()

// iOS Safari blocks autoplay without a gesture; overlay a tap-to-start.
const started = ref(false)

// Rebuild the iframe ONLY when the video changes — the :key stops the 2s
// state pushes from reloading (and restarting) a running video.
const videoId = computed<string | undefined>(() => props.state.videoId)

const timer = computed(() => {
  const s = Number(props.state.remaining ?? 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
</script>

<template>
  <section class="mi">
    <template v-if="state.phase === 'playing'">
      <header class="head">
        <span class="pill">🎧 Music Impostor</span>
        <span class="timer-badge clock">{{ timer }}</span>
      </header>

      <div class="frame card">
        <iframe
          v-if="started"
          :key="videoId"
          :src="`https://www.youtube.com/embed/${videoId}?autoplay=1`"
          allow="autoplay"
          allowfullscreen
        />
        <button v-else class="tap" @click="started = true">
          <span class="play">▶</span>
          <span>Tap to start</span>
        </button>
      </div>

      <div class="card ask">Listen closely.<br /><b>Who's the impostor?</b></div>
    </template>

    <template v-else-if="state.phase === 'revealed'">
      <div class="card center reveal">
        <p class="label">The impostor was</p>
        <h2 class="name">{{ state.impostorName }}</h2>
        <div v-if="state.youWereImpostor" class="you">😈 It was YOU!</div>
        <p class="muted">Waiting for the next round…</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mi { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.clock { font-size: 26px; padding: 6px 16px; border-radius: 999px; background: var(--surface-2); border: 2px solid var(--border); color: var(--text); }

.frame { position: relative; width: 100%; aspect-ratio: 16 / 9; padding: 0; overflow: hidden; background: #000; }
iframe { width: 100%; height: 100%; border: 0; display: block; }
.tap {
  position: absolute; inset: 0; width: 100%; height: 100%; border: 0; cursor: pointer;
  display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 45%, #2a1330, #000);
  color: #fff; font-family: var(--font-display); font-size: 22px; font-weight: 600;
}
.tap .play {
  width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; font-size: 30px;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  box-shadow: 0 10px 30px -8px var(--primary);
}

.ask { text-align: center; font-size: 22px; }
.center { text-align: center; }
.reveal { display: flex; flex-direction: column; gap: 10px; }
.label { color: var(--muted); margin: 0; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem; }
.name { font-size: 34px; color: var(--primary); }
.you { font-family: var(--font-display); font-weight: 700; font-size: 24px; color: var(--warn); }
.muted { color: var(--muted); margin: 4px 0 0; }
</style>
