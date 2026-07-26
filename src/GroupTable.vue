<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'

const groups = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()
const knownAttributes = ['name', 'updated']

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

async function fetchGroups() {
  try {
    const offset = currentPage.value * pageSize.value
    const response = await axios.get('/device-store/v0/groups', {
      params: { offset, limit: pageSize.value }
    })
    groups.value = response.data
    const totalHeader = response.headers['x-total-count']
    totalCount.value = totalHeader != null ? parseInt(totalHeader, 10) : groups.value.length
    // If the current page no longer exists (e.g. groups were removed), step back and refetch.
    const maxPage = Math.max(0, totalPages.value - 1)
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
      await fetchGroups()
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
  fetchGroups()
}

function recalcPageSizeAndFetch() {
  const newPageSize = calculatePageSize()
  if (newPageSize === pageSize.value) return
  // Keep viewing roughly the same groups when the page size changes.
  const firstVisibleIndex = currentPage.value * pageSize.value
  pageSize.value = newPageSize
  currentPage.value = Math.floor(firstVisibleIndex / newPageSize)
  fetchGroups()
}

function handleResize() {
  clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(recalcPageSizeAndFetch, RESIZE_DEBOUNCE_MS)
}

function onGroupForgotten(event) {
  const forgottenId = event?.detail?.id
  if (forgottenId == null) return
  // Pagination/total count shift when a group disappears, so refetch rather than splice locally.
  fetchGroups()
}

onMounted(async () => {
  await nextTick()
  pageSize.value = calculatePageSize()
  await fetchGroups()

  if (tableWrapperRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(tableWrapperRef.value)
  }

  window.addEventListener('group-forgotten', onGroupForgotten)
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  clearTimeout(resizeDebounceTimer)
  window.removeEventListener('group-forgotten', onGroupForgotten)
})

function onRowClick(group) {
  if (selectedId.value == group.id) {
    router.push({ name: 'Groups' })
  } else {
    router.push({ name: 'GroupDetail', params: { id: group.id, tab: 'state' } })
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="group-table">
    <h1>Groups</h1>
    <div v-if="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <div class="table-wrapper" :class="{ half: selectedId }" ref="tableWrapperRef">
        <div class="table-header">
          <div class="table-cell id-cell">ID</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell">{{ attr }}</div>
        </div>
        <div v-for="group in groups" :key="group.id" @click="onRowClick(group)" :class="['table-row', { selected: group.id === selectedId }]">
          <div class="table-cell id-cell" :title="group.id">{{ group.id }}</div>
          <div v-for="attr in knownAttributes" :key="group.id + '-' + attr" class="table-cell attr-cell" :title="group[attr]">
            {{ group[attr] }}
          </div>
        </div>
      </div>
      <div v-if="selectedId" class="group-detail-half">
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
.group-table {
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
.group-detail-half {
  flex: 1;
  max-width: 50%;
  border-left: 1px solid #ddd;
  padding-left: 2rem;
  background: #fff;
  overflow-y: auto;
}
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
