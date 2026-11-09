<script setup lang="ts">
// Banknotes (10 blue, 50 orange, 100 green, 500 purple, 1000 red) for an amount.
const props = defineProps<{ amount: number; small?: boolean }>()
const NOTES = [
  { v: 1000, bg: 'linear-gradient(135deg,#ef6a5a,#b3261e)' },
  { v: 500, bg: 'linear-gradient(135deg,#b05db0,#6e2a74)' },
  { v: 100, bg: 'linear-gradient(135deg,#c4e05a,#6f9a1e)' },
  { v: 50, bg: 'linear-gradient(135deg,#f9b95a,#d9771e)' },
  { v: 10, bg: 'linear-gradient(135deg,#8cb8fa,#3b6fd8)' },
]
const notes = computed(() => {
  let left = Math.max(0, Math.floor(props.amount))
  const out: Array<{ v: number; bg: string }> = []
  for (const n of NOTES) while (left >= n.v && out.length < 40) {
    out.push(n)
    left -= n.v
  }
  return out
})
</script>

<template>
  <div class="money" :class="{ small }" :aria-label="`${amount} punktów`">
    <span v-for="(n, i) in notes" :key="i" class="note" :style="{ background: n.bg }">
      <i>{{ n.v }}</i>
    </span>
    <span v-if="!notes.length" class="none">0</span>
  </div>
</template>

<style scoped>
.money { display: flex; flex-wrap: wrap; gap: 4px; }
.note {
  position: relative; width: 58px; height: 30px; border-radius: 4px; display: grid; place-items: center;
  border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
.note i {
  font-style: normal; font-weight: 800; font-size: 14px; color: #fff; padding: 0 8px; border-radius: 10px;
  background: rgba(0, 0, 0, 0.28); text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}
.small .note { width: 40px; height: 21px; border-width: 1.5px; }
.small .note i { font-size: 10px; padding: 0 5px; }
.none { color: var(--muted); }
</style>
