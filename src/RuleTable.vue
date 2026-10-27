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
const creating = computed(() => route.name === 'RuleNew')

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

function createRule() {
  router.push({ name: 'RuleNew' })
}

async function onRuleCreated(created) {
  // Pagination/total count shift when a rule is added, so refetch rather than pushing locally.
  await refresh()
  router.replace({ name: 'RuleDetail', params: { id: created.id } })
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
  <div class="list-page">
    <div class="list-head">
      <div>
        <h1 class="list-title">Rules</h1>
        <p class="list-lede">When something happens at home, do something about it.</p>
      </div>
      <div class="list-actions">
        <button class="btn btn-primary" @click="createRule">New rule</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
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
          <span v-if="isCooldownActive(row)" class="badge badge-neutral" :title="`Cooling down until ${new Date(row['cooldown-until']).toLocaleString()}`">
            {{ new Date(row['cooldown-until']).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
          </span>
          <span v-else class="na">—</span>
        </template>
        <template #cell-next="{ row }">
          <template v-if="row['next-occurence']">{{ new Date(row['next-occurence']).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
          <span v-else class="na">—</span>
        </template>
        <template #empty>
          <div class="table-empty">
            <p>No rules yet.</p>
            <p>Click <strong>New rule</strong> to create one.</p>
          </div>
        </template>
      </TableShell>

      <DetailOverlay v-if="selectedId || creating">
        <router-view @created="onRuleCreated" @updated="onRuleUpdated" @deleted="onRuleDeleted" />
      </DetailOverlay>
    </div>
  </div>
</template>
