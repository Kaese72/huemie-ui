<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { extractAttribute } from './utils/deviceUtil.js'

const route = useRoute()
const device = ref(null)
const error = ref(null)

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

function triggerCapability(capability) {
  if (!device.value) return;
  axios.post(`/device-store/v0/devices/${device.value.id}/capabilities/${capability}`)
    .then(response => {
      // Optionally show a success message
      // e.g., alert('Capability triggered!');
    })
    .catch(error => {
      // Optionally show an error message
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
        <button v-for="cap in device.capabilities" :key="cap.name" @click="triggerCapability(cap.name)">
          Trigger {{ cap.name }}
        </button>
      </div>
    </div>
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
