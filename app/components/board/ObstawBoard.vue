<script setup lang="ts">
import ObstawMap from './ObstawMap.vue'
// TV view of an Obstaw! turn. `live` = the game's publicView: bets and the acting
// phrase are never in it before the reveal (enforced on the server).
const props = defineProps<{ live: Record<string, any>; paused: boolean; autoAdvance: boolean }>()
const l = computed(() => props.live)
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
</script>

<template>
  <div class="ob">
    <div class="qline">
      <span class="qno">Tura {{ l.turnNo }}<template v-if="l.turnCount"> / {{ l.turnCount }}</template> · {{ l.kindLabel }}<template v-if="l.combo"> ({{ l.combo }})</template><template v-if="l.bank != null"> · 🏦 {{ l.bank }}</template></span>
      <span v-if="paused" class="next">⏸ pauza</span>
      <span v-else-if="l.phase === 'playing'" class="clock" :class="{ hot: l.remaining <= 5 }">{{ l.remaining }}</span>
      <span v-else-if="autoAdvance && l.nextIn > 0" class="next">dalej za {{ l.nextIn }}</span>
    </div>

    <h1 class="who">
      🎬 {{ l.performer }}
      <small v-if="l.partner">+ partner {{ l.partner }}</small>
      <small v-if="l.opponent">vs {{ l.opponent }}</small>
    </h1>

    <div class="mapwrap"><ObstawMap :board="l.board" /></div>

    <template v-if="l.phase === 'playing'">
      <template v-if="l.stage === 'roll'"><p class="sub">🎲 {{ l.performer }} rzuca kostką<template v-if="l.rolls.length"> · wyrzucono {{ l.rolls.join(' → ') }} ({{ l.again === 'arrow' ? 'strzałka — jeszcze raz' : 'START — jeszcze raz' }})</template></p></template>
      <template v-else-if="l.stage === 'choose'"><p class="sub">Wybiera… ({{ l.performer }})</p></template>
      <template v-else-if="l.stage === 'bet'">
        <p class="sub">🪙 Obstawiajcie na telefonach! Czy {{ l.performer }} da radę?</p>
        <div class="progress">
          <span>Obstawili: {{ l.bettorsIn }} / {{ l.bettorsTotal }}</span>
          <div class="bar"><i :style="{ width: `${(l.bettorsIn / Math.max(1, l.bettorsTotal)) * 100}%` }" /></div>
        </div>
        <p v-if="l.judge" class="sub">⚖️ Sędzia (gracz po lewej): {{ l.judge }}</p>
      </template>
      <template v-else>
        <h2 v-if="l.content" class="task">{{ l.content.text }}</h2>
        <h2 v-else-if="l.task === 'acting'" class="task">🎭 Pokaż bez słów — {{ l.partner }} odgaduje!</h2>
        <p v-if="l.task === 'mental' && l.content?.need > 1" class="sub">Potrzeba {{ l.content.need }} odpowiedzi — {{ l.performer }} mówi na głos, {{ l.judge }} ocenia</p>
        <p v-if="l.stage === 'ready'" class="sub">{{ l.performer }} szykuje się do startu…</p>
        <p v-if="l.stage === 'judge'" class="sub">⚖️ {{ l.judge }} wydaje werdykt…</p>
      </template>
    </template>

    <template v-else>
      <p v-if="l.skipped" class="banner">🎭 Brak znaczników — kolejka przechodzi dalej</p>
      <p v-else class="banner" :class="{ gold: l.result.success }">
        <template v-if="l.kind === 'dice'">🎲 {{ l.result.dice[0] }} : {{ l.result.dice[1] }} — {{ l.result.success ? 'wygrana!' : 'porażka' }}</template>
        <template v-else>{{ l.result.success ? '✅ Udało się!' : '❌ Nie udało się' }}</template>
      </p>
      <h2 v-if="l.content" class="task small">{{ l.content.text }}</h2>
      <p v-if="l.hints" class="sub">Np.: {{ l.hints.join(', ') }}</p>
      <ul class="bets">
        <li v-for="b in l.result.bets" :key="b.pid" :class="{ right: b.right }">
          <span>{{ b.name }}</span><span>{{ b.yes ? 'TAK' : 'NIE' }} {{ b.amount }}</span>
          <b>{{ b.amount ? sign(b.delta) : '–' }}</b>
        </li>
      </ul>
      <p class="sub">
        <template v-for="d in l.result.deltas.filter((x: any) => !l.result.bets.some((b: any) => b.pid === x.pid))" :key="d.pid">{{ d.name }} {{ sign(d.delta) }} · </template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.ob { display: flex; flex-direction: column; gap: 2.5vh; justify-content: center; min-width: 0; }
.qline { display: flex; align-items: center; gap: 24px; }
.qno { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--muted); }
.clock { min-width: clamp(64px, 6vw, 100px); height: clamp(64px, 6vw, 100px); display: grid; place-items: center; border-radius: 50%; font-family: var(--font-display); font-weight: 700; font-size: clamp(2rem, 4vw, 3.5rem); background: var(--surface-2); border: 3px solid var(--accent); }
.clock.hot { color: var(--warn); border-color: var(--warn); }
.next { font-family: var(--font-display); font-weight: 600; font-size: clamp(1rem, 2vw, 1.6rem); color: var(--accent); }
.mapwrap { max-height: 40vh; display: flex; justify-content: center; }
.mapwrap :deep(svg) { max-height: 40vh; }
.who { font-size: clamp(1.8rem, 4vw, 3.2rem); margin: 0; }
.who small { font-size: 0.55em; color: var(--muted); margin-left: 12px; }
.task { font-size: clamp(1.3rem, 2.4vw, 2.2rem); line-height: 1.2; margin: 0; }
.task.small { font-size: clamp(1.2rem, 2.4vw, 2.2rem); color: var(--muted); }
.sub { margin: 0; font-size: clamp(1.1rem, 2vw, 1.8rem); color: var(--muted); }
.progress { display: flex; flex-direction: column; gap: 10px; font-size: clamp(1.2rem, 2.2vw, 2rem); color: var(--muted); }
.bar { height: 14px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width 0.4s; }
.banner { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: clamp(1.8rem, 3.8vw, 3.2rem); color: var(--accent); }
.banner.gold { color: var(--gold); }
.bets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.bets li { display: grid; grid-template-columns: 1fr auto auto; gap: 18px; padding: 10px 18px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); font-size: clamp(1rem, 1.9vw, 1.6rem); }
.bets li.right b { color: var(--success); }
.bets li:not(.right) b { color: var(--danger); }
</style>
