<script setup lang="ts">
// Shown to the host on the player screen — just a link to the full control
// panel. The host plays here; taps through to /gm to run the game.
</script>

<template>
  <a href="/gm" class="gmbar card">
    <span>🎛️ You're the host</span>
    <span class="link">Open full panel ↗</span>
  </a>
</template>

<style scoped>
.gmbar {
  width: 100%;
  max-width: 480px;
  margin: 0 auto 16px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-decoration: none;
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 600;
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
}
.gmbar:active { transform: scale(0.99); }
.link { color: var(--accent); }
</style>
