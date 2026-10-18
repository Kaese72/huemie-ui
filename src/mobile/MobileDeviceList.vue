<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useMobileTitle } from '../composables/useMobileTitle.js'

const devices = ref([])
const error = ref(null)
const { title } = useMobileTitle()

onMounted(async () => {
  title.value = 'Devices'
  try {
    const response = await axios.get('/device-store/v0/devices')
    devices.value = response.data
  } catch (err) {
    error.value = err
  }
})

function getLabel(device) {
  return device.name || (device.attributes?.find(a => a.name === 'description')?.['string-state'] ?? device['bridge-identifier'])
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <p v-else-if="devices.length === 0" class="empty m-empty">No devices found.</p>
  <button
    v-for="device in devices"
    :key="device.id"
    class="m-item"
    @click="$router.push({ name: 'MobileDeviceDetail', params: { id: device.id } })"
  >
    <span class="m-item-main">
      <span class="item-name">{{ getLabel(device) }}</span>
      <span class="item-sub">{{ device.capabilities.length }} capabilities</span>
    </span>
    <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
  </button>
</template>

<style scoped>
.m-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 14px 18px;
  border-radius: 20px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--ink) 4%, transparent),
    color-mix(in srgb, var(--ink) 1.5%, transparent));
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.m-item:active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.m-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.item-name {
  font-size: 1.05rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 2px;
}
.chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: var(--faint);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.m-empty {
  text-align: center;
  margin-top: 32px;
}
</style>
