<script setup>
import { computed } from 'vue'
import { useCurrentUser } from './composables/useCurrentUser.js'

const { user } = useCurrentUser()
const firstName = computed(() => user.value?.name || user.value?.username || '')

const shortcuts = [
  { to: '/devices', title: 'Devices', text: 'See and control everything your adapters have found.', icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z' },
  { to: '/groups', title: 'Groups', text: 'Rooms and zones, switched together.', icon: 'M4 10.5 12 4l8 6.5V20H4zM10 20v-5h4v5' },
  { to: '/rules', title: 'Rules', text: 'When something happens, do something about it.', icon: 'M5 7h9M5 12h14M5 17h6M17 5l2 2-2 2' },
  { to: '/ai-control', title: 'AI Control', text: 'Ask an assistant to look at and act on your home.', icon: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z' },
]
</script>

<template>
  <div class="scroll-page">
    <div class="page home enter">
      <p class="kicker">Appliance</p>
      <h1 class="page-title">Welcome home<template v-if="firstName">, {{ firstName }}</template>.</h1>
      <p class="page-lede">Everything here runs on this Appliance, in your home.</p>

      <div class="shortcuts">
        <router-link v-for="s in shortcuts" :key="s.to" :to="s.to" class="panel shortcut">
          <span class="shortcut-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="s.icon" /></svg>
          </span>
          <span class="shortcut-title">{{ s.title }}</span>
          <span class="shortcut-text">{{ s.text }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 900px;
}
.shortcuts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.shortcut {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text);
  text-decoration: none;
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.25s;
}
.shortcut:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--warm) 45%, transparent);
}
.shortcut-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}
.shortcut-icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--icon);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.shortcut:hover .shortcut-icon svg {
  stroke: var(--warm);
}
.shortcut-title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.shortcut-text {
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.5;
}
@media (max-width: 760px) {
  .shortcuts {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shortcut:hover { transform: none; }
}
</style>
