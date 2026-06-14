<script setup>

import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { extractAttribute, extractAttributeUpdated } from './utils/deviceUtil.js'
import { useAuth } from './composables/useAuth.js'

const { useToken } = useAuth()

let sseAbortController = null;
let reconnectTimeout = null;
const devices = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()
const knownAttributes = ['description', 'active', 'brightness', 'colorx', 'colory', 'colorct']

function getAttributeTooltip(device, attributeName) {
  const value = extractAttribute(device, attributeName)
  const updated = extractAttributeUpdated(device, attributeName)
  return `Value: ${value}\nUpdated: ${updated}`
}

function onDeviceForgotten(event) {
  const forgottenId = event?.detail?.id
  if (forgottenId == null) {
    return
  }
  devices.value = devices.value.filter(device => device.id !== forgottenId)
}

function handleSSEEvent(type, data) {
  if (type !== 'update') return;
  try {
    const parsed = JSON.parse(data);
    if (parsed['device-id'] && Array.isArray(parsed.attributes)) {
      const idx = devices.value.findIndex(d => d.id == parsed['device-id']);
      if (idx !== -1) {
        const updatedDevice = { ...devices.value[idx] };
        let latestAttributeUpdated = updatedDevice.updated || null;
        updatedDevice.attributes = updatedDevice.attributes.map(attr => {
          const update = parsed.attributes.find(a => a.name === attr.name);
          if (update?.updated && (!latestAttributeUpdated || update.updated > latestAttributeUpdated)) {
            latestAttributeUpdated = update.updated;
          }
          return update ? { ...attr, ...update } : attr;
        });
        parsed.attributes.forEach(update => {
          if (update?.updated && (!latestAttributeUpdated || update.updated > latestAttributeUpdated)) {
            latestAttributeUpdated = update.updated;
          }
          if (!updatedDevice.attributes.find(attr => attr.name === update.name)) {
            updatedDevice.attributes.push(update);
          }
        });
        if (latestAttributeUpdated) {
          updatedDevice.updated = latestAttributeUpdated;
        }
        devices.value.splice(idx, 1, updatedDevice);
      }
    }
  } catch (e) {
    console.log('Error parsing SSE data:', e);
  }
}

// EventSource cannot send headers, so we use fetch with a ReadableStream instead.
async function connectSSE() {
  console.log('Connecting to SSE...');
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
  sseAbortController = new AbortController();
  try {
    const response = await fetch('/device-store/v0/devices/events', {
      headers: {
        'Authorization': `Bearer ${useToken.value}`,
        'Accept': 'text/event-stream',
      },
      signal: sseAbortController.signal,
    });
    if (!response.ok) {
      throw new Error(`SSE connection failed with status ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete trailing line
      let currentType = 'message';
      let currentDataLines = [];
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentDataLines.push(line.slice(5).trim());
        } else if (line === '') {
          if (currentDataLines.length > 0) {
            handleSSEEvent(currentType, currentDataLines.join('\n'));
          }
          currentType = 'message';
          currentDataLines = [];
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.log('SSE error, attempting to reconnect...', err);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectSSE, 2000);
  }
}

onMounted(async () => {
  try {
    const response = await axios.get('/device-store/v0/devices')
    devices.value = response.data
  } catch (err) {
    error.value = err
  }

  connectSSE();

  window.addEventListener('device-forgotten', onDeviceForgotten)
});
onBeforeUnmount(() => {
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  window.removeEventListener('device-forgotten', onDeviceForgotten)
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
    router.push({ name: 'DeviceDetail', params: { id: device.id, tab: 'state' } });
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
          <div class="table-cell updated-cell">Updated</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell">{{ attr }}</div>
        </div>
        <div v-for="device in devices" :key="device.id" @click="onRowClick(device)" :class="['table-row', { selected: device.id === selectedId }]">
          <div class="table-cell id-cell" :title="device.id">{{ device.id }}</div>
          <div class="table-cell updated-cell" :title="device.updated">{{ device.updated }}</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell" :title="getAttributeTooltip(device, attr)">
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
.updated-cell {
  min-width: 220px;
  max-width: 220px;
  width: 220px;
}
</style>
