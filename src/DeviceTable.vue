<script setup>

import { ref, onMounted, computed, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { extractAttribute, extractAttributeUpdated } from './utils/deviceUtil.js'
import { useAuth } from './composables/useAuth.js'
import ColumnFilter from './components/ColumnFilter.vue'

const { useToken } = useAuth()

let sseAbortController = null;
let reconnectTimeout = null;
const devices = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()
const knownAttributes = ['description', 'active', 'brightness', 'colorx', 'colory', 'colorct']

// Pagination
// These must match the fixed heights set on .table-header/.table-row/.pagination-footer in <style>.
const ROW_HEIGHT_PX = 40
const HEADER_HEIGHT_PX = 40
const MIN_PAGE_SIZE = 1
const RESIZE_DEBOUNCE_MS = 300
const PAGE_WINDOW_RADIUS = 2

const tableWrapperRef = ref(null)
const pageSize = ref(MIN_PAGE_SIZE)
const currentPage = ref(0) // 0-indexed
const totalCount = ref(0)
let resizeObserver = null
let resizeDebounceTimer = null

// Column filtering
// columnFilters maps a device-store filter key ('id', or 'attribute.<name>')
// to { op, value }, as understood by the device-store `filters` query param.
const columnFilters = ref({})
// attributeStats maps attribute name -> { name, n-boolean, n-text, n-numeric }
// from GET /device-store/v0/attributes/statistics, used to decide which
// types are selectable (and which is pre-selected) in each attribute's
// filter dialog.
const attributeStats = ref({})

function buildFiltersParam() {
  const entries = Object.entries(columnFilters.value)
  if (entries.length === 0) return undefined
  return JSON.stringify(entries.map(([key, filter]) => ({ key, op: filter.op, value: filter.value })))
}

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

function onColumnFilterApply(key, filter) {
  columnFilters.value = { ...columnFilters.value, [key]: filter }
  currentPage.value = 0
  fetchDevices()
}

function onColumnFilterClear(key) {
  if (!(key in columnFilters.value)) return
  const next = { ...columnFilters.value }
  delete next[key]
  columnFilters.value = next
  currentPage.value = 0
  fetchDevices()
}

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const pageWindow = computed(() => {
  const pages = []
  const start = Math.max(0, currentPage.value - PAGE_WINDOW_RADIUS)
  const end = Math.min(totalPages.value - 1, currentPage.value + PAGE_WINDOW_RADIUS)
  for (let p = start; p <= end; p++) pages.push(p)
  return pages
})
const showFirst = computed(() => pageWindow.value.length === 0 || pageWindow.value[0] > 0)
const showLast = computed(() => pageWindow.value.length === 0 || pageWindow.value[pageWindow.value.length - 1] < totalPages.value - 1)

function calculatePageSize() {
  const el = tableWrapperRef.value
  if (!el || el.clientHeight === 0) return pageSize.value
  const availableHeight = el.clientHeight - HEADER_HEIGHT_PX
  return Math.max(MIN_PAGE_SIZE, Math.floor(availableHeight / ROW_HEIGHT_PX))
}

async function fetchDevices() {
  try {
    const offset = currentPage.value * pageSize.value
    const params = { offset, limit: pageSize.value }
    const filtersParam = buildFiltersParam()
    if (filtersParam) params.filters = filtersParam
    const response = await axios.get('/device-store/v0/devices', { params })
    devices.value = response.data
    const totalHeader = response.headers['x-total-count']
    totalCount.value = totalHeader != null ? parseInt(totalHeader, 10) : devices.value.length
    // If the current page no longer exists (e.g. devices were removed), step back and refetch.
    const maxPage = Math.max(0, totalPages.value - 1)
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
      await fetchDevices()
      return
    }
    error.value = null
  } catch (err) {
    error.value = err
  }
}

function goToPage(page) {
  const clamped = Math.min(Math.max(0, page), totalPages.value - 1)
  if (clamped === currentPage.value) return
  currentPage.value = clamped
  fetchDevices()
}

function recalcPageSizeAndFetch() {
  const newPageSize = calculatePageSize()
  if (newPageSize === pageSize.value) return
  // Keep viewing roughly the same devices when the page size changes.
  const firstVisibleIndex = currentPage.value * pageSize.value
  pageSize.value = newPageSize
  currentPage.value = Math.floor(firstVisibleIndex / newPageSize)
  fetchDevices()
}

function handleResize() {
  clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(recalcPageSizeAndFetch, RESIZE_DEBOUNCE_MS)
}

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
  fetchDevices()
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
  await nextTick()
  pageSize.value = calculatePageSize()
  await Promise.all([fetchDevices(), fetchAttributeStats()])

  if (tableWrapperRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(tableWrapperRef.value)
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
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  clearTimeout(resizeDebounceTimer);
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
  <div class="device-table">
    <h1>Devices</h1>
    <div v-if="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <div class="table-wrapper" :class="{ half: selectedId }" ref="tableWrapperRef">
        <div class="table-header">
          <div class="table-cell id-cell header-cell">
            <span class="header-label">ID</span>
            <ColumnFilter
              type="id"
              :active="!!columnFilters['id']"
              @apply="filter => onColumnFilterApply('id', filter)"
              @clear="() => onColumnFilterClear('id')"
            />
          </div>
          <div class="table-cell name-cell">Name</div>
          <div class="table-cell updated-cell">Updated</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell header-cell">
            <span class="header-label">{{ attr }}</span>
            <ColumnFilter
              type="attribute"
              :stats="attributeStats[attr]"
              :active="!!columnFilters['attribute.' + attr]"
              @apply="filter => onColumnFilterApply('attribute.' + attr, filter)"
              @clear="() => onColumnFilterClear('attribute.' + attr)"
            />
          </div>
        </div>
        <div v-for="device in devices" :key="device.id" @click="onRowClick(device)" :class="['table-row', { selected: device.id === selectedId }]">
          <div class="table-cell id-cell" :title="device.id">{{ device.id }}</div>
          <div class="table-cell name-cell" :title="device.name">{{ device.name }}</div>
          <div class="table-cell updated-cell" :title="device.updated">{{ device.updated }}</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell" :title="getAttributeTooltip(device, attr)">
            {{ extractAttribute(device, attr) }}
          </div>
        </div>
      </div>
      <div v-if="selectedId" class="device-detail-half">
        <router-view />
      </div>
    </div>
    <div class="pagination-footer">
      <button v-if="showFirst" class="page-btn" @click="goToPage(0)">0</button>
      <button class="page-btn nav-btn" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">&lt;</button>
      <button
        v-for="p in pageWindow"
        :key="p"
        class="page-btn"
        :class="{ current: p === currentPage }"
        :disabled="p === currentPage"
        @click="goToPage(p)"
      >{{ p === currentPage ? `[${p}]` : p }}</button>
      <button class="page-btn nav-btn" :disabled="currentPage === totalPages - 1" @click="goToPage(currentPage + 1)">&gt;</button>
      <button v-if="showLast" class="page-btn" @click="goToPage(totalPages - 1)">{{ totalPages - 1 }}</button>
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
  display: flex;
  overflow: hidden;
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
  min-width: 0;
  transition: flex 0.3s;
  overflow-x: scroll;
  overflow-y: hidden;
  box-sizing: border-box;
}
.table-wrapper.half {
  flex: 1;
  max-width: 50%;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: max-content;
  box-sizing: border-box;
  height: 40px;
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
.name-cell {
  min-width: 180px;
  max-width: 180px;
  width: 180px;
  font-weight: bold;
}
.header-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
}
.header-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.updated-cell {
  min-width: 220px;
  max-width: 220px;
  width: 220px;
}

/* Pagination footer */
.pagination-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 44px;
  border-top: 2px solid #ddd;
  background: #f5f5f5;
}
.page-btn {
  min-width: 2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font: inherit;
}
.page-btn:hover:not(:disabled) {
  background: #e6f7ff;
}
.page-btn:disabled {
  cursor: default;
  opacity: 0.4;
}
.page-btn.current {
  font-weight: bold;
  border-color: #1890ff;
  color: #1890ff;
  background: #fff;
  cursor: default;
}
.nav-btn {
  font-weight: bold;
}
</style>
