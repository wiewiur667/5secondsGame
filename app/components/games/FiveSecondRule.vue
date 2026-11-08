<script setup lang="ts">
import type { PlayerView } from '~/composables/useHub'

const props = defineProps<{ state: PlayerView; meId: number | null }>()
const emit = defineEmits<{
  submit: [payload: { picks: number[] }]
  startTimer: []
  reveal: []
  continue: []
  flag: []
}>()

// Local selection drives the UI for snappy taps; reset on new question.
const picks = ref<number[]>([...(props.state.yourPicks ?? [])])
watch(() => props.state.questionNo, () => {
  picks.value = [...(props.state.yourPicks ?? [])]
})

const picksRequired = computed(() => Number(props.state.picksRequired ?? 1))
const awaitingStart = computed(() => !!props.state.awaitingStart) // timer not started yet
const awaitingReveal = computed(() => !!props.state.awaitingReveal) // window closed, answers hidden
const answering = computed(() => !awaitingStart.value && !awaitingReveal.value && !props.state.late)
// Options tappable only while answering (and not paused by the host).
const locked = computed(() => !answering.value || !!props.state.paused)

function toggle(i: number) {
  if (locked.value) return
  const at = picks.value.indexOf(i)
  if (at >= 0) picks.value.splice(at, 1)
  else if (picks.value.length < picksRequired.value) picks.value.push(i) // cap client-side too
  else return
  emit('submit', { picks: [...picks.value] })
}

const remaining = computed(() => Number(props.state.remaining ?? 0))
const readWait = computed(() => Number(props.state.readWait ?? 0)) // seconds left before Start is allowed at all
const startWait = computed(() => Number(props.state.startWait ?? 0)) // …and before THIS player may press it
const starterName = computed<string>(() => props.state.starterName ?? 'gracza')
const youStart = computed(() => !!props.state.youStart)
const startLabel = computed(() => {
  if (readWait.value > 0) return `Czytanie… ${readWait.value}s`
  if (startWait.value > 0) return `Czekamy na ${starterName.value}… ${startWait.value}s`
  return `▶ Start (${props.state.remaining}s)`
})
// This phone's own option order — picks stay in original indices, only the display shuffles.
const order = computed<number[]>(
  () => props.state.order ?? (props.state.options ?? []).map((_: string, i: number) => i),
)
const answered = computed(() => Number(props.state.answered ?? 0))
const total = computed(() => Number(props.state.total ?? 0))
const points = computed(() => Number(props.state.points ?? 0))
const streak = computed(() => Number(props.state.streak ?? 0))
const correct = computed<number[]>(() => props.state.correct ?? [])
const board = computed<PlayerView['leaderboard']>(() =>
  [...(props.state.leaderboard ?? [])].sort((a: any, b: any) => b.score - a.score),
)
const moved = (d: number) => (d > 0 ? `▲${d}` : `▼${-d}`)

// Last 3 seconds tick; time's up / reveal gets a longer buzz.
const { tick, done } = useFeedback()
watch(remaining, (n) => {
  if (props.state.phase === 'playing' && answering.value && n > 0 && n <= 3) tick()
})
watch(
  () => props.state.phase === 'revealed' || awaitingReveal.value,
  (over) => { if (over) done() },
)
</script>

<template>
  <section class="fsr">
    <div v-if="state.paused" class="paused" role="status">⏸ Pauza — gospodarz zatrzymał grę</div>

    <!-- joined mid-question: watch this one, play from the next -->
    <template v-if="state.phase === 'playing' && state.late">
      <header class="head">
        <span class="pill">Pytanie {{ state.questionNo }} / {{ state.questionCount }}</span>
      </header>
      <div class="card prompt-card">
        <p class="hint">👋 Jesteś w grze! Wchodzisz od następnego pytania.</p>
        <h2 class="prompt">{{ state.prompt }}</h2>
      </div>
      <div v-if="total > 0" class="progress" aria-live="polite">
        <span>✍️ Odpowiedziało {{ answered }} / {{ total }}</span>
        <div class="bar"><i :style="{ width: `${(answered / total) * 100}%` }" /></div>
      </div>
    </template>

    <template v-else-if="state.phase === 'playing'">
      <header class="head">
        <span class="pill">Pytanie {{ state.questionNo }} / {{ state.questionCount }}</span>
        <span
          v-if="answering"
          class="timer-badge count"
          :class="{ hot: remaining <= 2 }"
        >{{ remaining }}</span>
        <span v-else-if="awaitingStart" class="pill">Gotowi?</span>
        <span v-else class="pill hot-pill">Koniec czasu!</span>
      </header>

      <div class="card prompt-card">
        <h2 class="prompt">{{ state.prompt }}</h2>
        <p class="hint">Zaznacz: <b>{{ picksRequired }}</b></p>
      </div>

      <!-- gate 1: start the timer — answers stay hidden until this is pressed.
           The question's starter may press it after MIN_READ_SECONDS; everyone
           else a few seconds later, so nobody rushes it and a locked phone
           can't stall the game. -->
      <button
        v-if="awaitingStart"
        class="btn btn-primary gate"
        :disabled="startWait > 0 || state.paused"
        @click="emit('startTimer')"
      >
        {{ startLabel }}
      </button>
      <p v-if="awaitingStart && state.starterName" class="hint center-text">
        {{ youStart ? '👉 Ty naciskasz Start!' : `Start naciska: ${state.starterName}` }}
      </p>

      <div v-if="!awaitingStart" class="options">
        <button
          v-for="i in order"
          :key="i"
          class="btn opt"
          :class="{ sel: picks.includes(i) }"
          :disabled="locked || (!picks.includes(i) && picks.length >= picksRequired)"
          @click="toggle(i)"
        >
          <span class="check" :class="{ on: picks.includes(i) }" />
          {{ state.options[i] }}
        </button>
      </div>

      <div v-if="total > 0" class="progress" aria-live="polite">
        <span>✍️ Odpowiedziało {{ answered }} / {{ total }}</span>
        <div class="bar"><i :style="{ width: `${(answered / total) * 100}%` }" /></div>
      </div>

      <!-- gate 2: reveal the answers -->
      <button v-if="awaitingReveal" class="btn btn-accent gate" :disabled="state.paused" @click="emit('reveal')">
        👀 Pokaż odpowiedzi
      </button>
    </template>

    <!-- interstitial: standings + countdown between questions -->
    <template v-else-if="state.phase === 'revealed'">
      <div class="inter-head">
        <div v-if="state.autoAdvance && state.nextIn > 0" class="ring">
          <span class="ring-n">{{ state.nextIn }}</span>
          <span class="ring-l">dalej</span>
        </div>
        <span v-if="state.late" class="score-flash zero">👋 Grasz od następnego pytania</span>
        <span v-else class="score-flash" :class="points > 0 ? 'good' : 'zero'">
          +{{ points }} pkt
          <small>({{ state.gained }}/{{ picksRequired }} poprawnych)</small>
        </span>
        <div v-if="state.fast || streak >= 3" class="bonuses">
          <span v-if="state.fast" class="bonus">⚡ Szybko +1</span>
          <span v-if="streak >= 3" class="bonus">🔥 Seria ×{{ streak }} +1</span>
        </div>
      </div>

      <div class="board card hero">
        <h3 class="board-title">Ranking</h3>
        <ol class="lb">
          <li v-for="(row, i) in board" :key="row.id" :class="{ me: row.id === meId }">
            <span class="rank">{{ ['🥇','🥈','🥉'][i] || (i + 1) }}</span>
            <span class="nm">{{ row.name }}</span>
            <span v-if="row.delta" class="mv" :class="row.delta > 0 ? 'up' : 'down'">{{ moved(row.delta) }}</span>
            <span class="sc">{{ row.score }}</span>
          </li>
          <li v-if="!board.length" class="none">Brak wyników</li>
        </ol>
      </div>

      <div class="answer card">
        <p class="answer-label">Prawidłowe odpowiedzi</p>
        <div class="chips">
          <span v-for="i in correct" :key="i" class="ans" :class="{ mine: (state.yourPicks ?? []).includes(i) }">
            {{ state.options[i] }}
          </span>
        </div>
      </div>

      <div class="answer card">
        <p class="answer-label">Odpowiedzi graczy</p>
        <ul class="results">
          <li v-for="r in state.results" :key="r.id" :class="{ me: r.id === meId }">
            <div class="r-head">
              <span class="nm">{{ r.name }}</span>
              <span v-if="r.fast">⚡</span>
              <span v-if="r.streak >= 3">🔥</span>
              <span class="pts">+{{ r.points }}</span>
            </div>
            <div class="r-picks">
              <span v-for="p in r.picks" :key="p.t" class="pk" :class="p.ok ? 'ok' : 'no'">{{ p.t }}</span>
              <span v-if="!r.picks.length" class="none">brak odpowiedzi</span>
            </div>
          </li>
        </ul>
      </div>

      <button v-if="!state.autoAdvance" class="btn btn-primary gate" :disabled="state.paused" @click="emit('continue')">
        ▶ Dalej
      </button>

      <button class="btn flag" :disabled="state.flagged" @click="emit('flag')">
        {{ state.flagged ? '🚩 Zgłoszono' : '🚩 Zgłoś błędne pytanie' }}
        <span v-if="state.flagCount" class="flag-n">{{ state.flagCount }}</span>
      </button>
    </template>

    <!-- leaderboard during the playing phase (compact) -->
    <div v-if="state.phase === 'playing' && board.length" class="board card">
      <h3 class="board-title">Ranking</h3>
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
.fsr { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.paused {
  padding: 10px 12px; text-align: center; font-weight: 700; color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, var(--surface-2)); border: 1px solid var(--warn); border-radius: var(--r-sm);
}
.flag { align-self: center; font-size: 0.85rem; color: var(--muted); min-height: 36px; gap: 6px; }
.flag-n { font-weight: 700; padding: 0 7px; border-radius: 999px; background: var(--surface); }
.head { display: flex; align-items: center; justify-content: space-between; }
.count {
  min-width: 48px; height: 48px; display: grid; place-items: center;
  border-radius: 50%; font-size: 22px;
  background: var(--surface-2); border: 2px solid var(--border);
}
.count.hot { color: var(--warn); border-color: var(--warn); animation: pulse 1s infinite; }
@keyframes pulse { 50% { transform: scale(1.08); } }

.prompt-card { padding: 14px; text-align: center; }
.prompt { font-size: clamp(1.1rem, 5vw, 1.5rem); line-height: 1.25; }
.hint { color: var(--muted); margin: 4px 0 0; font-size: 0.9rem; }
.center-text { text-align: center; }

.progress { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: var(--muted); text-align: center; }
.bar { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width 0.25s; }

.options { display: flex; flex-direction: column; gap: 8px; }
.opt { justify-content: flex-start; text-align: left; gap: 10px; font-size: 1rem; min-height: 50px; padding: 0 14px; display: flex; align-items: center; line-height: 1.2; }
.check { width: 18px; height: 18px; border-radius: 5px; border: 2px solid var(--border); flex: none; transition: background 0.15s, border-color 0.15s; }
.check.on { background: var(--accent); border-color: var(--accent); }

.gate { min-height: 52px; font-size: 1.1rem; }
.hot-pill { color: var(--warn); border: 1px solid var(--warn); }

.reveal { padding: 16px; border-radius: var(--r); border: 1px solid var(--border); background: var(--surface-2); position: relative; }
.reveal .mark { font-family: var(--font-display); font-weight: 700; margin-right: 6px; }
.opt.good, .reveal.good { border-color: var(--success); background: color-mix(in srgb, var(--success) 16%, var(--surface-2)); }
.reveal.good .mark { color: var(--success); }
.reveal.bad { opacity: 0.65; }
.reveal.bad .mark { color: var(--danger); }
.reveal.mine { outline: 2px dashed var(--gold); outline-offset: 2px; }
.tag { position: absolute; right: 14px; font-size: 13px; color: var(--gold); font-weight: 700; }
.gained { text-align: center; font-size: 20px; font-family: var(--font-display); }
.nextin { text-align: center; color: var(--muted); margin: 4px 0 0; }

.result.good { color: var(--success); background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); }
.result.zero { color: var(--muted); }

.board { padding: 16px; }
.board-title { font-size: 1rem; color: var(--muted); margin: 0 0 10px; }

/* --- between-questions interstitial --- */
.inter-head { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 8px 0; }
.ring {
  width: 92px; height: 92px; border-radius: 50%;
  display: grid; place-items: center; line-height: 1;
  background: radial-gradient(circle at 50% 40%, var(--surface-2), var(--surface));
  border: 3px solid var(--accent);
  box-shadow: 0 0 26px -6px var(--accent);
  animation: pop 0.9s ease-in-out infinite;
}
.ring-n { font-family: var(--font-display); font-weight: 700; font-size: 40px; color: var(--text); }
.ring-l { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
@keyframes pop { 50% { transform: scale(1.06); } }
.score-flash { font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; padding: 6px 18px; border-radius: 999px; background: var(--surface-2); }
.score-flash.good { color: var(--success); background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); }
.score-flash.zero { color: var(--muted); }
.score-flash small { font-size: 0.7em; font-weight: 600; opacity: 0.8; }
.bonuses { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.bonus { font-weight: 700; font-size: 0.9rem; padding: 4px 12px; border-radius: 999px; color: var(--gold); border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent); background: color-mix(in srgb, var(--gold) 12%, var(--surface-2)); }
.mv { font-size: 0.8rem; font-weight: 700; }
.mv.up { color: var(--success); }
.mv.down { color: var(--danger); }

.results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.results li { padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid transparent; }
.results li.me { border-color: var(--success); }
.r-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.r-head .nm { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-head .pts { font-family: var(--font-display); font-weight: 700; color: var(--success); }
.r-picks { display: flex; flex-wrap: wrap; gap: 6px; }
.pk { font-size: 0.8rem; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); }
.pk.ok { background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); border-color: color-mix(in srgb, var(--success) 45%, transparent); }
.pk.no { opacity: 0.7; text-decoration: line-through; text-decoration-color: var(--danger); }

.hero .rank { font-size: 1.2rem; }
.hero .lb li { padding: 14px; }
.none { color: var(--muted); justify-content: center; }

.answer { padding: 14px 16px; }
.answer-label { font-size: 0.85rem; color: var(--muted); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
.answer .chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ans { font-weight: 700; padding: 7px 13px; border-radius: 999px; background: color-mix(in srgb, var(--success) 16%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--success) 45%, transparent); }
.ans.mine { outline: 2px dashed var(--gold); outline-offset: 2px; }
</style>
