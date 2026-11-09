<script setup lang="ts">
// TV view of a Riposta question. `live` = the game's publicView (no authors
// before a reveal — that is enforced on the server, not here).
const props = defineProps<{ live: Record<string, any>; paused: boolean; autoAdvance: boolean }>()
const l = computed(() => props.live)
const title = computed(() =>
  l.value.round === 3 ? '🏁 Wielki finał' : `Runda ${l.value.round}${l.value.multiplier > 1 ? ' · punkty ×2' : ''}`,
)
</script>

<template>
  <div class="rb">
    <div class="qline">
      <span class="qno">{{ title }}<template v-if="l.kind === 'duel' && l.stage !== 'write'"> · pojedynek {{ l.matchNo }} / {{ l.matchCount }}</template></span>
      <span v-if="paused" class="next">⏸ pauza</span>
      <span v-else-if="l.phase === 'playing'" class="clock" :class="{ hot: l.remaining <= 5 }">{{ l.remaining }}</span>
      <span v-else-if="autoAdvance && l.nextIn > 0" class="next">dalej za {{ l.nextIn }}</span>
    </div>

    <template v-if="l.stage === 'write'">
      <h1 class="prompt">✍️ {{ l.round === 3 ? 'Jeden prompt dla wszystkich — piszcie!' : 'Piszcie odpowiedzi na telefonach!' }}</h1>
      <p class="sub">Poziom: {{ l.tier }} · do {{ l.maxAnswer }} znaków · 🛟 gotowiec za pół punktów</p>
      <div class="progress">
        <span>Gotowe: {{ l.written }} / {{ l.total }}</span>
        <div class="bar"><i :style="{ width: `${(l.written / Math.max(1, l.total)) * 100}%` }" /></div>
      </div>
    </template>

    <template v-else-if="l.phase === 'playing' && l.answers">
      <h1 class="prompt">{{ l.prompt }}</h1>
      <div class="duel">
        <div v-for="(a, i) in l.answers" :key="i" class="ans">
          <span class="letter">{{ i === 0 ? 'A' : 'B' }}</span>
          <span class="txt">{{ a }}</span>
        </div>
      </div>
      <p class="sub">🗳️ Głosujcie na telefonach · {{ l.voted }} / {{ l.eligible }}</p>
    </template>

    <template v-else-if="l.phase === 'playing' && l.entries">
      <h1 class="prompt">{{ l.prompt }}</h1>
      <div class="grid">
        <div v-for="(e, i) in l.entries" :key="i" class="cell">{{ e.text }}</div>
      </div>
      <p class="sub">🪙 Rozdajcie żetony · {{ l.voted }} / {{ l.eligible }}</p>
    </template>

    <template v-else-if="l.duel">
      <p v-if="l.duel.jinx" class="banner">🧠 Telepatia! Ta sama odpowiedź — 0 punktów</p>
      <p v-else-if="l.duel.sweep" class="banner gold">🎯 Riposta doskonała!</p>
      <h1 class="prompt small">{{ l.duel.prompt }}</h1>
      <div class="duel">
        <div v-for="(a, i) in l.duel.answers" :key="i" class="ans res" :class="{ win: a.winner }">
          <span class="txt">{{ a.text }}</span>
          <div class="meta">
            <b>{{ a.name }}</b>
            <span v-if="a.safety" class="tag">gotowiec</span>
            <span class="pts">+{{ a.points }}</span>
          </div>
          <div v-if="!l.duel.jinx" class="bar big"><i :style="{ width: `${a.share}%` }" /></div>
          <span v-if="a.voters.length || a.audience" class="voters">
            👍 {{ a.voters.join(', ') }}<template v-if="a.audience"> · widzowie: {{ a.audience }}</template>
          </span>
        </div>
      </div>
    </template>

    <template v-else-if="l.final">
      <h1 class="prompt small">{{ l.final.prompt }}</h1>
      <ol class="final">
        <li v-for="e in l.final.entries" :key="e.pid" :class="{ win: e.best }">
          <span class="txt">{{ e.best ? '👑 ' : '' }}{{ e.text }}</span>
          <span class="nm">{{ e.name }}{{ e.safety ? ' · gotowiec' : '' }}{{ e.jinx ? ' · 🧠' : '' }}</span>
          <span class="tok">🪙 {{ e.tokens }}<template v-if="e.audience"> +{{ e.audience }}</template></span>
          <span class="pts">+{{ e.points }}</span>
        </li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.rb { display: flex; flex-direction: column; gap: 2.5vh; justify-content: center; min-width: 0; }
.qline { display: flex; align-items: center; gap: 24px; }
.qno { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--muted); }
.clock {
  min-width: clamp(64px, 6vw, 100px); height: clamp(64px, 6vw, 100px); display: grid; place-items: center;
  border-radius: 50%; font-family: var(--font-display); font-weight: 700; font-size: clamp(2rem, 4vw, 3.5rem);
  background: var(--surface-2); border: 3px solid var(--accent);
}
.clock.hot { color: var(--warn); border-color: var(--warn); }
.next { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--accent); }
.prompt { font-size: clamp(1.8rem, 4vw, 3.4rem); line-height: 1.15; margin: 0; }
.prompt.small { font-size: clamp(1.4rem, 3vw, 2.6rem); }
.sub { margin: 0; font-size: clamp(1.1rem, 2vw, 1.8rem); color: var(--muted); }
.progress { display: flex; flex-direction: column; gap: 10px; font-size: clamp(1.2rem, 2.2vw, 2rem); color: var(--muted); }
.bar { height: 14px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar.big { height: 18px; }
.bar i { display: block; height: 100%; background: var(--success); transition: width 0.6s; }
.duel { display: grid; grid-template-columns: 1fr 1fr; gap: 2vw; }
.ans {
  display: flex; flex-direction: column; gap: 12px; padding: 2.4vh 1.6vw; border-radius: 20px;
  background: var(--surface); border: 2px solid var(--border); font-size: clamp(1.3rem, 2.6vw, 2.4rem); font-weight: 700;
}
.ans.win { border-color: var(--gold); box-shadow: 0 0 40px -12px var(--gold); }
.letter { font-family: var(--font-display); color: var(--accent); }
.txt { overflow-wrap: anywhere; }
.meta { display: flex; align-items: center; gap: 12px; font-size: 0.7em; color: var(--muted); }
.meta .pts { margin-left: auto; }
.pts { font-family: var(--font-display); color: var(--success); }
.tag { font-size: 0.8em; color: var(--gold); }
.voters { font-size: 0.55em; color: var(--muted); font-weight: 600; }
.banner { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.6rem, 3.4vw, 3rem); color: var(--accent); }
.banner.gold { color: var(--gold); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.cell { padding: 16px 20px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); font-size: clamp(1.1rem, 2vw, 1.8rem); font-weight: 700; overflow-wrap: anywhere; }
.final { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.final li {
  display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 18px;
  padding: 12px 18px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border);
  font-size: clamp(1rem, 1.9vw, 1.7rem);
}
.final li.win { border-color: var(--gold); }
.final .txt { font-weight: 700; }
.final .nm, .final .tok { color: var(--muted); }
</style>
