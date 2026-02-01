<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'

const route = useRoute()
const adapter = ref(null)
const configurations = ref([])
const editRows = ref({})
const savingRows = ref({})
const newConfig = ref({ key: '', value: '' })
const addingConfig = ref(false)
const syncingAdapter = ref(false)
const showImageTagDialog = ref(false)
const newImageTag = ref('')
const updatingImageTag = ref(false)
const error = ref(null)

onMounted(fetchAdapter)
watch(() => route.params.id, fetchAdapter)

async function fetchAdapter() {
  if (!route.params.id) return
  adapter.value = null
  configurations.value = []
  newConfig.value = { key: '', value: '' }
  try {
    const response = await axios.get(`/adapter-attendant/v1/adapters/${route.params.id}`)
    adapter.value = response.data
    error.value = null
  } catch (err) {
    error.value = err
    adapter.value = null
    return
  }
  try {
    const configResponse = await axios.get(`/adapter-attendant/v1/adapters/${route.params.id}/arguments`)
    configurations.value = configResponse.data || []
    editRows.value = configurations.value.reduce((acc, config) => {
      acc[config.id] = { key: config.configKey, value: config.configValue }
      return acc
    }, {})
  } catch (err) {
    configurations.value = []
    editRows.value = {}
  }
}

async function confirmUpdate(config) {
  const draft = editRows.value[config.id]
  if (!draft) return
  if (!draft.key || !draft.value) return
  savingRows.value = { ...savingRows.value, [config.id]: true }
  try {
    const response = await axios.patch(`/adapter-attendant/v1/adapters/${route.params.id}/arguments/${config.id}`, {
      id: config.id,
      adapterId: config.adapterId ?? adapter.id,
      configKey: draft.key,
      configValue: draft.value
    })
    const updated = response.data
    configurations.value = configurations.value.map((item) => item.id === config.id ? updated : item)
    editRows.value = {
      ...editRows.value,
      [config.id]: { key: updated.configKey, value: updated.configValue }
    }
  } catch (err) {
    error.value = err
  } finally {
    const next = { ...savingRows.value }
    delete next[config.id]
    savingRows.value = next
  }
}

function isRowDirty(config) {
  const draft = editRows.value[config.id]
  if (!draft) return false
  return draft.key !== config.configKey || draft.value !== config.configValue
}

async function addConfiguration() {
  if (!newConfig.value.key || !newConfig.value.value) return
  addingConfig.value = true
  try {
    const response = await axios.post(`/adapter-attendant/v1/adapters/${route.params.id}/arguments`, {
      adapterId: adapter.value?.id,
      configKey: newConfig.value.key,
      configValue: newConfig.value.value
    })
    const created = response.data
    configurations.value = [...configurations.value, created]
    editRows.value = {
      ...editRows.value,
      [created.id]: { key: created.configKey, value: created.configValue }
    }
    newConfig.value = { key: '', value: '' }
  } catch (err) {
    error.value = err
  } finally {
    addingConfig.value = false
  }
}

async function syncAdapter() {
  if (!route.params.id) return
  syncingAdapter.value = true
  try {
    await axios.post(`/adapter-attendant/v1/adapters/${route.params.id}/sync`)
    await fetchAdapter()
  } catch (err) {
    error.value = err
  } finally {
    syncingAdapter.value = false
  }
}

function openImageTagDialog() {
  newImageTag.value = adapter.value?.imageTag ?? ''
  showImageTagDialog.value = true
}

function closeImageTagDialog() {
  showImageTagDialog.value = false
}

async function updateImageTag() {
  if (!route.params.id || !newImageTag.value) return
  updatingImageTag.value = true
  try {
    const response = await axios.post(`/adapter-attendant/v1/adapters/${route.params.id}/update`, {
      imageTag: newImageTag.value
    })
    adapter.value = response.data
    showImageTagDialog.value = false
  } catch (err) {
    error.value = err
  } finally {
    updatingImageTag.value = false
  }
}
</script>

<template>
  <div v-if="error">Error: {{ error.message }}</div>
  <div v-else-if="adapter">
    <h2>Adapter Details: {{ adapter.name }}</h2>
    <div class="adapter-info">
      <div class="info-section">
        <h3>General Information</h3>
        <ul>
          <li><strong>ID:</strong> {{ adapter.id }}</li>
          <li><strong>Name:</strong> {{ adapter.name }}</li>
          <li class="synced-row">
            <strong>Synced:</strong>
            <span>{{ adapter.synced || 'Not synced' }}</span>
            <button
              class="config-button"
              :disabled="syncingAdapter"
              @click="syncAdapter"
            >
              {{ syncingAdapter ? 'Syncing...' : 'Sync' }}
            </button>
          </li>
          <li><strong>Created:</strong> {{ adapter.created }}</li>
          <li><strong>Updated:</strong> {{ adapter.updated }}</li>
        </ul>
      </div>

      <div class="info-section">
        <h3>Image</h3>
        <ul>
          <li><strong>Name:</strong> {{ adapter.imageName }}</li>
          <li class="tag-row">
            <strong>Tag:</strong> {{ adapter.imageTag }}
            <button class="config-button" @click="openImageTagDialog">Update</button>
          </li>
        </ul>
      </div>

      <div class="info-section" v-if="configurations.length">
        <h3>Configuration</h3>
        <div class="config-add">
          <div class="config-row">
            <div class="config-cell key-cell">
              <input
                v-model="newConfig.key"
                type="text"
                class="config-input"
                placeholder="New key"
              />
            </div>
            <div class="config-cell value-cell">
              <input
                v-model="newConfig.value"
                type="text"
                class="config-input"
                placeholder="New value"
              />
            </div>
            <div class="config-cell action-cell">
              <button
                class="config-button"
                :disabled="addingConfig || !newConfig.key || !newConfig.value"
                @click="addConfiguration"
              >
                {{ addingConfig ? 'Adding...' : 'Add' }}
              </button>
            </div>
          </div>
        </div>
        <div class="config-table">
          <div class="config-row config-header">
            <div class="config-cell key-cell">Key</div>
            <div class="config-cell value-cell">Value</div>
            <div class="config-cell action-cell">Action</div>
          </div>
          <div class="config-row" v-for="config in configurations" :key="config.id">
            <div class="config-cell key-cell">
              <input
                v-model="editRows[config.id].key"
                type="text"
                class="config-input"
              />
            </div>
            <div class="config-cell value-cell">
              <input
                v-model="editRows[config.id].value"
                type="text"
                class="config-input"
              />
            </div>
            <div class="config-cell action-cell">
              <button
                class="config-button"
                :disabled="savingRows[config.id] || !isRowDirty(config)"
                @click="confirmUpdate(config)"
              >
                {{ savingRows[config.id] ? 'Saving...' : 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else>Loading...</div>

  <div v-if="showImageTagDialog" class="dialog-backdrop">
    <div class="dialog">
      <h3>Update Image Tag</h3>
      <input
        v-model="newImageTag"
        type="text"
        class="config-input"
        placeholder="Enter new image tag"
      />
      <div class="dialog-actions">
        <button class="config-button" :disabled="updatingImageTag || !newImageTag" @click="updateImageTag">
          {{ updatingImageTag ? 'Updating...' : 'Update' }}
        </button>
        <button class="config-button secondary" :disabled="updatingImageTag" @click="closeImageTagDialog">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.adapter-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-section {
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.info-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.1rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
}

strong {
  color: #555;
  margin-right: 0.5rem;
}

.synced-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}


.config-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-add {
  margin-bottom: 1rem;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e6e6e6;
}

.config-header {
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #ddd;
}

.config-cell {
  flex: 1 1 0;
  min-width: 0;
}

.key-cell {
  flex: 1.2 1 0;
}

.value-cell {
  flex: 2 1 0;
}

.action-cell {
  flex: 0 0 120px;
  display: flex;
  justify-content: flex-end;
}

.config-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.config-button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  background: #2d8cff;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.config-button:disabled {
  background: #9bbcf2;
  cursor: not-allowed;
}

.config-button.secondary {
  background: #6c757d;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
</style>
