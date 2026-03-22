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
    const label = device.value.attributes?.find(a => a.name === 'description')?.['string-state']
      ?? device.value['bridge-identifier']
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
  <div v-if="error" class="error">Error: {{ error.message }}</div>
  <div v-else-if="!device" class="empty">Loading...</div>
  <template v-else>
    <div v-if="!device.capabilities.length" class="empty">No capabilities.</div>
    <button
      v-for="cap in device.capabilities"
      :key="cap.name"
      class="capability-card"
      @click="openDialog(cap)"
    >
      {{ cap.name }}
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
.capability-card {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1.25rem 1.5rem;
  background: #42b983;
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.capability-card:active { background: #369870; }
.empty { color: #888; text-align: center; margin-top: 2rem; }
.error { color: #c0392b; }
</style>
