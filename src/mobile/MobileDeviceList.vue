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
  return device.attributes?.find(a => a.name === 'description')?.['string-state'] ?? device['bridge-identifier']
}
</script>

<template>
  <div v-if="error" class="error">Error: {{ error.message }}</div>
  <div v-else-if="devices.length === 0" class="empty">No devices found.</div>
  <button
    v-for="device in devices"
    :key="device.id"
    class="item-card"
    @click="$router.push({ name: 'MobileDeviceDetail', params: { id: device.id } })"
  >
    <span class="item-name">{{ getLabel(device) }}</span>
    <span class="item-sub">{{ device.capabilities.length }} capabilities</span>
  </button>
</template>

<style scoped>
.item-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 1.25rem 1.5rem;
  background: #fff;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.item-card:active { background: #e6f7ff; }

.item-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #222e3a;
}

.item-sub {
  font-size: 0.875rem;
  color: #888;
  margin-top: 0.25rem;
}

.empty { color: #888; text-align: center; margin-top: 2rem; }
.error { color: #c0392b; }
</style>
