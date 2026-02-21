<script setup>

import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'

const adapters = ref([])
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

onMounted(fetchAdapters)

async function fetchAdapters() {
  try {
    const response = await axios.get('/adapter-attendant/v1/adapters')
    adapters.value = response.data || []
    error.value = null
  } catch (err) {
    error.value = err
  }
}

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
    adapters.value = [...adapters.value, created]
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

function onRowClick(adapterId) {
  if (selectedId.value === String(adapterId)) {
    // If already selected, close detail view
    router.push({ name: 'Adapters' });
  } else {
    router.push({ name: 'AdapterDetail', params: { id: adapterId } });
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="adapter-split-layout">
    <div class="adapter-table" :class="{ 'half': selectedId }">
      <div class="title-row">
        <h1>Adapters</h1>
        <button class="create-button" @click="openCreateDialog">Create</button>
      </div>
      <div v-if="error">Error: {{ error.message }}</div>
      <div class="table-wrapper">
        <div class="table-header">
          <div class="table-cell id-cell">ID</div>
          <div class="table-cell name-cell">Name</div>
          <div class="table-cell">Image</div>
          <div class="table-cell">Tag</div>
          <div class="table-cell">Synced</div>
        </div>
        <div v-for="adapter in adapters" :key="adapter.id" @click="onRowClick(adapter.id)" :class="['table-row', { selected: String(adapter.id) === selectedId }]">
          <div class="table-cell id-cell" :title="String(adapter.id)">{{ adapter.id }}</div>
          <div class="table-cell name-cell" :title="adapter.name">{{ adapter.name }}</div>
          <div class="table-cell" :title="adapter.imageName">{{ adapter.imageName }}</div>
          <div class="table-cell" :title="adapter.imageTag">{{ adapter.imageTag }}</div>
          <div class="table-cell" :title="adapter.synced || 'Not synced'">{{ adapter.synced || 'Not synced' }}</div>
        </div>
      </div>
    </div>
    <div v-if="selectedId" class="adapter-detail-half">
      <router-view />
    </div>

    <div v-if="showCreateDialog" class="dialog-backdrop">
      <div class="dialog">
        <h3>Create Adapter</h3>
        <input
          v-model="newAdapter.name"
          class="create-input create-name"
          type="text"
          placeholder="Name"
        />
        <input
          v-model="newAdapter.imageName"
          class="create-input"
          type="text"
          placeholder="Image name"
        />
        <input
          v-model="newAdapter.imageTag"
          class="create-input"
          type="text"
          placeholder="Image tag"
        />
        <div class="dialog-actions">
          <button
            class="dialog-save-button"
            :disabled="creatingAdapter || !newAdapter.name || !newAdapter.imageName || !newAdapter.imageTag"
            @click="createAdapter"
          >
            {{ creatingAdapter ? 'Saving...' : 'Save' }}
          </button>
          <button class="dialog-cancel-button" :disabled="creatingAdapter" @click="closeCreateDialog">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adapter-split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.adapter-table {
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
.adapter-table.half {
  flex: 1;
  max-width: 50%;
}
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.create-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  margin-bottom: 0.6rem;
}
.create-name {
  min-width: 0;
}
.create-button {
  padding: 0.45rem 0.8rem;
  border: 1px solid #2e7d32;
  background: #2e7d32;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.create-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  width: 420px;
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

.adapter-detail-half {
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
  overflow-y: auto;
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
  width: 240px;
  padding: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}
.name-cell {
  min-width: 300px;
  max-width: 300px;
  width: 300px;
  font-weight: bold;
}
.id-cell {
  min-width: 80px;
  max-width: 80px;
  width: 80px;
  font-weight: bold;
}
</style>
