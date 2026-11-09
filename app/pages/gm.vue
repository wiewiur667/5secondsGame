<script setup lang="ts">
import { computed } from 'vue'

// Full-page host controls.
const { gm: state, startError, post } = useGm()
const qr = useQrCode(computed(() => state.value?.joinUrl))

const needCategory = computed(
  () => state.value?.gameId === 'five-second-rule' && !state.value?.selected?.length,
)
const startDisabled = computed(() => !state.value?.gameId || needCategory.value)

const phaseLabel: Record<string, string> = { lobby: 'lobby', playing: 'gra', revealed: 'odpowiedzi' }
const phaseText = computed(() =>
  state.value?.paused ? '⏸ pauza' : phaseLabel[state.value?.phase ?? ''] ?? state.value?.phase,
)

function doReset() {
  if (confirm('Zresetować grę? Wszyscy zostaną wylogowani, a wyniki wyczyszczone.')) post('reset')
}

function removePlayer(p: { id: number; name: string }) {
  if (confirm(`Usunąć gracza ${p.name}?`)) post('remove-player', { id: p.id })
}

// Starting from the full page sends the host to the game so they play too.
async function startGame() {
  const res = await post('start')
  if (res?.ok) await navigateTo('/')
}
</script>

<template>
  <div v-if="state" class="gm">
    <header class="topbar">
      <span class="badge">🎛️ Mistrz gry</span>
      <div class="topbar-right">
        <span class="phase" :class="state.phase">{{ phaseText }}</span>
        <NuxtLink to="/" class="back-link">← Wróć do gry</NuxtLink>
      </div>
    </header>

    <section class="join card">
      <div class="join-text">
        <p class="join-label">Gracze dołączają pod adresem</p>
        <div class="url">{{ state.joinUrl }}</div>
      </div>
      <div v-if="qr" class="qr" v-html="qr" />
    </section>

    <div class="setup card">
      <p class="section-label">Gra</p>
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

      <!-- options the selected game declares (GameModule.settings) -->
      <template v-for="opt in state.settings" :key="opt.key">
        <p class="section-label">{{ opt.label }}</p>
        <div class="grid">
          <button
            v-for="o in opt.options"
            :key="String(o.value)"
            class="btn"
            :class="{ sel: opt.value === o.value }"
            @click="post('set-option', { key: opt.key, value: o.value })"
          >{{ o.label }}</button>
        </div>
      </template>

      <template v-if="state.gameId === 'five-second-rule' && state.categories.length">
        <p class="section-label">Kategorie <span class="hint">· wybierz jedną lub więcej</span></p>
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

        <p class="section-label">Liczba pytań</p>
        <div class="grid">
          <button
            v-for="n in [10, 20, 30, 40, 50, 0]"
            :key="n"
            class="btn"
            :class="{ sel: state.questionLimit === n }"
            @click="post('set-length', { count: n })"
          >{{ n || 'Wszystkie' }}</button>
        </div>

        <p class="section-label">Czas na odpowiedź</p>
        <div class="grid">
          <button
            v-for="t in [3, 5, 7, 10]"
            :key="t"
            class="btn"
            :class="{ sel: state.timerSeconds === t }"
            @click="post('set-timer', { seconds: t })"
          >{{ t }}s</button>
        </div>
      </template>
    </div>

    <label v-if="['five-second-rule', 'riposta', 'obstaw'].includes(state.gameId ?? '')" class="auto">
      <input type="checkbox" :checked="state.autoAdvance" @change="post('set-auto', { on: ($event.target as HTMLInputElement).checked })" />
      <span v-if="state.gameId === 'riposta'">Automatycznie przejdź do następnego pojedynku (8 s po wynikach)</span>
      <span v-else-if="state.gameId === 'obstaw'">Automatycznie przejdź do następnej tury (12 s po wyniku)</span>
      <span v-else>Automatycznie przejdź do następnego pytania (10 s po odpowiedziach)</span>
    </label>
    <label v-if="state.gameId === 'five-second-rule'" class="auto">
      <input type="checkbox" :checked="state.revealOnAllAnswered" @change="post('set-reveal-on-answer', { on: ($event.target as HTMLInputElement).checked })" />
      <span>Pokaż odpowiedzi wcześniej, gdy wszyscy odpowiedzą</span>
    </label>

    <label v-if="state.gameId === 'five-second-rule'" class="auto">
      <input type="checkbox" :checked="state.penalizeWrong" @change="post('set-penalty', { on: ($event.target as HTMLInputElement).checked })" />
      <span>Kara za błędy: każdy zły wybór kasuje jeden dobry (min. 0)</span>
    </label>

    <section class="flow">
      <button v-if="state.phase === 'lobby'" class="btn btn-primary big" :disabled="startDisabled" @click="startGame">
        ▶ Start gry
      </button>
      <template v-else>
        <button class="btn btn-accent big" @click="post('next')">Dalej ▶</button>
        <button class="btn btn-danger big" @click="post('end')">Koniec</button>
        <div class="remote">
          <button class="btn" :class="{ sel: state.paused }" @click="post('pause')">{{ state.paused ? '▶ Wznów' : '⏸ Pauza' }}</button>
          <button class="btn" title="Pomiń to pytanie bez punktów" @click="post('skip')">⏭ Pomiń</button>
          <button class="btn" title="Zadaj to pytanie jeszcze raz (punkty za nie cofnięte)" @click="post('replay')">↻ Powtórz</button>
        </div>
      </template>
      <p v-if="startError" class="err">{{ startError }}</p>
      <button class="btn reset" @click="doReset">↺ Resetuj grę</button>
    </section>

    <div class="cols">
      <section class="card panel">
        <h2>Gracze · {{ state.players.filter(p => !p.gone).length }}</h2>
        <div class="chips">
          <span v-for="p in state.players" :key="p.id" class="chip" :class="{ gone: p.gone }">
            {{ p.name }}
            <button class="chip-x" title="Usuń gracza" @click="removePlayer(p)">×</button>
          </span>
          <span v-if="!state.players.length" class="empty">Jeszcze nikogo…</span>
        </div>
      </section>

      <section class="card panel">
        <h2>Ranking</h2>
        <ol class="lb">
          <li v-for="(l, i) in state.leaderboard" :key="l.id">
            <span class="rank">{{ i + 1 }}</span>
            <span class="nm">{{ l.name }}</span>
            <span v-if="state.phase !== 'lobby'" class="adj">
              <button class="adj-btn" title="Odejmij punkt" @click="post('adjust-score', { id: l.id, delta: -1 })">−</button>
              <button class="adj-btn" title="Dodaj punkt" @click="post('adjust-score', { id: l.id, delta: 1 })">+</button>
            </span>
            <span class="sc">{{ l.score }}</span>
          </li>
        </ol>
        <p v-if="!state.leaderboard.length" class="empty">Brak wyników</p>
      </section>
    </div>
  </div>
  <div v-else class="gm loading">Ładowanie…</div>
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

.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.topbar-right { display: flex; align-items: center; gap: 10px; }
.badge { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; }
.back-link { font-family: var(--font-display); font-weight: 600; font-size: 0.9rem; color: var(--accent); text-decoration: none; }
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
.qr :deep(svg) { width: 100%; height: 100%; display: block; }

.setup { display: flex; flex-direction: column; gap: 10px; }
.section-label { color: var(--muted); margin: 4px 0 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; }
.section-label .hint { text-transform: none; letter-spacing: 0; opacity: 0.7; }
.auto { display: flex; align-items: center; gap: 10px; font-size: 1rem; color: var(--text); cursor: pointer; padding: 4px 2px; }
.auto input { width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer; }
.reset { flex-basis: 100%; min-height: 48px; font-size: 1rem; color: var(--muted); background: transparent; border: 1px solid var(--border); }
.reset:hover { background: color-mix(in srgb, var(--danger) 18%, transparent); color: #ffd7dc; border-color: color-mix(in srgb, var(--danger) 50%, transparent); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }

.flow { display: flex; flex-wrap: wrap; gap: 12px; }
.flow .btn { flex: 1 1 auto; }
.big { min-height: 68px; font-size: 1.4rem; }
.remote { flex: 1 1 100%; display: flex; gap: 10px; }
.remote .btn { flex: 1; min-height: 48px; }
.adj { display: inline-flex; gap: 4px; margin-right: 6px; }
.adj-btn {
  width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: 700; font-size: 1rem; line-height: 1;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
}
.adj-btn:active { transform: scale(0.94); }
.err { flex-basis: 100%; color: #fca5a5; font-size: 1.05rem; margin: 4px 0 0; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 560px) { .cols { grid-template-columns: 1fr; } }
.panel h2 { font-size: 1rem; margin: 0 0 12px; color: var(--muted); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-family: var(--font-display); font-weight: 600; padding: 7px 13px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 6px; }
.chip.gone { opacity: 0.35; text-decoration: line-through; }
.chip-x { border: none; background: none; color: var(--muted); font-size: 0.85rem; line-height: 1; cursor: pointer; padding: 0; opacity: 0.6; }
.chip-x:hover { opacity: 1; color: var(--danger); }
.empty { color: var(--muted); font-size: 0.95rem; }
</style>
