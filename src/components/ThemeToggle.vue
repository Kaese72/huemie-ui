<script setup>
import { useTheme } from '../composables/useTheme.js'

// The light/dark switch shown in every top bar, next to the account button.
// It shows the theme you'd switch *to*: the sun in dark mode, the moon in light.
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <button
    class="theme-toggle"
    :class="theme"
    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
    @click="toggleTheme"
  >
    <!-- Sun and moon share one SVG and swap with a rotation. -->
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g class="sun">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </g>
      <path class="moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--text);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.theme-toggle:hover {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  border-color: color-mix(in srgb, var(--warm) 60%, transparent);
}
.theme-toggle:focus-visible {
  outline: 2px solid var(--warm);
  outline-offset: 2px;
}
svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  overflow: visible;
}
.sun,
.moon {
  transform-origin: 12px 12px;
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.3s ease;
}
.dark .moon,
.light .sun {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}
.sun circle {
  fill: currentColor;
}

@media (prefers-reduced-motion: reduce) {
  .sun, .moon { transition: opacity 0.2s; }
}
</style>
