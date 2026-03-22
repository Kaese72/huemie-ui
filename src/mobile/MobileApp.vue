<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import CapabilityDialog from '../components/CapabilityDialog.vue'

const groups = ref([])
const error = ref(null)
const selectedGroup = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)

onMounted(async () => {
  try {
    const response = await axios.get('/device-store/v0/groups')
    groups.value = response.data
  } catch (err) {
    error.value = err
  }
})

function selectGroup(group) {
  selectedGroup.value = group
}

function goBack() {
  selectedGroup.value = null
}

function openCapabilityDialog(cap) {
  selectedCapability.value = cap
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  selectedCapability.value = null
}

function triggerCapability(argumentValues) {
  if (!selectedGroup.value || !selectedCapability.value) return
  axios.post(
    `/device-store/v0/groups/${selectedGroup.value.id}/capabilities/${selectedCapability.value.name}`,
    argumentValues
  )
    .then(() => closeDialog())
    .catch(err => console.error('Error triggering capability:', err))
}
</script>

<template>
  <div class="mobile-app">
    <header class="mobile-header">
      <button v-if="selectedGroup" class="back-btn" @click="goBack">&#8592;</button>
      <h1 class="mobile-title">{{ selectedGroup ? selectedGroup.name : 'Groups' }}</h1>
    </header>

    <div class="mobile-content">
      <div v-if="error" class="error">Error: {{ error.message }}</div>

      <!-- Groups list -->
      <template v-else-if="!selectedGroup">
        <div v-if="groups.length === 0" class="empty">No groups found.</div>
        <button
          v-for="group in groups"
          :key="group.id"
          class="group-card"
          @click="selectGroup(group)"
        >
          <span class="group-name">{{ group.name }}</span>
          <span class="group-caps">{{ group.capabilities.length }} capabilities</span>
        </button>
      </template>

      <!-- Group capabilities -->
      <template v-else>
        <div v-if="!selectedGroup.capabilities.length" class="empty">No capabilities.</div>
        <button
          v-for="cap in selectedGroup.capabilities"
          :key="cap.name"
          class="capability-card"
          @click="openCapabilityDialog(cap)"
        >
          {{ cap.name }}
        </button>
      </template>
    </div>

    <CapabilityDialog
      v-if="selectedCapability"
      :capability="selectedCapability"
      :show="showDialog"
      @close="closeDialog"
      @trigger="triggerCapability"
    />
  </div>
</template>

<style scoped>
.mobile-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f9fa;
}

.mobile-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #222e3a;
  color: #fff;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.mobile-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group-card,
.capability-card {
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
  transition: background 0.15s, box-shadow 0.15s;
}

.group-card:active,
.capability-card:active {
  background: #e6f7ff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.group-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #222e3a;
}

.group-caps {
  font-size: 0.875rem;
  color: #888;
  margin-top: 0.25rem;
}

.capability-card {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  background: #42b983;
  align-items: center;
}

.capability-card:active {
  background: #369870;
}

.empty {
  color: #888;
  text-align: center;
  margin-top: 2rem;
}

.error {
  color: #c0392b;
}
</style>
