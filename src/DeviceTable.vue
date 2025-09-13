<script setup>

import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { extractAttribute } from './utils/deviceUtil.js'

let eventSource = null;
let reconnectTimeout = null;
const devices = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()
const knownAttributes = ['description', 'active', 'colorx', 'colory', 'colorct']

onMounted(async () => {
  try {
    const response = await axios.get('/device-store/v0/devices')
    devices.value = response.data
  } catch (err) {
    error.value = err
  }

  // Open Server-Sent Events (SSE) for device events
  function connectSSE() {
    console.log('Connecting to SSE...');
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    eventSource = new EventSource('/device-store/v0/devices/events');
    eventSource.addEventListener('update', (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data['device-id'] && Array.isArray(data.attributes)) {
          // Find the device and update its attributes
          const idx = devices.value.findIndex(d => d.id == data['device-id']);
          if (idx !== -1) {
            // Merge updated attributes into the device
            const updatedDevice = { ...devices.value[idx] };
            updatedDevice.attributes = updatedDevice.attributes.map(attr => {
              const update = data.attributes.find(a => a.name === attr.name);
              return update ? { ...attr, ...update } : attr;
            });
            // Add any new attributes from the update
            data.attributes.forEach(update => {
              if (!updatedDevice.attributes.find(attr => attr.name === update.name)) {
                updatedDevice.attributes.push(update);
              }
            });
            devices.value.splice(idx, 1, updatedDevice);
          }
        }
      } catch (e) {
        // Ignore parse errors
        console.log('Error parsing SSE data:', e);
      }
    });
    eventSource.onerror = (event) => {
      // Close and reconnect after a delay (e.g., 2 seconds)
      console.log('SSE error, attempting to reconnect...', event);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connectSSE, 2000);
    };
  }
  connectSSE();
});
onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
});

// extractAttribute is now imported from utils

function triggerCapabilityWithoutParameters(deviceId, capability) {
  axios.post(`/device-store/v0/devices/${deviceId}/capabilities/${capability}`)
    .then(response => {
      console.log('Capability triggered successfully:', response.data);
    })
    .catch(error => {
      console.error('Error triggering capability:', error);
    });
}


function onRowClick(device) {
  // selectedId.value is a string while device.id is a number, thus we can not do a ===
  if (selectedId.value == device.id) {
    // If already selected, close detail view
    router.push({ name: 'Devices' });
  } else {
    router.push({ name: 'DeviceDetail', params: { id: device.id } });
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="device-split-layout">
    <div class="device-table" :class="{ 'half': selectedId }">
      <h1>Devices</h1>
      <div v-if="error">Error: {{ error.message }}</div>
      <div class="table-wrapper">
        <div class="table-header">
          <div class="table-cell id-cell">ID</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell">{{ attr }}</div>
        </div>
        <div v-for="device in devices" :key="device.id" @click="onRowClick(device)" :class="['table-row', { selected: device.id === selectedId }]">
          <div class="table-cell id-cell" :title="device.id">{{ device.id }}</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell" :title="extractAttribute(device, attr)">
            {{ extractAttribute(device, attr) }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="selectedId" class="device-detail-half">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.device-split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.device-table {
  flex: 1 1 0;
  min-width: 0;
  transition: flex 0.3s;
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.device-table.half {
  flex: 1;
  max-width: 50%;
}
.device-detail-half {
  flex: 1;
  max-width: 50%;
  border-left: 1px solid #ddd;
  padding-left: 2rem;
  background: #fff;
  overflow-y: auto;
}
/* Table-like flex layout */
.table-wrapper {
  width: 100%;
  height: 100%;
  flex: 1 1 0;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: max-content;
  box-sizing: border-box;
}
.table-header {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  position: sticky;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
}
.table-row {
  cursor: pointer;
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
}
.table-row.selected {
  background: #e6f7ff;
}
.table-cell {
  min-width: 240px;
  max-width: 240px;
  width: 180px;
  padding: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}
.id-cell {
  min-width: 80px;
  max-width: 80px;
  width: 80px;
  font-weight: bold;
}
.attr-cell {
  text-transform: capitalize;
}
</style>
