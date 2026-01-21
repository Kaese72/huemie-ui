<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { extractAttribute } from './utils/deviceUtil.js'
import CapabilityDialog from './components/CapabilityDialog.vue'

const route = useRoute()
const device = ref(null)
const error = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)

onMounted(fetchDevice)
watch(() => route.params.id, fetchDevice)

async function fetchDevice() {
  if (!route.params.id) return
  try {
    const response = await axios.get(`/device-store/v0/devices/${route.params.id}`)
    device.value = response.data
    error.value = null
  } catch (err) {
    error.value = err
    device.value = null
  }
}

// extractAttribute is now imported from utils

function openCapabilityDialog(capability) {
  selectedCapability.value = capability
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  selectedCapability.value = null
}

function triggerCapability(argumentValues) {
  if (!device.value || !selectedCapability.value) return;
  
  axios.post(
    `/device-store/v0/devices/${device.value.id}/capabilities/${selectedCapability.value.name}`,
    argumentValues
  )
    .then(response => {
      closeDialog()
      // Optionally show a success message
      // e.g., alert('Capability triggered!');
    })
    .catch(error => {
      // Optionally show an error message
      console.error('Error triggering capability:', error)
      // e.g., alert('Error triggering capability');
    });
}
</script>

<template>
  <div v-if="error">Error: {{ error.message }}</div>
  <div v-else-if="device">
    <h2>Device Details: {{ device.id }}</h2>
    <ul>
      <li><strong>Description:</strong> {{ extractAttribute(device, 'description') }}</li>
      <li><strong>Active:</strong> {{ extractAttribute(device, 'active') }}</li>
      <!-- Add more attributes as needed -->
    </ul>
    <div v-if="device.capabilities && device.capabilities.length">
      <h3>Capabilities</h3>
      <div class="capabilities-list">
        <button v-for="cap in device.capabilities" :key="cap.name" @click="openCapabilityDialog(cap)">
          Trigger {{ cap.name }}
        </button>
      </div>
    </div>
    
    <CapabilityDialog
      v-if="selectedCapability"
      :capability="selectedCapability"
      :show="showDialog"
      @close="closeDialog"
      @trigger="triggerCapability"
    />
  </div>
  <div v-else>Loading...</div>
</template>

<style scoped>
  .capabilities-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .capabilities-list button {
    padding: 0.5rem 1rem;
    background: #42b983;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .capabilities-list button:hover {
    background: #369870;
  }
ul {
  list-style: none;
  padding: 0;
}
li {
  margin-bottom: 0.5rem;
}
</style>
