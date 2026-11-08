<script setup lang="ts">
// End-of-game screen body: podium for the top 3, the rest as a list, then awards.
// Sized in em so the TV board can scale it up with a bigger font-size.
const props = defineProps<{
  board: { id: number; name: string; score: number }[]
  awards?: { title: string; name: string; detail: string }[]
  meId?: number | null
}>()

const medals = ['🥇', '🥈', '🥉']
// Visual left→right order: 2nd, 1st, 3rd.
const podium = computed(() =>
  [1, 0, 2].flatMap((i) => (props.board[i] ? [{ row: props.board[i], place: i + 1 }] : [])),
)
const rest = computed(() => props.board.slice(3))
</script>

<template>
  <div class="final">
    <div class="podium">
      <div v-for="p in podium" :key="p.row.id" class="step" :class="[`p${p.place}`, { me: p.row.id === meId }]">
        <span class="medal">{{ medals[p.place - 1] }}</span>
        <span class="nm">{{ p.row.name }}</span>
        <span class="sc">{{ p.row.score }}</span>
        <div class="block">{{ p.place }}</div>
      </div>
    </div>

    <ol v-if="rest.length" class="lb rest">
      <li v-for="(row, i) in rest" :key="row.id" :class="{ me: row.id === meId }">
        <span class="rank">{{ i + 4 }}</span>
        <span class="nm">{{ row.name }}</span>
        <span class="sc">{{ row.score }}</span>
      </li>
    </ol>

    <ul v-if="awards?.length" class="awards">
      <li v-for="a in awards" :key="a.title">
        <b>{{ a.title }}</b>
        <span>{{ a.name }} <em>· {{ a.detail }}</em></span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.final { width: 100%; display: flex; flex-direction: column; gap: 1.2em; }
.podium { display: flex; align-items: flex-end; justify-content: center; gap: 0.5em; }
.step { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 0.15em; }
.medal { font-size: 1.8em; line-height: 1; }
.nm { font-family: var(--font-display); font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc { font-family: var(--font-display); font-weight: 700; color: var(--primary); }
.block {
  width: 100%; display: grid; place-items: center; margin-top: 0.3em;
  font-family: var(--font-display); font-weight: 700; font-size: 1.4em; color: rgba(0, 0, 0, 0.55);
  border-radius: 0.6em 0.6em 0 0; background: var(--surface-2);
}
.p1 .block { height: 5.5em; background: linear-gradient(var(--gold), color-mix(in srgb, var(--gold) 55%, #000)); }
.p2 .block { height: 4em; background: linear-gradient(#e5e7eb, #9ca3af); }
.p3 .block { height: 3em; background: linear-gradient(#e0a26a, #a16207); }
.p1 .nm { color: var(--gold); }
.step.me .nm { color: var(--success); }

.rest { max-height: 30vh; overflow-y: auto; }

.awards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
.awards li {
  display: flex; flex-direction: column; gap: 0.1em; padding: 0.6em 0.9em; text-align: left;
  border-radius: var(--r); background: var(--surface-2); border: 1px solid var(--border);
}
.awards b { font-family: var(--font-display); color: var(--gold); }
.awards em { color: var(--muted); font-style: normal; }
</style>
