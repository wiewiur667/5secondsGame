<script setup lang="ts">
import type { PlayerView } from '~/composables/useHub'
import ObstawMap from '~/components/board/ObstawMap.vue'

// Obstaw! on a phone. Every rule is enforced on the server; disabled buttons are hints.
const props = defineProps<{ state: PlayerView; meId: number | null }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>]; continue: [] }>()

const s = computed(() => props.state)
const role = computed(() => s.value.role as string)
const remaining = computed(() => Number(s.value.remaining ?? 0))
const stage = computed(() => s.value.stage as string)
const send = (payload: Record<string, unknown>) => emit('submit', payload)

// --- betting -------------------------------------------------------------------
const yes = ref<boolean | null>(null)
const amount = ref(10)
watch(
  () => s.value.turnNo,
  () => {
    yes.value = null
    amount.value = 10
  },
)
const max = computed(() => Number(s.value.myMax ?? 0))
watch(max, (m) => {
  if (amount.value > m) amount.value = m
})
const step = (d: number) => (amount.value = Math.min(max.value, Math.max(0, amount.value + d * 10)))
const bet = () => yes.value != null && send({ kind: 'bet', yes: yes.value, amount: amount.value })

// --- dice duel choice --------------------------------------------------------------
const stake = ref(10)
const stakeStep = (d: number) => (stake.value = Math.min(max.value, Math.max(10, stake.value + d * 10)))

const board = computed<any[]>(() => [...(s.value.leaderboard ?? [])].sort((a: any, b: any) => b.score - a.score))
const moved = (d: number) => (d > 0 ? `▲${d}` : `▼${-d}`)
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)

const { tick, done } = useFeedback()
watch(remaining, (n) => {
  if (s.value.phase === 'playing' && n > 0 && n <= 3) tick()
})
watch(
  () => s.value.phase === 'revealed',
  (r) => r && done(),
)
</script>

<template>
  <section class="ob">
    <div v-if="state.paused" class="paused" role="status">⏸ Pauza — gospodarz zatrzymał grę</div>

    <header class="head">
      <span class="pill">Tura {{ state.turnNo }}<template v-if="state.turnCount"> / {{ state.turnCount }}</template></span>
      <span v-if="state.money != null" class="pill money">💰 {{ state.money }}</span>
      <span v-if="state.money != null" class="pill" title="Znaczniki partnerów (zadania aktorskie)">🎭 {{ state.myMarkers }}</span>
      <span v-if="state.bank != null" class="pill">🏦 {{ state.bank }}</span>
      <span v-if="state.phase === 'playing'" class="count" :class="{ hot: remaining <= 5 }">{{ remaining }}</span>
    </header>

    <div class="card kind">
      <b>{{ state.kindLabel }}</b>
      <span v-if="state.combo"> · hasło {{ state.combo }}</span>
      <span v-if="state.taskLabel && state.kind === 'blind'"> · wybrano: {{ state.taskLabel }}</span>
      <p class="hint">Gra: <b>{{ state.performer }}</b><template v-if="state.partner"> · partner: <b>{{ state.partner }}</b></template><template v-if="state.opponent"> · rywal: <b>{{ state.opponent }}</b></template></p>
    </div>

    <div v-if="state.phase === 'playing'" class="card map"><ObstawMap :board="state.board" compact /></div>

    <!-- ===== roll ===== -->
    <template v-if="state.phase === 'playing' && stage === 'roll'">
      <div class="card stack center">
        <p v-if="state.again === 'start'" class="big">🏁 Pole startowe — rzucasz jeszcze raz!</p>
        <p v-else-if="state.again === 'arrow'" class="big">↩️ Strzałka — rzucasz jeszcze raz!</p>
        <p v-if="state.rolls.length" class="hint">Wyrzucono: {{ state.rolls.join(' → ') }}</p>
        <button v-if="role === 'performer'" class="btn btn-primary gate" :disabled="state.paused" @click="send({ kind: 'roll' })">🎲 Rzuć kostką</button>
        <p v-else class="big">🎲 {{ state.performer }} rzuca kostką…</p>
      </div>
    </template>

    <!-- ===== choose ===== -->
    <template v-else-if="state.phase === 'playing' && stage === 'choose'">
      <div v-if="role === 'performer'" class="card stack">
        <template v-if="state.kind === 'blind'">
          <h3>Wybierz rodzaj zadania — reszta obstawia w ciemno</h3>
          <button class="btn btn-primary" @click="send({ kind: 'pick', type: 'skill' })">🤹 Zręcznościowe</button>
          <button class="btn btn-primary" @click="send({ kind: 'pick', type: 'mental' })">🧠 Umysłowe</button>
        </template>
        <template v-else-if="state.kind === 'acting'">
          <h3>Wybierz partnera, który będzie odgadywał</h3>
          <button v-for="o in state.options" :key="o.id" class="btn" @click="send({ kind: 'pick', partner: o.id })">{{ o.name }}</button>
        </template>
        <template v-else>
          <h3>Wybierz rywala do rzutu kością</h3>
          <div class="stepper big">
            <button class="step" :disabled="stake <= 10" @click="stakeStep(-1)">−</button>
            <b>stawka {{ stake }}</b>
            <button class="step" :disabled="stake + 10 > max" @click="stakeStep(1)">+</button>
          </div>
          <button v-for="o in state.options" :key="o.id" class="btn" @click="send({ kind: 'pick', opponent: o.id, stake })">🎲 {{ o.name }}</button>
          <p class="hint">Wygrasz → bank płaci Ci stawkę. Przegrasz → stawkę dostaje rywal. Max: połowa Twoich pieniędzy.</p>
        </template>
      </div>
      <div v-else class="card center"><p class="big">⏳ {{ state.performer }} wybiera…</p></div>
    </template>

    <!-- ===== bet ===== -->
    <template v-else-if="state.phase === 'playing' && stage === 'bet'">
      <div v-if="state.content" class="card task"><p class="task-text">{{ state.content.text }}</p>
        <p v-if="state.content.need > 1" class="hint">Wymagane odpowiedzi: {{ state.content.need }} · czas: {{ state.content.sec }} s</p>
        <p v-else-if="state.content.sec" class="hint">Czas: {{ state.content.sec }} s</p>
      </div>
      <div v-else-if="state.canBet" class="card task"><p class="task-text">🙈 Treść zadania zostanie ujawniona po zakładach</p></div>

      <div v-if="state.canBet" class="card stack">
        <h3>Czy {{ state.performer }} da radę?<template v-if="role === 'judge'"> <small>(jesteś też sędzią)</small></template></h3>
        <div class="two">
          <button class="btn choice" :class="{ sel: yes === true }" @click="yes = true">✅ TAK</button>
          <button class="btn choice" :class="{ sel: yes === false }" @click="yes = false">❌ NIE</button>
        </div>
        <div class="stepper big">
          <button class="step" :disabled="amount <= 0" @click="step(-1)">−</button>
          <b>{{ amount }}</b>
          <button class="step" :disabled="amount >= max" @click="step(1)">+</button>
        </div>
        <p class="hint center">Maksymalnie połowa Twoich pieniędzy: {{ max }}. Zakład jest tajny do końca tury.</p>
        <button class="btn btn-primary gate" :disabled="yes == null || state.paused" @click="bet">
          {{ state.myBet ? 'Zmień zakład' : 'Obstaw' }}
        </button>
        <p v-if="state.myBet" class="hint center">Twój zakład: {{ state.myBet.yes ? 'TAK' : 'NIE' }} · {{ state.myBet.amount }}</p>
      </div>
      <div v-else class="card center">
        <p v-if="role === 'performer'" class="big">🙈 Nie podglądaj — reszta obstawia</p>
        <p v-else-if="role === 'partner'" class="big">🤝 Jesteś partnerem — nie obstawiasz</p>
        <p v-else-if="role === 'judge'" class="big">⚖️ Jesteś sędzią (gracz po lewej) — nie obstawiasz</p>
        <p v-else class="big">👀 Oglądasz</p>
      </div>
      <p class="hint center">🪙 Obstawili: {{ state.bettorsIn }} / {{ state.bettorsTotal }}</p>
    </template>

    <!-- ===== ready / act / judge ===== -->
    <template v-else-if="state.phase === 'playing'">
      <div v-if="state.content" class="card task">
        <p class="task-text">{{ state.content.text }}</p>
        <p v-if="state.content.need > 1" class="hint">Potrzeba odpowiedzi: {{ state.content.need }}</p>
      </div>
      <div v-if="state.hints && role === 'judge'" class="card task"><p class="hint">Przykładowe poprawne odpowiedzi (tylko dla Ciebie):</p><p class="task-text small">{{ state.hints.join(' · ') }}</p></div>
      <div v-else-if="role === 'partner'" class="card center"><p class="big">🗣️ Odgaduj na głos!</p><p class="hint">Hasło zostanie uznane, gdy powiesz całe wyrażenie.</p></div>

      <!-- ready -->
      <template v-if="stage === 'ready'">
        <button v-if="role === 'performer'" class="btn btn-primary gate" :disabled="state.paused" @click="send({ kind: 'start' })">▶ Start — czas leci!</button>
        <p v-else class="hint center">{{ state.performer }} czyta zadanie i zaraz zaczyna…</p>
      </template>

      <!-- act -->
      <template v-else-if="stage === 'act'">
        <template v-if="role === 'performer'">
          <button class="btn btn-primary gate" :disabled="state.paused" @click="send({ kind: 'done' })">
            {{ state.task === 'acting' ? '🎯 Odgadnięto!' : state.task === 'mental' ? '✋ Odpowiedziałem' : '✋ Gotowe' }}
          </button>
          <p v-if="state.task === 'mental'" class="hint center">Odpowiadaj na głos — sędzia zdecyduje, czy dobrze.</p>
        </template>
        <p v-else-if="role === 'judge'" class="hint center">⚖️ Obserwuj — zaraz wydasz werdykt.</p>
        <p v-else class="hint center">🎬 {{ state.performer }} działa…</p>
      </template>

      <!-- judge -->
      <template v-else-if="stage === 'judge'">
        <div v-if="role === 'judge'" class="card stack">
          <h3>Udało się?</h3>
          <div class="two">
            <button class="btn choice" @click="send({ kind: 'ruling', ok: true })">✅ Tak</button>
            <button class="btn choice" @click="send({ kind: 'ruling', ok: false })">❌ Nie</button>
          </div>
          <p class="hint center">Bądź uczciwy — to Ty decydujesz o pieniądzach.</p>
        </div>
        <p v-else class="hint center">⚖️ {{ state.judge }} wydaje werdykt…</p>
      </template>
    </template>

    <!-- ===== result ===== -->
    <template v-else-if="state.phase === 'revealed'">
      <div class="inter-head">
        <div v-if="state.autoAdvance && state.nextIn > 0" class="ring"><span class="ring-n">{{ state.nextIn }}</span><span class="ring-l">dalej</span></div>
        <span v-if="state.money != null" class="score-flash" :class="state.myDelta > 0 ? 'good' : state.myDelta < 0 ? 'bad' : 'zero'">{{ sign(state.myDelta) }}</span>
      </div>
      <p v-if="state.skipped" class="banner">🎭 {{ state.performer }} nie ma już znaczników — kolejka przechodzi dalej</p>
      <p v-if="state.result.startPay" class="hint center">🏁 Przejście przez START: +{{ state.result.startPay }}</p>
      <p v-if="!state.skipped" class="banner" :class="state.result.success ? 'gold' : ''">
        <template v-if="state.kind === 'dice'">🎲 {{ state.performer }} {{ state.result.dice[0] }} : {{ state.result.dice[1] }} {{ state.opponent }} — {{ state.result.success ? 'wygrana!' : 'porażka' }}</template>
        <template v-else>{{ state.result.success ? '✅ Udało się!' : '❌ Nie udało się' }}</template>
      </p>
      <div v-if="state.content" class="card task"><p class="task-text">{{ state.content.text }}</p></div>
      <p v-if="state.hints" class="hint center">Przykładowe poprawne: {{ state.hints.join(', ') }}</p>
      <ul v-if="state.result.bets.length" class="entries">
        <li v-for="b in state.result.bets" :key="b.pid" class="entry" :class="{ me: b.pid === meId }">
          <span class="txt">{{ b.name }} — {{ b.yes ? 'TAK' : 'NIE' }} {{ b.amount }}</span>
          <span class="pts" :class="{ neg: b.delta < 0 }">{{ b.amount ? sign(b.delta) : '–' }}</span>
        </li>
      </ul>

      <div class="card map"><ObstawMap :board="state.board" compact /></div>
      <div class="board card">
        <h3 class="board-title">Stan kont</h3>
        <ol class="lb">
          <li v-for="(row, i) in board" :key="row.id" :class="{ me: row.id === meId }">
            <span class="rank">{{ ['🥇', '🥈', '🥉'][i] || i + 1 }}</span>
            <span class="nm">{{ row.name }}</span>
            <span v-if="row.delta" class="mv" :class="row.delta > 0 ? 'up' : 'down'">{{ moved(row.delta) }}</span>
            <span class="sc">{{ row.score }}</span>
          </li>
        </ol>
      </div>
      <button v-if="!state.autoAdvance" class="btn btn-primary gate" :disabled="state.paused" @click="emit('continue')">▶ Dalej</button>
    </template>
  </section>
</template>

<style scoped>
.ob { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.paused { padding: 10px 12px; text-align: center; font-weight: 700; color: var(--warn); background: color-mix(in srgb, var(--warn) 14%, var(--surface-2)); border: 1px solid var(--warn); border-radius: var(--r-sm); }
.head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.head .count { margin-left: auto; }
.money { color: var(--gold); }
.count { min-width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font-size: 20px; font-family: var(--font-display); font-weight: 700; background: var(--surface-2); border: 2px solid var(--border); }
.count.hot { color: var(--warn); border-color: var(--warn); }
.kind, .task { padding: 12px 14px; }
.kind p { margin: 4px 0 0; }
.map { padding: 6px; }
.task-text.small { font-size: 1rem; }
.task-text { margin: 0; font-size: clamp(1.1rem, 5vw, 1.4rem); font-weight: 700; line-height: 1.3; }
.stack { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.stack h3 { margin: 0; font-size: 1.05rem; }
.center { text-align: center; }
.card.center { padding: 14px; }
.big { font-family: var(--font-display); font-size: 1.2rem; margin: 0; }
.hint { color: var(--muted); margin: 0; font-size: 0.9rem; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.choice { min-height: 64px; font-size: 1.15rem; }
.stepper { display: inline-flex; align-items: center; justify-content: center; gap: 14px; }
.stepper.big b { font-family: var(--font-display); font-size: 1.8rem; min-width: 110px; text-align: center; }
.step { width: 46px; height: 46px; border-radius: 50%; font-size: 1.4rem; font-weight: 700; cursor: pointer; background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.step:disabled { opacity: 0.35; }
.gate { min-height: 52px; font-size: 1.1rem; }
.field { width: 100%; box-sizing: border-box; font-size: 1.1rem; }
.entries { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.entry { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); }
.entry.me { outline: 2px dashed var(--success); outline-offset: 2px; }
.txt { flex: 1; overflow-wrap: anywhere; }
.pts { font-family: var(--font-display); font-weight: 700; color: var(--success); white-space: nowrap; }
.pts.neg { color: var(--danger); }
.inter-head { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 6px 0; }
.ring { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; line-height: 1; background: var(--surface-2); border: 3px solid var(--accent); }
.ring-n { font-family: var(--font-display); font-weight: 700; font-size: 34px; }
.ring-l { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.score-flash { font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; padding: 6px 18px; border-radius: 999px; background: var(--surface-2); }
.score-flash.good { color: var(--success); }
.score-flash.bad { color: var(--danger); }
.score-flash.zero { color: var(--muted); }
.banner { margin: 0; text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; color: var(--accent); }
.banner.gold { color: var(--gold); }
.board { padding: 16px; }
.board-title { font-size: 1rem; color: var(--muted); margin: 0 0 10px; }
.mv { font-size: 0.8rem; font-weight: 700; }
.mv.up { color: var(--success); }
.mv.down { color: var(--danger); }
</style>
