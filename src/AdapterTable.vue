<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import { useTableList } from './composables/useTableList.js'

const error = ref(null)
const creatingAdapter = ref(false)
const showCreateDialog = ref(false)
const newAdapter = ref({
  name: '',
  imageName: '',
  imageTag: ''
})
const router = useRouter()
const route = useRoute()

const columns = [
  { key: 'id', label: 'ID', width: '60px', sortable: true },
  { key: 'name', label: 'Name', sortable: true, filter: { type: 'text' } },
  { key: 'imageName', label: 'Image', sortable: true, filter: { type: 'text' } },
  { key: 'imageTag', label: 'Tag', sortable: true, filter: { type: 'text' } },
  { key: 'created', label: 'Created', width: '200px', sortable: true, filter: { type: 'date' } },
  { key: 'updated', label: 'Updated', width: '200px', sortable: true, filter: { type: 'date' } },
  { key: 'synced', label: 'Synced' },
]

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/adapter-attendant/v1/adapters', { params })
  const rows = response.data || []
  const totalHeader = response.headers['x-total-count']
  return { rows, total: totalHeader != null ? parseInt(totalHeader, 10) : rows.length }
}

const {
  rows: adapters,
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

async function createAdapter() {
  if (!newAdapter.value.name || !newAdapter.value.imageName || !newAdapter.value.imageTag) {
    return
  }
  creatingAdapter.value = true
  try {
    const response = await axios.post('/adapter-attendant/v1/adapters', {
      name: newAdapter.value.name,
      imageName: newAdapter.value.imageName,
      imageTag: newAdapter.value.imageTag
    })
    const created = response.data
    // Pagination/total count shift when an adapter is added, so refetch rather than pushing locally.
    await refresh()
    newAdapter.value = { name: '', imageName: '', imageTag: '' }
    showCreateDialog.value = false
    error.value = null
    router.push({ name: 'AdapterDetail', params: { id: created.id } })
  } catch (err) {
    error.value = err
  } finally {
    creatingAdapter.value = false
  }
}

function openCreateDialog() {
  showCreateDialog.value = true
}

function closeCreateDialog() {
  if (creatingAdapter.value) {
    return
  }
  showCreateDialog.value = false
  newAdapter.value = { name: '', imageName: '', imageTag: '' }
}

function onRowClick(adapter) {
  if (String(adapter.id) === String(selectedId.value)) {
    // If already selected, close detail view
    router.push({ name: 'Adapters' });
  } else {
    router.push({ name: 'AdapterDetail', params: { id: adapter.id } });
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="adapter-table">
    <div class="title-row">
      <h1>Adapters</h1>
      <button class="create-button" @click="openCreateDialog">Create</button>
    </div>
    <div v-if="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <TableShell
        :columns="columns"
        :rows="adapters"
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
        <template #cell-created="{ row }">{{ new Date(row.created).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
        <template #cell-updated="{ row }">{{ new Date(row.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
        <template #cell-synced="{ row }">{{ row.synced || 'Not synced' }}</template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view />
      </DetailOverlay>
    </div>

    <div v-if="showCreateDialog" class="dialog-backdrop">
      <div class="dialog">
        <h3>Create Adapter</h3>
        <input v-model="newAdapter.name" class="create-input create-name" type="text" placeholder="Name" />
        <input v-model="newAdapter.imageName" class="create-input" type="text" placeholder="Image name" />
        <input v-model="newAdapter.imageTag" class="create-input" type="text" placeholder="Image tag" />
        <div class="dialog-actions">
          <button class="dialog-save-button" :disabled="creatingAdapter || !newAdapter.name || !newAdapter.imageName || !newAdapter.imageTag" @click="createAdapter">
            {{ creatingAdapter ? 'Saving...' : 'Save' }}
          </button>
          <button class="dialog-cancel-button" :disabled="creatingAdapter" @click="closeCreateDialog">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adapter-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 1rem;
  flex-shrink: 0;
}
.title-row h1 {
  margin: 0 0 0.5rem 0;
}
.create-button {
  padding: 0.4rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.create-button:hover { background: #369870; }
.split-content {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}
.dialog {
  width: 360px;
  max-width: calc(100vw - 2rem);
  background: #fff;
  border-radius: 6px;
  border: 1px solid #ddd;
  padding: 1rem;
}
.dialog h3 {
  margin-top: 0;
  margin-bottom: 0.8rem;
}
.create-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  margin-bottom: 0.6rem;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.dialog-save-button,
.dialog-cancel-button {
  padding: 0.45rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
}
.dialog-save-button {
  border: 1px solid #2e7d32;
  background: #2e7d32;
  color: #fff;
}
.dialog-save-button:disabled,
.dialog-cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.dialog-cancel-button {
  border: 1px solid #d0d0d0;
  background: #f4f4f4;
  color: #222;
}
</style>
