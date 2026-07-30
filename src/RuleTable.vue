<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const rules = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()

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

function isCooldownActive(rule) {
  return rule['cooldown-until'] && new Date(rule['cooldown-until']) > new Date()
}

const selectedId = computed(() => route.params.id)

async function fetchRules() {
  try {
    const offset = currentPage.value * pageSize.value
    const response = await axios.get('/ittt-orchestrator/v0/rules', {
      params: { offset, limit: pageSize.value }
    })
    rules.value = Array.isArray(response.data) ? response.data : []
    const totalHeader = response.headers['x-total-count']
    totalCount.value = totalHeader != null ? parseInt(totalHeader, 10) : rules.value.length
    // If the current page no longer exists (e.g. rules were removed), step back and refetch.
    const maxPage = Math.max(0, totalPages.value - 1)
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
      await fetchRules()
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
  fetchRules()
}

function recalcPageSizeAndFetch() {
  const newPageSize = calculatePageSize()
  if (newPageSize === pageSize.value) return
  // Keep viewing roughly the same rules when the page size changes.
  const firstVisibleIndex = currentPage.value * pageSize.value
  pageSize.value = newPageSize
  currentPage.value = Math.floor(firstVisibleIndex / newPageSize)
  fetchRules()
}

function handleResize() {
  clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(recalcPageSizeAndFetch, RESIZE_DEBOUNCE_MS)
}

onMounted(async () => {
  await nextTick()
  pageSize.value = calculatePageSize()
  await fetchRules()

  if (tableWrapperRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(tableWrapperRef.value)
  }
});
onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  clearTimeout(resizeDebounceTimer);
});

function onRowClick(rule) {
  if (selectedId.value == rule.id) {
    router.push({ name: 'Rules' })
  } else {
    router.push({ name: 'RuleDetail', params: { id: rule.id } })
  }
}

async function createRule() {
  try {
    const response = await axios.post('/ittt-orchestrator/v0/rules', {
      name: 'New rule',
      enabled: false,
    })
    const created = response.data
    // Pagination/total count shift when a rule is added, so refetch rather than pushing locally.
    await fetchRules()
    router.push({ name: 'RuleDetail', params: { id: created.id } })
  } catch (err) {
    error.value = err
  }
}

function onRuleUpdated(updated) {
  const idx = rules.value.findIndex(r => r.id === updated.id)
  if (idx !== -1) rules.value.splice(idx, 1, updated)
}

function onRuleDeleted(id) {
  router.push({ name: 'Rules' })
  // Pagination/total count shift when a rule disappears, so refetch rather than filtering locally.
  fetchRules()
}
</script>

<template>
  <div class="rule-view">
    <div class="pane-header">
      <h1>Rules</h1>
      <button class="btn-create" @click="createRule">+ New rule</button>
    </div>
    <div v-if="error" class="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <div class="list-pane" :class="{ half: selectedId }">
        <div class="table-wrapper" ref="tableWrapperRef">
          <div class="table-header">
            <div class="cell cell-id">ID</div>
            <div class="cell cell-name">Name</div>
            <div class="cell cell-enabled">Enabled</div>
            <div class="cell cell-count">Actions</div>
            <div class="cell cell-backoff">Cooldown</div>
            <div class="cell cell-next">Next occurrence</div>
          </div>
          <div
            v-for="rule in rules" :key="rule.id"
            class="table-row"
            :class="{ selected: rule.id == selectedId }"
            @click="onRowClick(rule)"
          >
            <div class="cell cell-id">{{ rule.id }}</div>
            <div class="cell cell-name">{{ rule.name }}</div>
            <div class="cell cell-enabled">{{ rule.enabled ? '✓' : '—' }}</div>
            <div class="cell cell-count">{{ rule.actions?.length ?? 0 }}</div>
            <div class="cell cell-backoff" :class="{ 'backoff-active': isCooldownActive(rule) }">
              {{ isCooldownActive(rule) ? new Date(rule['cooldown-until']).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—' }}
            </div>
            <div class="cell cell-next">{{ rule['next-occurence'] ? new Date(rule['next-occurence']).toLocaleString(undefined, { timeZoneName: 'short' }) : '—' }}</div>
          </div>
          <div v-if="rules.length === 0 && !error" class="empty">
            <p>No rules yet.</p>
            <p>Click <strong>+ New rule</strong> to create one.</p>
          </div>
        </div>
      </div>

      <div v-if="selectedId" class="detail-pane">
        <router-view @updated="onRuleUpdated" @deleted="onRuleDeleted" />
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
.rule-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.split-content {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.list-pane {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  transition: max-width 0.3s;
}
.list-pane.half {
  max-width: 40%;
}
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
.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 1rem;
  flex-shrink: 0;
}
.pane-header h1 {
  margin: 0 0 0.5rem 0;
}
.btn-create {
  padding: 0.4rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-create:hover { background: #369870; }
.error { color: red; padding: 0.5rem; }
.table-wrapper {
  flex: 1 1 0;
  overflow-y: hidden;
  overflow-x: hidden;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eee;
  height: 40px;
  box-sizing: border-box;
}
.table-header {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  position: sticky;
  top: 0;
}
.table-row {
  cursor: pointer;
  transition: background 0.15s;
}
.table-row:hover { background: #f0f9f5; }
.table-row.selected { background: #e6f7ff; }
.cell {
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-id      { width: 60px;  flex-shrink: 0; font-weight: bold; }
.cell-name    { flex: 1; min-width: 0; }
.cell-enabled { width: 72px;  flex-shrink: 0; text-align: center; }
.cell-count   { width: 72px;  flex-shrink: 0; text-align: center; }
.cell-backoff { width: 72px;  flex-shrink: 0; text-align: center; }
.cell-next    { width: 200px; flex-shrink: 0; }
.table-row .cell-backoff { color: #777; font-size: 0.85rem; }
.table-row .cell-backoff.backoff-active { color: #e65100; font-weight: 500; }
.table-row .cell-next { color: #777; font-size: 0.85rem; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
.empty p { margin: 0.25rem 0; }
.detail-pane {
  flex: 1;
  border-left: 1px solid #ddd;
  background: #fff;
  overflow-y: auto;
  padding: 1.5rem;
  min-width: 0;
}
</style>
