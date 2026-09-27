<script setup>
import { onMounted, onBeforeUnmount, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import { useTableList } from './composables/useTableList.js'

const router = useRouter()
const route = useRoute()

const columns = [
  { key: 'id', label: 'ID', width: '80px', sortable: true, filter: { type: 'id-list' } },
  { key: 'name', label: 'name', sortable: true },
  { key: 'updated', label: 'updated' },
]

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/device-store/v0/groups', { params })
  const totalHeader = response.headers['x-total-count']
  return {
    rows: response.data,
    total: totalHeader != null ? parseInt(totalHeader, 10) : response.data.length,
  }
}

const {
  rows: groups,
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

function onGroupForgotten(event) {
  const forgottenId = event?.detail?.id
  if (forgottenId == null) return
  // Pagination/total count shift when a group disappears, so refetch rather than splice locally.
  refresh()
}

onMounted(() => {
  window.addEventListener('group-forgotten', onGroupForgotten)
})

onBeforeUnmount(() => {
  window.removeEventListener('group-forgotten', onGroupForgotten)
})

function onRowClick(group) {
  if (String(group.id) === String(selectedId.value)) {
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
      <TableShell
        :columns="columns"
        :rows="groups"
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
      />
      <DetailOverlay v-if="selectedId">
        <router-view />
      </DetailOverlay>
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
.group-table h1 {
  margin-bottom: 0.5rem;
}
.split-content {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
</style>
