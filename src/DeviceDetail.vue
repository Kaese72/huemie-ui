<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import CapabilityDialog from './components/CapabilityDialog.vue'

const route = useRoute()
const router = useRouter()
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

function extractAttributeValue(attribute) {
  if (!attribute) return 'Unknown'
  if (attribute['string-state'] !== undefined && attribute['string-state'] !== null && attribute['string-state'] !== '') {
    return attribute['string-state']
  }
  if (attribute['boolean-state'] !== undefined && attribute['boolean-state'] !== null) {
    return attribute['boolean-state']
  }
  if (attribute['numeric-state'] !== undefined && attribute['numeric-state'] !== null) {
    return attribute['numeric-state']
  }
  return 'Unknown'
}

async function forgetDevice() {
  if (!device.value) return
  const accepted = window.confirm(`Forget device ${device.value.id}?`)
  if (!accepted) return

  try {
    await axios.delete(`/device-store/v0/devices/${device.value.id}`)
    window.dispatchEvent(new CustomEvent('device-forgotten', { detail: { id: device.value.id } }))
    await router.push({ name: 'Devices' })
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div v-if="error">Error: {{ error.message }}</div>
  <div v-else-if="device">
    <h2>Device Details: {{ device.id }}</h2>
    <div class="device-meta">
      <strong>Bridge identifier:</strong> {{ device['bridge-identifier'] }}<br>
      <strong>Last updated:</strong> {{ device.updated || 'Unknown' }}
    </div>

    <div v-if="device.attributes && device.attributes.length">
      <h3>Attributes</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="attribute in device.attributes" :key="attribute.name">
            <td>{{ attribute.name }}</td>
            <td>{{ extractAttributeValue(attribute) }}</td>
            <td>{{ attribute.updated || 'Unknown' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="device.capabilities && device.capabilities.length">
      <h3>Capabilities</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cap in device.capabilities" :key="cap.name">
            <td>{{ cap.name }}</td>
            <td>{{ cap.updated || 'Unknown' }}</td>
            <td>
              <button class="trigger-button" @click="openCapabilityDialog(cap)">
                Trigger {{ cap.name }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="forget-section">
      <button class="forget-button" @click="forgetDevice">Forget device</button>
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
.device-meta {
  margin-bottom: 1rem;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}
.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
}
.data-table th {
  background: #f5f5f5;
}
.trigger-button {
  padding: 0.5rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.trigger-button:hover {
  background: #369870;
}
.forget-section {
  margin-top: 1rem;
}
.forget-button {
  padding: 0.5rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.forget-button:hover {
  background: #369870;
}
</style>
