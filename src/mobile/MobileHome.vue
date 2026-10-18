<script setup>
import { onMounted } from 'vue'
import { useMobileTitle } from '../composables/useMobileTitle.js'

const { title } = useMobileTitle()
onMounted(() => { title.value = 'Humi' })
</script>

<template>
  <h2 class="m-greeting">Welcome home.</h2>
  <div class="m-categories">
    <button class="panel m-category" @click="$router.push({ name: 'MobileGroups' })">
      <span class="m-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20H4zM10 20v-5h4v5" /></svg>
      </span>
      <span class="m-category-label">Groups</span>
    </button>
    <button class="panel m-category" @click="$router.push({ name: 'MobileDevices' })">
      <span class="m-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></svg>
      </span>
      <span class="m-category-label">Devices</span>
    </button>
  </div>
</template>

<style scoped>
.m-greeting {
  margin: 8px 0 4px;
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}
.m-categories {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.m-category {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}
.m-category:active {
  transform: scale(0.98);
  border-color: color-mix(in srgb, var(--warm) 50%, transparent);
}
.m-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}
.m-icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: var(--icon);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.m-category-label {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
