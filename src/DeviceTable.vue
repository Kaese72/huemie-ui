<script setup>

import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { extractAttribute, extractAttributeUpdated } from './utils/deviceUtil.js'
import { useAuth } from './composables/useAuth.js'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import AttributeValue from './components/AttributeValue.vue'
import { useTableList } from './composables/useTableList.js'

const { useToken } = useAuth()

let sseAbortController = null;
let reconnectTimeout = null;
const router = useRouter()
const route = useRoute()
const knownAttributes = ['description', 'active', 'brightness', 'colorx', 'colory', 'colorct']

// attributeStats maps attribute name -> { name, n-boolean, n-text, n-numeric }
// from GET /device-store/v0/attributes/statistics, used to decide which
// types are selectable (and which is pre-selected) in each attribute's
// filter dialog.
const attributeStats = ref({})

const columns = [
  { key: 'id', label: 'ID', width: '80px', sortable: true, filter: { type: 'id-list' } },
  { key: 'name', label: 'Name', width: '180px', sortable: true, filter: { type: 'text' } },
  { key: 'updated', label: 'Updated', width: '220px' },
  ...knownAttributes.map(attr => ({
    key: 'attribute.' + attr,
    label: attr,
    // Attribute values are typically short (a boolean, a small number, a
    // short color/text value) - a smaller default than the shared 240px
    // fallback keeps a wide device table from wasting space on them. The
    // header's own min-width (enough to fit its label + icons) still
    // floors this if the attribute name itself is longer than 50px.
    width: '50px',
    filter: { type: 'attribute', statsKey: attr },
  })),
]

async function fetchAttributeStats() {
  try {
    const response = await axios.get('/device-store/v0/attributes/statistics', {
      params: { names: knownAttributes.join(',') }
    })
    const statsByName = {}
    for (const stat of response.data || []) {
      statsByName[stat.name] = stat
    }
    attributeStats.value = statsByName
  } catch (err) {
    // Non-critical: filter dialogs just fall back to offering all types.
    console.log('Failed to fetch attribute statistics:', err)
  }
}

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/device-store/v0/devices', { params })
  const totalHeader = response.headers['x-total-count']
  return {
    rows: response.data,
    total: totalHeader != null ? parseInt(totalHeader, 10) : response.data.length,
  }
}

const {
  rows: devices,
  error,
  columnFilters,
  sort,
  currentPage,
  totalPages,
  pageWindow,
  showFirst,
  showLast,
  goToPage,
  onResize,
  onColumnFilterApply,
  onColumnFilterClear,
  onSortChange,
  loading,
  refresh,
} = useTableList({ fetchPage })

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
  // Pagination/total count shift when a device disappears, so refetch rather than splice locally.
  refresh()
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

onMounted(() => {
  fetchAttributeStats()
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
  <div class="device-table">
    <h1>Devices</h1>
    <div v-if="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <TableShell
        :columns="columns"
        :rows="devices"
        :selected-id="selectedId"
        :column-filters="columnFilters"
        :sort="sort"
        :loading="loading"
        :attribute-stats="attributeStats"
        :current-page="currentPage"
        :total-pages="totalPages"
        :page-window="pageWindow"
        :show-first="showFirst"
        :show-last="showLast"
        @row-click="onRowClick"
        @go-to-page="goToPage"
        @filter-apply="onColumnFilterApply"
        @filter-clear="onColumnFilterClear"
        @sort-change="onSortChange"
        @resize="onResize"
      >
        <template v-for="attr in knownAttributes" :key="attr" #[`cell-attribute.${attr}`]="{ row }">
          <AttributeValue :value="extractAttribute(row, attr)" :tooltip="getAttributeTooltip(row, attr)" />
        </template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view />
      </DetailOverlay>
    </div>
  </div>
</template>

<style scoped>
.device-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.split-content {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
</style>
