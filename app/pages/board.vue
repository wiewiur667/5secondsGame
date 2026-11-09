<script setup lang="ts">
import { computed } from 'vue'
import RipostaBoard from '~/components/board/RipostaBoard.vue'
import ObstawBoard from '~/components/board/ObstawBoard.vue'

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

    <!-- game just ended: podium + awards on the big screen -->
    <section v-if="state.phase === 'lobby' && state.finalBoard.length" class="finalview">
      <h2 class="final-title">🏆 Wyniki końcowe</h2>
      <div class="final-wrap"><FinalScores :board="state.finalBoard" :awards="state.finalAwards" /></div>
      <div class="foot">
        <div v-if="qr" class="qr-sm" v-html="qr" />
        <span class="url-sm">{{ state.joinUrl }}</span>
      </div>
    </section>

    <!-- lobby: big QR so the room can scan and join -->
    <section v-else-if="state.phase === 'lobby'" class="join center">
      <div v-if="qr" class="qr" v-html="qr" />
      <div class="url">{{ state.joinUrl }}</div>
      <div class="roster">
        <span v-for="p in state.players" :key="p.id" class="chip" :class="{ gone: p.gone }">{{ p.name }}</span>
      </div>
      <p class="hint">Dołączyło: {{ state.players.length }} — zeskanuj i graj</p>
    </section>

    <!-- in a game / between rounds: the live question (if the game has one) beside the leaderboard -->
    <section v-else class="lbwrap" :class="{ split: state.live }">
      <RipostaBoard
        v-if="state.live && state.live.game === 'riposta'"
        :live="state.live"
        :paused="state.paused"
        :auto-advance="state.autoAdvance"
      />
      <ObstawBoard
        v-else-if="state.live && state.live.game === 'obstaw'"
        :live="state.live"
        :paused="state.paused"
        :auto-advance="state.autoAdvance"
      />
      <div v-else-if="state.live" class="live">
        <div class="qline">
          <span class="qno">Pytanie {{ state.live.questionNo }} / {{ state.live.questionCount }}</span>
          <span v-if="state.paused" class="next">⏸ pauza</span>
          <span
            v-else-if="state.live.stage === 'answering'"
            class="clock"
            :class="{ hot: state.live.remaining <= 2 }"
          >{{ state.live.remaining }}</span>
          <span v-else-if="state.live.phase === 'revealed' && state.autoAdvance && state.live.nextIn > 0" class="next">
            dalej za {{ state.live.nextIn }}
          </span>
        </div>
        <h1 class="prompt">{{ state.live.prompt }}</h1>

        <template v-if="state.live.phase === 'revealed'">
          <div class="correct">
            <span v-for="c in state.live.correct" :key="c" class="ans">{{ c }}</span>
          </div>
          <ul class="results">
            <li v-for="r in state.live.results" :key="r.id">
              <span class="nm">{{ r.name }}</span>
              <span class="pks">{{ r.fast ? '⚡' : '' }}{{ r.streak >= 3 ? '🔥' : '' }}</span>
              <span class="pts">+{{ r.points }}</span>
            </li>
          </ul>
        </template>
        <template v-else>
          <p v-if="state.live.stage === 'reading'" class="sub">
            Czytajcie pytanie…<template v-if="state.live.starterName"> Start naciska: <b>{{ state.live.starterName }}</b></template>
          </p>
          <p v-else-if="state.live.stage === 'closed'" class="sub hot">Koniec czasu!</p>
          <div v-if="state.live.total > 0 && state.live.stage !== 'reading'" class="progress">
            <span>✍️ Odpowiedziało {{ state.live.answered }} / {{ state.live.total }}</span>
            <div class="bar"><i :style="{ width: `${(state.live.answered / state.live.total) * 100}%` }" /></div>
          </div>
        </template>
      </div>

      <ol class="lb">
        <li v-for="(row, i) in state.leaderboard" :key="row.id" :class="{ top: i === 0 && row.score > 0 }">
          <span class="rank">{{ row.score > 0 ? (['🥇', '🥈', '🥉'][i] || i + 1) : i + 1 }}</span>
          <span class="nm">{{ row.name }}</span>
          <span v-if="row.delta" class="mv" :class="row.delta > 0 ? 'up' : 'down'">
            {{ row.delta > 0 ? `▲${row.delta}` : `▼${-row.delta}` }}
          </span>
          <span class="sc">{{ row.score }}</span>
        </li>
        <li v-if="!state.leaderboard.length" class="empty">Brak wyników</li>
      </ol>
      <div class="foot">
        <div v-if="qr" class="qr-sm" v-html="qr" />
        <span class="url-sm">{{ state.joinUrl }}</span>
      </div>
    </section>
  </div>
  <div v-else class="board center">Ładowanie…</div>
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
.lbwrap.split { display: grid; grid-template-columns: 3fr 2fr; grid-template-rows: 1fr auto; gap: 2vh 3vw; }
.lbwrap.split .foot { grid-column: 1 / -1; }
.lbwrap.split .lb .nm, .lbwrap.split .lb .sc { font-size: clamp(1.2rem, 2.4vw, 2.2rem); }
.mv { font-family: var(--font-display); font-weight: 700; font-size: clamp(1rem, 1.8vw, 1.6rem); }
.mv.up { color: var(--success); }
.mv.down { color: var(--danger); }

.finalview { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2vh; min-height: 0; }
.final-title { font-size: clamp(1.8rem, 3.5vw, 3rem); }
.final-wrap { flex: 1; width: min(900px, 100%); font-size: clamp(1rem, 1.9vw, 1.7rem); overflow-y: auto; }

.live { display: flex; flex-direction: column; gap: 2.5vh; justify-content: center; min-width: 0; }
.qline { display: flex; align-items: center; gap: 24px; }
.qno { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--muted); }
.clock {
  min-width: clamp(64px, 6vw, 100px); height: clamp(64px, 6vw, 100px); display: grid; place-items: center;
  border-radius: 50%; font-family: var(--font-display); font-weight: 700; font-size: clamp(2rem, 4vw, 3.5rem);
  background: var(--surface-2); border: 3px solid var(--accent);
}
.clock.hot { color: var(--warn); border-color: var(--warn); animation: pulse 1s infinite; }
@keyframes pulse { 50% { transform: scale(1.08); } }
.next { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--accent); }
.prompt { font-size: clamp(1.8rem, 4vw, 3.6rem); line-height: 1.15; }
.sub { margin: 0; font-size: clamp(1.2rem, 2.2vw, 2rem); color: var(--muted); }
.sub b { color: var(--accent); }
.sub.hot { color: var(--warn); font-weight: 700; }
.progress { display: flex; flex-direction: column; gap: 10px; font-size: clamp(1.2rem, 2.2vw, 2rem); color: var(--muted); }
.bar { height: 14px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width 0.4s; }
.correct { display: flex; flex-wrap: wrap; gap: 14px; }
.ans {
  font-family: var(--font-display); font-weight: 700; font-size: clamp(1.2rem, 2.4vw, 2.2rem);
  padding: 10px 22px; border-radius: 999px;
  background: color-mix(in srgb, var(--success) 18%, var(--surface-2)); border: 2px solid color-mix(in srgb, var(--success) 55%, transparent);
}
.results { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.results li { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); font-size: clamp(1rem, 1.8vw, 1.6rem); }
.results .nm { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.results .pts { font-family: var(--font-display); font-weight: 700; color: var(--success); }
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
