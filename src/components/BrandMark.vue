<!-- The Humi logo: house outline with a lit door, plus the wordmark. Wrap it
     in whatever link the context needs. -->
<template>
  <span class="brand">
    <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 15 16 6l11 9v11H5z" />
      <rect x="13" y="18" width="6" height="8" rx="1" />
    </svg>
    <span>Humi</span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: -0.03em;
}
.brand-mark {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: var(--warm);
  stroke-width: 2.2;
  stroke-linejoin: round;
}
.brand-mark rect {
  fill: var(--warm);
  stroke: none;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--warm) 80%, transparent));
}
</style>
