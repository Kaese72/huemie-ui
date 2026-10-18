<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useMobileTitle } from '../composables/useMobileTitle.js'
import CapabilityDialog from '../components/CapabilityDialog.vue'

const route = useRoute()
const device = ref(null)
const error = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)
const { title } = useMobileTitle()

onMounted(async () => {
  try {
    const response = await axios.get(`/device-store/v0/devices/${route.params.id}`)
    device.value = response.data
    const label = device.value.name
      || device.value.attributes?.find(a => a.name === 'description')?.['string-state']
      || device.value['bridge-identifier']
    title.value = label
  } catch (err) {
    error.value = err
  }
})

function openDialog(cap) {
  selectedCapability.value = cap
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  selectedCapability.value = null
}

function triggerCapability(argumentValues) {
  if (!device.value || !selectedCapability.value) return
  axios.post(`/device-store/v0/devices/${device.value.id}/capabilities/${selectedCapability.value.name}`, argumentValues)
    .then(() => closeDialog())
    .catch(err => console.error('Error triggering capability:', err))
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <p v-else-if="!device" class="empty m-empty">Loading…</p>
  <template v-else>
    <p v-if="!device.capabilities.length" class="empty m-empty">No capabilities.</p>
    <button
      v-for="cap in device.capabilities"
      :key="cap.name"
      class="m-capability"
      @click="openDialog(cap)"
    >
      {{ cap.name }}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
    <CapabilityDialog
      v-if="selectedCapability"
      :capability="selectedCapability"
      :show="showDialog"
      @close="closeDialog"
      @trigger="triggerCapability"
    />
  </template>
</template>

<style scoped>
/* Big ghost cards. Pressing one lights it warm for a moment: a command
   going out to the device. */
.m-capability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 20px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  color: var(--text);
  font: inherit;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.m-capability svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  fill: none;
  stroke: var(--warm);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.m-capability:active {
  background: color-mix(in srgb, var(--warm) 14%, transparent);
  border-color: color-mix(in srgb, var(--warm) 55%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--warm) 25%, transparent);
}
.m-empty {
  text-align: center;
  margin-top: 32px;
}
</style>
