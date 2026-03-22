<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useMobileTitle } from '../composables/useMobileTitle.js'
import CapabilityDialog from '../components/CapabilityDialog.vue'

const route = useRoute()
const group = ref(null)
const error = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)
const { title } = useMobileTitle()

onMounted(async () => {
  try {
    const response = await axios.get(`/device-store/v0/groups/${route.params.id}`)
    group.value = response.data
    title.value = group.value.name
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
  if (!group.value || !selectedCapability.value) return
  axios.post(`/device-store/v0/groups/${group.value.id}/capabilities/${selectedCapability.value.name}`, argumentValues)
    .then(() => closeDialog())
    .catch(err => console.error('Error triggering capability:', err))
}
</script>

<template>
  <div v-if="error" class="error">Error: {{ error.message }}</div>
  <div v-else-if="!group" class="empty">Loading...</div>
  <template v-else>
    <div v-if="!group.capabilities.length" class="empty">No capabilities.</div>
    <button
      v-for="cap in group.capabilities"
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
