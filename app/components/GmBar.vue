<script setup lang="ts">
// Compact host controls shown ABOVE the game view for the admin player, so the
// game master plays and runs the game from the same screen. Full panel at /gm.
const { gm, startError, post } = useGm()

const needCategory = computed(
  () => gm.value?.gameId === 'five-second-rule' && !gm.value?.selected?.length,
)
const startDisabled = computed(() => !gm.value?.gameId || needCategory.value)
const collapsed = ref(false)

function doReset() {
  if (confirm('Reset the game? Everyone is logged out and scores are cleared.')) post('reset')
}
</script>

<template>
  <div v-if="gm" class="gmbar card">
    <div class="bar-head" @click="collapsed = !collapsed">
      <strong>🎛️ Host controls</strong>
      <div class="head-right">
        <a href="/gm" class="link" @click.stop>full panel ↗</a>
        <span class="chev">{{ collapsed ? '▸' : '▾' }}</span>
      </div>
    </div>

    <div v-show="!collapsed" class="bar-body">
      <template v-if="gm.phase === 'lobby'">
        <div class="grid">
          <button
            v-for="g in gm.games"
            :key="g.id"
            class="btn sm"
            :class="{ sel: gm.gameId === g.id }"
            @click="post('select-game', { game: g.id })"
          >{{ g.name }}</button>
        </div>
        <div v-if="gm.gameId === 'five-second-rule'" class="grid">
          <button
            v-for="c in gm.categories"
            :key="c.id"
            class="btn sm"
            :class="{ sel: gm.selected.includes(c.id) }"
            @click="post('select-category', { category: c.id })"
          >{{ c.name }}</button>
        </div>
        <div v-if="gm.gameId === 'five-second-rule'" class="grid">
          <button
            v-for="t in [3, 5, 7, 10]"
            :key="t"
            class="btn sm"
            :class="{ sel: gm.timerSeconds === t }"
            @click="post('set-timer', { seconds: t })"
          >{{ t }}s</button>
        </div>
        <label v-if="gm.gameId === 'five-second-rule'" class="auto">
          <input type="checkbox" :checked="gm.autoAdvance" @change="post('set-auto', { on: ($event.target as HTMLInputElement).checked })" />
          <span>Auto-advance (10s)</span>
        </label>
        <button class="btn btn-primary" :disabled="startDisabled" @click="post('start')">▶ Start game</button>
        <p v-if="startError" class="err">{{ startError }}</p>
      </template>

      <div v-else class="row2">
        <button class="btn btn-accent" @click="post('next')">Next ▶</button>
        <button class="btn btn-danger" @click="post('end')">End</button>
      </div>

      <button class="btn reset" @click="doReset">↺ Reset game</button>
    </div>
  </div>
</template>

<style scoped>
.gmbar { width: 100%; max-width: 480px; margin: 0 auto 16px; padding: 12px 14px; border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
.bar-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.head-right { display: flex; align-items: center; gap: 12px; }
.link { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
.chev { color: var(--muted); }
.bar-body { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.btn.sm { min-height: 44px; font-size: 1rem; padding: 0 12px; }
.row2 { display: flex; gap: 10px; }
.row2 .btn { flex: 1; }
.auto { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; cursor: pointer; }
.auto input { width: 20px; height: 20px; accent-color: var(--accent); }
.err { color: #fca5a5; margin: 0; }
.reset { min-height: 40px; font-size: 0.9rem; color: var(--muted); background: transparent; border: 1px solid var(--border); margin-top: 4px; }
.reset:hover { background: color-mix(in srgb, var(--danger) 18%, transparent); color: #ffd7dc; border-color: color-mix(in srgb, var(--danger) 50%, transparent); }
</style>
