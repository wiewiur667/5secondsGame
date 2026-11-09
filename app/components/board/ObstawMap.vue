<script setup lang="ts">
// The Obstaw! board: a ring of fields (it grows with the player count) with a
// coloured pawn per player. Pure SVG — canvas is unreliable on some TV browsers.
const props = defineProps<{
  board: { cells: Array<{ t: string; c: string | null }>; pawns: Array<{ id: number; name: string; color: number; pos: number }>; current: number }
  compact?: boolean
}>()

const ICON: Record<string, string> = { start: '🏁', arrow: '↩️', skill: '🤹', mental: '🧠', acting: '🎭', blind: '🎲', dice: '🎰' }
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#94a3b8']
const n = computed(() => props.board.cells.length)
const r = computed(() => Math.min(5, ((2 * Math.PI * 38) / n.value) * 0.44))
const cells = computed(() =>
  props.board.cells.map((c, i) => {
    const a = (i / n.value) * 2 * Math.PI - Math.PI / 2
    return { ...c, i, x: 50 + 44 * Math.cos(a), y: 36 + 30 * Math.sin(a) }
  }),
)
const pawns = computed(() => {
  const seen: Record<number, number> = {}
  return props.board.pawns.map((p) => {
    const k = (seen[p.pos] = (seen[p.pos] ?? -1) + 1)
    const cell = cells.value[p.pos]
    // pawns on one field fan out towards the centre of the board
    const len = Math.hypot(36 - cell.y, 50 - cell.x) || 1
    const ux = (50 - cell.x) / len
    const uy = (36 - cell.y) / len
    const off = r.value * (1.25 + k * 0.95)
    return { ...p, x: cell.x + ux * off, y: cell.y + uy * off }
  })
})
</script>

<template>
  <svg class="map" viewBox="0 0 100 72" role="img" aria-label="Plansza">
    <g v-for="c in cells" :key="c.i">
      <circle
        :cx="c.x" :cy="c.y" :r="r" class="cell"
        :class="[c.t, { cur: c.i === board.current }]"
      />
      <text :x="c.x" :y="c.y + r * 0.35" class="icon" :font-size="r * 1.05" text-anchor="middle">{{ ICON[c.t] }}</text>
      <text v-if="c.c && !compact" :x="c.x" :y="c.y + r + 2.4" class="combo" text-anchor="middle">{{ c.c }}</text>
    </g>
    <g v-for="p in pawns" :key="p.id">
      <circle :cx="p.x" :cy="p.y" :r="r * 0.62" :fill="COLORS[p.color % COLORS.length]" class="pawn" />
      <text :x="p.x" :y="p.y + r * 0.25" class="pl" :font-size="r * 0.7" text-anchor="middle">{{ p.name.slice(0, 1).toUpperCase() }}</text>
    </g>
  </svg>
</template>

<style scoped>
.map { width: 100%; height: auto; max-height: 100%; }
.cell { fill: var(--surface-2); stroke: var(--border); stroke-width: 0.4; }
.cell.start { fill: color-mix(in srgb, var(--success) 35%, var(--surface-2)); }
.cell.arrow { fill: color-mix(in srgb, var(--muted) 35%, var(--surface-2)); }
.cell.acting { fill: color-mix(in srgb, #a855f7 28%, var(--surface-2)); }
.cell.skill { fill: color-mix(in srgb, #f97316 28%, var(--surface-2)); }
.cell.mental { fill: color-mix(in srgb, #3b82f6 28%, var(--surface-2)); }
.cell.blind { fill: color-mix(in srgb, #111 40%, var(--surface-2)); }
.cell.dice { fill: color-mix(in srgb, #eab308 30%, var(--surface-2)); }
.cell.cur { stroke: var(--gold); stroke-width: 1.2; }
.icon { pointer-events: none; }
.combo { font-size: 2.2px; fill: var(--muted); font-weight: 700; }
.pawn { stroke: #fff; stroke-width: 0.35; }
.pl { fill: #fff; font-weight: 800; pointer-events: none; }
</style>
