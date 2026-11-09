<script setup lang="ts">
// The Obstaw! board: a square ring of fields (it grows with the player count), a
// pawn per player. Drawn as SVG (canvas is unreliable on some TV browsers), in the
// style of the classic board: pink/white/black circles, START diamond on the right.
const props = defineProps<{
  board: { cells: Array<{ t: string; c: string | null }>; pawns: Array<{ id: number; name: string; color: number; pos: number }>; current: number }
  compact?: boolean
}>()

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#e5e7eb']
const n = computed(() => props.board.cells.length)
const L = 6
const R = 94
const SIDE = R - L
const PER = SIDE * 4
const r = computed(() => Math.min(5.4, (PER / n.value) * 0.43))

// Point at distance d along the perimeter, starting at the middle of the right side
// (where START is) and moving clockwise (down the right side first).
function at(d: number) {
  const p = ((d % PER) + PER) % PER
  const mid = SIDE / 2
  let q = p + mid // distance from the top-right corner going down
  const corner = (x: number, y: number) => ({ x, y })
  q = q % PER
  if (q < SIDE) return { ...corner(R, L + q), dir: 90 }
  q -= SIDE
  if (q < SIDE) return { ...corner(R - q, R), dir: 180 }
  q -= SIDE
  if (q < SIDE) return { ...corner(L, R - q), dir: 270 }
  q -= SIDE
  return { ...corner(L + q, L), dir: 0 }
}
const cells = computed(() =>
  props.board.cells.map((c, i) => {
    const pt = at((i / n.value) * PER)
    return { ...c, i, ...pt }
  }),
)
const pawns = computed(() => {
  const seen: Record<number, number> = {}
  return props.board.pawns.map((p) => {
    const k = (seen[p.pos] = (seen[p.pos] ?? -1) + 1)
    const cell = cells.value[p.pos]
    const ux = (50 - cell.x) / 50
    const uy = (50 - cell.y) / 50
    const len = Math.hypot(ux, uy) || 1
    const off = r.value * (1.3 + k * 1.0 + (cell.t === 'start' ? 1.0 : 0))
    return { ...p, x: cell.x + (ux / len) * off, y: cell.y + (uy / len) * off }
  })
})
// combo symbols: 1 triangle, 2 circle, A square, B star
const star = (cx: number, cy: number, rr: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const q = i % 2 ? rr * 0.45 : rr
    return `${cx + q * Math.cos(a)},${cy + q * Math.sin(a)}`
  }).join(' ')
</script>

<template>
  <svg class="map" viewBox="0 0 100 100" role="img" aria-label="Plansza">
    <rect x="0" y="0" width="100" height="100" rx="3" class="bg" />
    <rect x="12" y="12" width="76" height="76" rx="4" class="inner" />
    <g v-for="c in cells" :key="c.i">
      <!-- START: white diamond -->
      <template v-if="c.t === 'start'">
        <rect :x="c.x - r * 1.05" :y="c.y - r * 1.05" :width="r * 2.1" :height="r * 2.1" class="start" :transform="`rotate(45 ${c.x} ${c.y})`" />
        <text :x="c.x" :y="c.y + r * 0.3" class="starttxt" :font-size="r * 0.62" text-anchor="middle">START</text>
      </template>
      <template v-else>
        <circle :cx="c.x" :cy="c.y" :r="r" class="cell" :class="[c.t, { cur: c.i === board.current }]" />
        <!-- dice duel: die with pips -->
        <g v-if="c.t === 'dice'">
          <rect :x="c.x - r * 0.55" :y="c.y - r * 0.55" :width="r * 1.1" :height="r * 1.1" :rx="r * 0.2" class="die" />
          <circle v-for="(d, k) in [[-0.28, -0.28], [0.28, -0.28], [0, 0], [-0.28, 0.28], [0.28, 0.28]]" :key="k" :cx="c.x + d[0] * r" :cy="c.y + d[1] * r" :r="r * 0.1" class="pip" />
        </g>
        <!-- blind bet: black ring -->
        <circle v-else-if="c.t === 'blind'" :cx="c.x" :cy="c.y" :r="r * 0.5" class="ring" :stroke-width="r * 0.3" />
        <!-- arrow: pink arrow along the direction of travel -->
        <g v-else-if="c.t === 'arrow'" :transform="`translate(${c.x} ${c.y}) rotate(${c.dir - 90}) scale(${r / 5})`">
          <polygon points="-3.2,-1.2 0.6,-1.2 0.6,-2.8 3.4,0 0.6,2.8 0.6,1.2 -3.2,1.2" class="arrowshape" />
        </g>
        <!-- mental: ?! -->
        <text v-else-if="c.t === 'mental'" :x="c.x" :y="c.y + r * 0.34" class="glyph" :font-size="r * 1.05" text-anchor="middle">?!</text>
        <!-- skill / acting: double curved arrow -->
        <g v-else :transform="`translate(${c.x} ${c.y}) scale(${r / 5})`">
          <path d="M-3.4 1.8 C-3.4 -2.4 0.6 -2.8 2.2 -1.4" class="swoosh" />
          <polygon points="1.2,-3.6 3.8,-1.2 0.6,-0.4" class="swooshhead" />
          <path v-if="c.t === 'skill'" d="M-3.4 3.4 C-1.8 0.6 1 0.2 2.4 1.6" class="swoosh dark" />
        </g>
        <!-- acting symbols: number (1 triangle / 2 circle) and letter (A square / B star) -->
        <g v-if="c.t === 'acting' && c.c && !compact">
          <polygon v-if="c.c[0] === '1'" :points="`${c.x - r * 0.95},${c.y + r * 0.95} ${c.x - r * 0.35},${c.y + r * 0.95} ${c.x - r * 0.65},${c.y + r * 0.4}`" class="sym1" />
          <circle v-else :cx="c.x - r * 0.65" :cy="c.y + r * 0.7" :r="r * 0.3" class="sym2" />
          <rect v-if="c.c[1] === 'A'" :x="c.x + r * 0.3" :y="c.y + r * 0.42" :width="r * 0.55" :height="r * 0.55" class="symA" />
          <polygon v-else :points="star(c.x + r * 0.58, c.y + r * 0.7, r * 0.34)" class="symB" />
        </g>
      </template>
    </g>
    <g v-for="p in pawns" :key="p.id">
      <circle :cx="p.x" :cy="p.y" :r="r * 0.62" :fill="COLORS[p.color % COLORS.length]" class="pawn" />
      <text :x="p.x" :y="p.y + r * 0.25" class="pl" :font-size="r * 0.7" text-anchor="middle">{{ p.name.slice(0, 1).toUpperCase() }}</text>
    </g>
  </svg>
</template>

<style scoped>
.map { width: 100%; height: auto; max-height: 100%; }
.bg { fill: #1b0b1f; }
.inner { fill: #5a1654; opacity: 0.55; }
.cell { stroke: #1b0b1f; stroke-width: 0.4; }
.cell.skill { fill: #f08ac6; }
.cell.mental { fill: #f08ac6; }
.cell.acting { fill: #9d2a8c; }
.cell.dice, .cell.blind { fill: #fff; }
.cell.arrow { fill: #15060f; stroke: #5a1654; }
.cell.cur { stroke: #facc15; stroke-width: 1.2; }
.start { fill: #fff; stroke: #1b0b1f; stroke-width: 0.5; }
.starttxt { fill: #1b0b1f; font-weight: 800; }
.glyph { fill: #2a0a28; font-weight: 800; }
.swoosh { fill: none; stroke: #fff; stroke-width: 1.5; stroke-linecap: round; }
.swoosh.dark { stroke: #2a0a28; }
.swooshhead { fill: #fff; }
.arrowshape { fill: #ec4899; }
.ring { fill: none; stroke: #15060f; }
.die { fill: #fff; stroke: #888; stroke-width: 0.25; }
.pip { fill: #111; }
.sym1 { fill: #f8b4dc; stroke: #fff; stroke-width: 0.15; }
.sym2 { fill: #7c3aed; stroke: #fff; stroke-width: 0.15; }
.symA { fill: #14b8a6; stroke: #fff; stroke-width: 0.15; }
.symB { fill: #9ca3af; stroke: #fff; stroke-width: 0.15; }
.pawn { stroke: #fff; stroke-width: 0.35; }
.pl { fill: #fff; font-weight: 800; pointer-events: none; }
</style>
