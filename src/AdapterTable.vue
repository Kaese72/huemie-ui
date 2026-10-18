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
  <div class="list-page">
    <div class="list-head">
      <div>
        <h1 class="list-title">Adapters</h1>
        <p class="list-lede">The bridges between the Appliance and your devices.</p>
      </div>
      <div class="list-actions">
        <button class="btn btn-primary" @click="openCreateDialog">New adapter</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
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
        <template #cell-synced="{ row }"><span v-if="row.synced">{{ row.synced }}</span><span v-else class="na">Not synced</span></template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view />
      </DetailOverlay>
    </div>

    <div v-if="showCreateDialog" class="dialog-backdrop">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="dialog-title">New adapter</h3>
        <div class="field">
          <label for="adapter-name">Name</label>
          <input id="adapter-name" v-model="newAdapter.name" class="input" type="text" placeholder="e.g. Hue" />
        </div>
        <div class="field">
          <label for="adapter-image">Image name</label>
          <input id="adapter-image" v-model="newAdapter.imageName" class="input" type="text" placeholder="ghcr.io/…" />
        </div>
        <div class="field">
          <label for="adapter-tag">Image tag</label>
          <input id="adapter-tag" v-model="newAdapter.imageTag" class="input" type="text" placeholder="e.g. v1.2.3" />
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" :disabled="creatingAdapter" @click="closeCreateDialog">Cancel</button>
          <button class="btn btn-primary" :disabled="creatingAdapter || !newAdapter.name || !newAdapter.imageName || !newAdapter.imageTag" @click="createAdapter">
            {{ creatingAdapter ? 'Saving…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
