<script setup lang="ts">
import type { PlayerView } from '~/composables/useHub'

// Riposta on a phone: write answers → vote → result. All rules are enforced on
// the server; disabled buttons here are only hints.
const props = defineProps<{ state: PlayerView; meId: number | null }>()
const emit = defineEmits<{ submit: [payload: Record<string, unknown>]; continue: []; flag: [] }>()

const s = computed(() => props.state)
const isPlayer = computed(() => s.value.role === 'player')
const remaining = computed(() => Number(s.value.remaining ?? 0))
const maxLen = computed(() => Number(s.value.maxAnswer ?? 60))
const roundLabel = computed(() =>
  s.value.round === 3 ? '🏁 Wielki finał' : `Runda ${s.value.round}${s.value.multiplier > 1 ? ' · punkty ×2' : ''}`,
)

// --- writing: local drafts per prompt, never overwritten by state pushes ---------
const drafts = reactive<Record<string, string>>({})
watch(
  () => (s.value.myPrompts ?? []).map((p: any) => p.mid).join(','),
  () => {
    for (const p of s.value.myPrompts ?? []) if (drafts[p.mid] == null) drafts[p.mid] = p.draft ?? ''
  },
  { immediate: true },
)
// Unsent text reaches the server (debounced), so a locked phone at the deadline
// still gets its own words instead of a Gotowiec.
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
function onType(mid: string) {
  clearTimeout(timers[mid])
  timers[mid] = setTimeout(() => emit('submit', { kind: 'draft', mid, text: drafts[mid] }), 700)
}
onBeforeUnmount(() => Object.values(timers).forEach(clearTimeout))
function send(mid: string) {
  const text = (drafts[mid] ?? '').trim()
  if (!text) return
  clearTimeout(timers[mid])
  emit('submit', { kind: 'answer', mid, text })
}
function safety(mid: string) {
  emit('submit', { kind: 'safety', mid })
}
const allWritten = computed(() => (s.value.myPrompts ?? []).every((p: any) => p.answer != null))

// --- final: spread tokens over other answers ------------------------------------
const alloc = reactive<Record<string, number>>({})
const cap = computed(() => Number(s.value.cap ?? 3))
const spent = computed(() => Object.values(alloc).reduce((a, b) => a + b, 0))
watch(
  () => s.value.mid,
  () => Object.keys(alloc).forEach((k) => delete alloc[k]),
)
function addToken(id: string, d: number) {
  const n = (alloc[id] ?? 0) + d
  if (n < 0 || (d > 0 && spent.value >= cap.value)) return
  alloc[id] = n
}
function sendTokens() {
  if (spent.value < 1) return
  emit('submit', { kind: 'tokens', mid: s.value.mid, alloc: { ...alloc } })
}

const board = computed<any[]>(() => [...(s.value.leaderboard ?? [])].sort((a: any, b: any) => b.score - a.score))
const moved = (d: number) => (d > 0 ? `▲${d}` : `▼${-d}`)

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
  <section class="rip">
    <div v-if="state.paused" class="paused" role="status">⏸ Pauza — gospodarz zatrzymał grę</div>

    <header class="head">
      <span class="pill">{{ roundLabel }}</span>
      <span v-if="state.kind === 'duel' && state.stage !== 'write'" class="pill">Pojedynek {{ state.matchNo }} / {{ state.matchCount }}</span>
      <span v-if="state.phase === 'playing'" class="count" :class="{ hot: remaining <= 5 }">{{ remaining }}</span>
    </header>

    <!-- ===== writing ===== -->
    <template v-if="state.phase === 'playing' && state.stage === 'write'">
      <template v-if="!isPlayer">
        <div class="card center">
          <p class="big">👀 Oglądasz jako widz</p>
          <p class="hint">Gracze piszą odpowiedzi. Za chwilę głosujesz razem z nimi!</p>
        </div>
      </template>
      <template v-else>
        <p class="hint center">Dokończ zdania — im śmieszniej, tym lepiej. Odpowiedź do {{ maxLen }} znaków.</p>
        <div v-for="p in state.myPrompts" :key="p.mid" class="card prompt-card">
          <h2 class="prompt">{{ p.prompt }}</h2>
          <p v-if="p.answer != null" class="sent">
            ✅ <b>{{ p.answer }}</b>
            <span v-if="p.safety" class="tag">gotowiec</span>
          </p>
          <template v-else>
            <textarea
              v-model="drafts[p.mid]"
              class="field answer"
              rows="2"
              :maxlength="maxLen"
              placeholder="Twoja odpowiedź…"
              :disabled="state.paused"
              @input="onType(p.mid)"
            />
            <div class="row">
              <span class="chars">{{ (drafts[p.mid] ?? '').length }}/{{ maxLen }}</span>
              <button
                v-if="state.safetyLeft"
                class="btn small"
                title="Serwer wpisze gotową odpowiedź — za połowę punktów (1 na rundę)"
                :disabled="state.paused"
                @click="safety(p.mid)"
              >🛟 Gotowiec</button>
              <button class="btn btn-primary small" :disabled="!(drafts[p.mid] ?? '').trim() || state.paused" @click="send(p.mid)">
                Wyślij
              </button>
            </div>
          </template>
        </div>
        <p v-if="state.safetyLeft" class="hint center">🛟 Gotowiec = gotowa odpowiedź za połowę punktów, raz na rundę.</p>
      </template>
      <div class="progress" aria-live="polite">
        <span>✍️ Gotowe: {{ state.written }} / {{ state.total }}</span>
        <div class="bar"><i :style="{ width: `${(state.written / Math.max(1, state.total)) * 100}%` }" /></div>
      </div>
      <p v-if="isPlayer && allWritten" class="hint center">Czekamy na resztę…</p>
    </template>

    <!-- ===== voting: duel ===== -->
    <template v-else-if="state.phase === 'playing' && state.kind === 'duel'">
      <div class="card prompt-card"><h2 class="prompt">{{ state.prompt }}</h2></div>
      <p v-if="state.mine != null" class="hint center">⚔️ To Twój pojedynek — głosuje reszta.</p>
      <div class="choices">
        <button
          v-for="(a, i) in state.answers"
          :key="i"
          class="btn choice"
          :class="{ sel: state.myVote === i, own: state.mine === i }"
          :disabled="state.mine != null || state.myVote != null || state.paused"
          @click="emit('submit', { kind: 'vote', mid: state.mid, choice: i })"
        >
          <span class="letter">{{ i === 0 ? 'A' : 'B' }}</span>
          <span class="txt">{{ a }}</span>
          <span v-if="state.mine === i" class="tag">Twoja</span>
        </button>
      </div>
      <p v-if="state.myVote != null" class="hint center">🗳️ Głos oddany</p>
      <div class="progress"><span>🗳️ Zagłosowało {{ state.voted }} / {{ state.eligible }}</span></div>
    </template>

    <!-- ===== voting: final ===== -->
    <template v-else-if="state.phase === 'playing' && state.kind === 'final'">
      <div class="card prompt-card"><h2 class="prompt">{{ state.prompt }}</h2></div>
      <template v-if="state.myTokens">
        <p class="hint center">🗳️ Żetony oddane — czekamy na resztę.</p>
      </template>
      <template v-else>
        <p class="hint center">Rozdaj {{ cap }} {{ cap === 1 ? 'żeton' : 'żetony' }} najlepszym odpowiedziom (można kilka na jedną). Zostało: <b>{{ cap - spent }}</b></p>
      </template>
      <ul class="entries">
        <li v-for="e in state.entries" :key="e.id" class="entry" :class="{ own: e.mine, jinx: e.jinx }">
          <span class="txt">{{ e.text }}</span>
          <span v-if="e.mine" class="tag">Twoja</span>
          <span v-else-if="e.jinx" class="tag">🧠 Telepatia</span>
          <span v-else-if="state.myTokens" class="tok">{{ '🪙'.repeat(state.myTokens[e.id] ?? 0) }}</span>
          <span v-else class="stepper">
            <button class="step" :disabled="!alloc[e.id]" @click="addToken(e.id, -1)">−</button>
            <b>{{ alloc[e.id] ?? 0 }}</b>
            <button class="step" :disabled="spent >= cap" @click="addToken(e.id, 1)">+</button>
          </span>
        </li>
      </ul>
      <button v-if="!state.myTokens" class="btn btn-primary gate" :disabled="spent < 1 || state.paused" @click="sendTokens">
        Oddaj żetony
      </button>
      <div class="progress"><span>🗳️ Zagłosowało {{ state.voted }} / {{ state.eligible }}</span></div>
    </template>

    <!-- ===== result ===== -->
    <template v-else-if="state.phase === 'revealed'">
      <div class="inter-head">
        <div v-if="state.autoAdvance && state.nextIn > 0" class="ring">
          <span class="ring-n">{{ state.nextIn }}</span><span class="ring-l">dalej</span>
        </div>
        <span v-if="isPlayer && (state.duel ? state.duel.answers.some((a: any) => a.pid === meId) : true)" class="score-flash" :class="state.myPoints > 0 ? 'good' : 'zero'">
          +{{ state.myPoints }} pkt
        </span>
      </div>

      <template v-if="state.duel">
        <p v-if="state.duel.jinx" class="banner">🧠 Telepatia! Ta sama odpowiedź — nikt nie dostaje punktów.</p>
        <p v-else-if="state.duel.sweep" class="banner gold">🎯 Riposta doskonała!</p>
        <div class="card prompt-card"><h2 class="prompt">{{ state.duel.prompt }}</h2></div>
        <div v-for="(a, i) in state.duel.answers" :key="i" class="card res" :class="{ win: a.winner, me: a.pid === meId }">
          <div class="res-top">
            <span class="txt">{{ a.text }}</span>
            <span class="pts">+{{ a.points }}</span>
          </div>
          <div class="res-meta">
            <b>{{ a.name }}</b>
            <span v-if="a.safety" class="tag">gotowiec</span>
            <span v-if="!state.duel.jinx">{{ a.share }}%</span>
          </div>
          <p v-if="a.voters.length || a.audience" class="voters">
            👍 {{ a.voters.join(', ') }}<template v-if="a.audience"> {{ a.voters.length ? '+' : '' }} widzowie: {{ a.audience }}</template>
          </p>
        </div>
      </template>

      <template v-else-if="state.final">
        <div class="card prompt-card"><h2 class="prompt">{{ state.final.prompt }}</h2></div>
        <ul class="entries">
          <li v-for="e in state.final.entries" :key="e.pid" class="entry" :class="{ win: e.best, me: e.pid === meId }">
            <span class="txt">{{ e.best ? '👑 ' : '' }}{{ e.text }}<small> — {{ e.name }}{{ e.safety ? ' (gotowiec)' : '' }}{{ e.jinx ? ' 🧠' : '' }}</small></span>
            <span class="tok">🪙{{ e.tokens }}<template v-if="e.audience"> +{{ e.audience }}</template></span>
            <span class="pts">+{{ e.points }}</span>
          </li>
        </ul>
      </template>

      <div class="board card">
        <h3 class="board-title">Ranking</h3>
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
      <button class="btn flag" :disabled="state.flagged" @click="emit('flag')">
        {{ state.flagged ? '🚩 Zgłoszono' : '🚩 Zgłoś słaby prompt' }}
        <span v-if="state.flagCount" class="flag-n">{{ state.flagCount }}</span>
      </button>
    </template>
  </section>
</template>

<style scoped>
.rip { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.paused {
  padding: 10px 12px; text-align: center; font-weight: 700; color: var(--warn);
  background: color-mix(in srgb, var(--warn) 14%, var(--surface-2)); border: 1px solid var(--warn); border-radius: var(--r-sm);
}
.head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.head .count { margin-left: auto; }
.count {
  min-width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font-size: 20px;
  font-family: var(--font-display); font-weight: 700; background: var(--surface-2); border: 2px solid var(--border);
}
.count.hot { color: var(--warn); border-color: var(--warn); }
.center { text-align: center; }
.big { font-family: var(--font-display); font-size: 1.3rem; margin: 0 0 6px; }
.hint { color: var(--muted); margin: 0; font-size: 0.9rem; }
.prompt-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.prompt { font-size: clamp(1.1rem, 5vw, 1.4rem); line-height: 1.25; margin: 0; }
.answer { width: 100%; resize: none; font-size: 1.05rem; box-sizing: border-box; }
.row { display: flex; align-items: center; gap: 8px; }
.chars { color: var(--muted); font-size: 0.8rem; margin-right: auto; }
.small { min-height: 42px; padding: 0 14px; font-size: 0.95rem; }
.sent { margin: 0; font-size: 1.05rem; }
.tag {
  font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; margin-left: 6px; white-space: nowrap;
  color: var(--gold); border: 1px solid color-mix(in srgb, var(--gold) 50%, transparent);
}
.progress { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; color: var(--muted); text-align: center; }
.bar { height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width 0.25s; }
.choices { display: flex; flex-direction: column; gap: 10px; }
.choice { min-height: 72px; justify-content: flex-start; text-align: left; gap: 12px; padding: 10px 14px; font-size: 1.1rem; line-height: 1.25; }
.choice.own { opacity: 0.7; }
.letter {
  flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
  font-family: var(--font-display); font-weight: 700; background: var(--surface); border: 1px solid var(--border);
}
.txt { flex: 1; overflow-wrap: anywhere; }
.gate { min-height: 52px; font-size: 1.1rem; }
.entries { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.entry {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--r-sm);
  background: var(--surface-2); border: 1px solid var(--border);
}
.entry.own, .entry.jinx { opacity: 0.65; }
.entry.win { border-color: var(--gold); }
.entry.me { outline: 2px dashed var(--success); outline-offset: 2px; }
.entry small { color: var(--muted); font-weight: 600; }
.stepper { display: inline-flex; align-items: center; gap: 8px; }
.step {
  width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; font-weight: 700; cursor: pointer;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
}
.step:disabled { opacity: 0.35; }
.tok { white-space: nowrap; font-size: 0.9rem; }
.pts { font-family: var(--font-display); font-weight: 700; color: var(--success); white-space: nowrap; }
.inter-head { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 6px 0; }
.ring {
  width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; line-height: 1;
  background: var(--surface-2); border: 3px solid var(--accent);
}
.ring-n { font-family: var(--font-display); font-weight: 700; font-size: 34px; }
.ring-l { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.score-flash { font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; padding: 6px 18px; border-radius: 999px; background: var(--surface-2); }
.score-flash.good { color: var(--success); background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); }
.score-flash.zero { color: var(--muted); }
.banner { margin: 0; text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; color: var(--accent); }
.banner.gold { color: var(--gold); }
.res { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
.res.win { border-color: var(--gold); box-shadow: 0 0 24px -12px var(--gold); }
.res.me { outline: 2px dashed var(--success); outline-offset: 2px; }
.res-top { display: flex; gap: 10px; align-items: flex-start; font-size: 1.1rem; font-weight: 700; }
.res-meta { display: flex; gap: 8px; align-items: center; color: var(--muted); font-size: 0.9rem; }
.voters { margin: 0; font-size: 0.85rem; color: var(--muted); }
.board { padding: 16px; }
.board-title { font-size: 1rem; color: var(--muted); margin: 0 0 10px; }
.mv { font-size: 0.8rem; font-weight: 700; }
.mv.up { color: var(--success); }
.mv.down { color: var(--danger); }
.flag { align-self: center; font-size: 0.85rem; color: var(--muted); min-height: 36px; gap: 6px; }
.flag-n { font-weight: 700; padding: 0 7px; border-radius: 999px; background: var(--surface); }
</style>
