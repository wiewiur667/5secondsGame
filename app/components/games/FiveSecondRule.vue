<script setup lang="ts">
import type { PlayerView } from '~/composables/useHub'

const props = defineProps<{ state: PlayerView; meId: number | null }>()
const emit = defineEmits<{ submit: [payload: { picks: number[] }] }>()

// Local selection drives the UI for snappy taps; reset on new question.
const picks = ref<number[]>([...(props.state.yourPicks ?? [])])
watch(() => props.state.questionNo, () => {
  picks.value = [...(props.state.yourPicks ?? [])]
})

const picksRequired = computed(() => Number(props.state.picksRequired ?? 1))
// Timer hit 0 but server reveal not pushed yet — lock so late taps don't look accepted.
const locked = computed(() => Number(props.state.remaining ?? 0) <= 0)

function toggle(i: number) {
  if (locked.value) return
  const at = picks.value.indexOf(i)
  if (at >= 0) picks.value.splice(at, 1)
  else if (picks.value.length < picksRequired.value) picks.value.push(i) // cap client-side too
  else return
  emit('submit', { picks: [...picks.value] })
}

const remaining = computed(() => Number(props.state.remaining ?? 0))
const correct = computed<number[]>(() => props.state.correct ?? [])
const board = computed<PlayerView['leaderboard']>(() =>
  [...(props.state.leaderboard ?? [])].sort((a: any, b: any) => b.score - a.score),
)
</script>

<template>
  <section class="fsr">
    <template v-if="state.phase === 'playing'">
      <header class="head">
        <span class="pill">Q{{ state.questionNo }} / {{ state.questionCount }}</span>
        <span class="timer-badge count" :class="{ hot: remaining <= 2 }">{{ remaining }}</span>
      </header>

      <div class="card prompt-card">
        <h2 class="prompt">{{ state.prompt }}</h2>
        <p class="hint">Tap <b>{{ picksRequired }}</b></p>
      </div>

      <div class="options">
        <button
          v-for="(opt, i) in state.options"
          :key="i"
          class="btn opt"
          :class="{ sel: picks.includes(i) }"
          :disabled="locked || (!picks.includes(i) && picks.length >= picksRequired)"
          @click="toggle(i)"
        >
          <span class="check" :class="{ on: picks.includes(i) }" />
          {{ opt }}
        </button>
      </div>
    </template>

    <template v-else-if="state.phase === 'revealed'">
      <header class="head">
        <span class="pill">Q{{ state.questionNo }} / {{ state.questionCount }}</span>
        <span class="pill result" :class="state.gained > 0 ? 'good' : 'zero'">+{{ state.gained }}</span>
      </header>

      <div class="card prompt-card"><h2 class="prompt">{{ state.prompt }}</h2></div>

      <div class="options">
        <div
          v-for="(opt, i) in state.options"
          :key="i"
          class="opt reveal"
          :class="{ good: correct.includes(i), bad: !correct.includes(i), mine: (state.yourPicks ?? []).includes(i) }"
        >
          <span class="mark">{{ correct.includes(i) ? '✓' : '✕' }}</span>
          {{ opt }}
          <span v-if="(state.yourPicks ?? []).includes(i)" class="tag">you</span>
        </div>
      </div>
      <p class="gained">You got <b>{{ state.gained }}</b> right</p>
    </template>

    <!-- compact leaderboard whenever present -->
    <div v-if="board.length" class="board card">
      <h3 class="board-title">Leaderboard</h3>
      <ol class="lb">
        <li v-for="(row, i) in board" :key="row.id" :class="{ me: row.id === meId }">
          <span class="rank">{{ i + 1 }}</span>
          <span class="nm">{{ row.name }}</span>
          <span class="sc">{{ row.score }}</span>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.fsr { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.count {
  min-width: 48px; height: 48px; display: grid; place-items: center;
  border-radius: 50%; font-size: 22px;
  background: var(--surface-2); border: 2px solid var(--border);
}
.count.hot { color: var(--warn); border-color: var(--warn); animation: pulse 1s infinite; }
@keyframes pulse { 50% { transform: scale(1.08); } }

.prompt-card { padding: 20px; text-align: center; }
.prompt { font-size: 26px; }
.hint { color: var(--muted); margin: 8px 0 0; }

.options { display: flex; flex-direction: column; gap: 12px; }
.opt { justify-content: flex-start; text-align: left; gap: 12px; font-size: 1.15rem; min-height: 58px; display: flex; align-items: center; }
.check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid var(--border); flex: none; transition: background 0.15s, border-color 0.15s; }
.check.on { background: var(--accent); border-color: var(--accent); }

.reveal { padding: 16px; border-radius: var(--r); border: 1px solid var(--border); background: var(--surface-2); position: relative; }
.reveal .mark { font-family: var(--font-display); font-weight: 700; margin-right: 6px; }
.opt.good, .reveal.good { border-color: var(--success); background: color-mix(in srgb, var(--success) 16%, var(--surface-2)); }
.reveal.good .mark { color: var(--success); }
.reveal.bad { opacity: 0.65; }
.reveal.bad .mark { color: var(--danger); }
.reveal.mine { outline: 2px dashed var(--gold); outline-offset: 2px; }
.tag { position: absolute; right: 14px; font-size: 13px; color: var(--gold); font-weight: 700; }
.gained { text-align: center; font-size: 20px; font-family: var(--font-display); }

.result.good { color: var(--success); background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); }
.result.zero { color: var(--muted); }

.board { padding: 16px; }
.board-title { font-size: 1rem; color: var(--muted); margin: 0 0 10px; }
</style>
