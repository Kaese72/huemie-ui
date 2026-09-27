<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import BoolBadge from './components/BoolBadge.vue'
import { useTableList } from './composables/useTableList.js'

const router = useRouter()
const route = useRoute()

const columns = [
  { key: 'id', label: 'ID', width: '60px', sortable: true },
  { key: 'name', label: 'Name', sortable: true, filter: { type: 'text' } },
  { key: 'enabled', label: 'Enabled', width: '72px', filter: { type: 'boolean' } },
  { key: 'actions', label: 'Actions', width: '72px' },
  { key: 'cooldown', label: 'Cooldown', width: '72px' },
  { key: 'next', label: 'Next occurrence', width: '200px' },
]

function isCooldownActive(rule) {
  return rule['cooldown-until'] && new Date(rule['cooldown-until']) > new Date()
}

const selectedId = computed(() => route.params.id)

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/ittt-orchestrator/v0/rules', { params })
  const rows = Array.isArray(response.data) ? response.data : []
  const totalHeader = response.headers['x-total-count']
  return { rows, total: totalHeader != null ? parseInt(totalHeader, 10) : rows.length }
}

const {
  rows: rules,
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

function onRowClick(rule) {
  if (String(rule.id) === String(selectedId.value)) {
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
    await refresh()
    router.push({ name: 'RuleDetail', params: { id: created.id } })
  } catch (err) {
    error.value = err
  }
}

function onRuleUpdated(updated) {
  const idx = rules.value.findIndex(r => r.id === updated.id)
  if (idx !== -1) rules.value.splice(idx, 1, updated)
}

function onRuleDeleted() {
  router.push({ name: 'Rules' })
  // Pagination/total count shift when a rule disappears, so refetch rather than filtering locally.
  refresh()
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
      <TableShell
        :columns="columns"
        :rows="rules"
        :selected-id="selectedId"
        :column-filters="columnFilters"
        :sort="sort"
        :loading="loading"
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
        <template #cell-enabled="{ row }"><BoolBadge :value="row.enabled" /></template>
        <template #cell-actions="{ row }">{{ row.actions?.length ?? 0 }}</template>
        <template #cell-cooldown="{ row }">
          <span :class="{ 'backoff-active': isCooldownActive(row) }">
            {{ isCooldownActive(row) ? new Date(row['cooldown-until']).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—' }}
          </span>
        </template>
        <template #cell-next="{ row }">
          {{ row['next-occurence'] ? new Date(row['next-occurence']).toLocaleString(undefined, { timeZoneName: 'short' }) : '—' }}
        </template>
        <template #empty>
          <div class="empty">
            <p>No rules yet.</p>
            <p>Click <strong>+ New rule</strong> to create one.</p>
          </div>
        </template>
      </TableShell>

      <DetailOverlay v-if="selectedId">
        <router-view @updated="onRuleUpdated" @deleted="onRuleDeleted" />
      </DetailOverlay>
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
  position: relative;
  overflow: hidden;
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
.backoff-active { color: #e65100; font-weight: 500; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
.empty p { margin: 0.25rem 0; }
</style>
