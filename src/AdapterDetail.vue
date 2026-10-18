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
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <div v-else-if="adapter">
    <div class="detail-head">
      <h2 class="detail-title">{{ adapter.name }}</h2>
    </div>
    <div class="detail-meta">
      <span><strong>ID</strong> <span class="mono">{{ adapter.id }}</span></span>
    </div>

    <h3 class="section-title">General</h3>
    <dl class="kv">
      <dt>Name</dt>
      <dd>{{ adapter.name }}</dd>
      <dt>Synced</dt>
      <dd>
        <span v-if="adapter.synced">{{ adapter.synced }}</span>
        <span v-else class="na">Not synced</span>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="syncingAdapter"
          @click="syncAdapter"
        >
          {{ syncingAdapter ? 'Syncing…' : 'Sync' }}
        </button>
      </dd>
      <dt>Created</dt>
      <dd>{{ adapter.created }}</dd>
      <dt>Updated</dt>
      <dd>{{ adapter.updated }}</dd>
    </dl>

    <h3 class="section-title">Image</h3>
    <dl class="kv">
      <dt>Name</dt>
      <dd class="mono">{{ adapter.imageName }}</dd>
      <dt>Tag</dt>
      <dd>
        <span class="mono">{{ adapter.imageTag }}</span>
        <button class="btn btn-ghost btn-sm" @click="openImageTagDialog">Update</button>
      </dd>
    </dl>

    <h3 class="section-title">Configuration</h3>
    <div class="config-table">
      <div class="config-row config-header" v-if="configurations.length">
        <div class="config-cell key-cell">Key</div>
        <div class="config-cell value-cell">Value</div>
        <div class="config-cell action-cell"></div>
      </div>
      <div class="config-row" v-for="config in configurations" :key="config.id">
        <div class="config-cell key-cell">
          <input
            v-model="editRows[config.id].key"
            type="text"
            class="input input-sm"
            aria-label="Key"
          />
        </div>
        <div class="config-cell value-cell">
          <input
            v-model="editRows[config.id].value"
            type="text"
            class="input input-sm"
            aria-label="Value"
          />
        </div>
        <div class="config-cell action-cell">
          <button
            class="btn btn-primary btn-sm"
            :disabled="savingRows[config.id] || !isRowDirty(config)"
            @click="confirmUpdate(config)"
          >
            {{ savingRows[config.id] ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
      <p v-if="!configurations.length" class="empty">No configuration entries yet.</p>

      <div class="config-row config-add">
        <div class="config-cell key-cell">
          <input
            v-model="newConfig.key"
            type="text"
            class="input input-sm"
            placeholder="New key"
          />
        </div>
        <div class="config-cell value-cell">
          <input
            v-model="newConfig.value"
            type="text"
            class="input input-sm"
            placeholder="New value"
          />
        </div>
        <div class="config-cell action-cell">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="addingConfig || !newConfig.key || !newConfig.value"
            @click="addConfiguration"
          >
            {{ addingConfig ? 'Adding…' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <p v-else class="empty">Loading…</p>

  <Teleport to="body">
    <div v-if="showImageTagDialog" class="dialog-backdrop">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="dialog-title">Update image tag</h3>
        <div class="field">
          <label for="image-tag">Image tag</label>
          <input
            id="image-tag"
            v-model="newImageTag"
            type="text"
            class="input"
            placeholder="Enter new image tag"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" :disabled="updatingImageTag" @click="closeImageTagDialog">
            Cancel
          </button>
          <button class="btn btn-primary" :disabled="updatingImageTag || !newImageTag" @click="updateImageTag">
            {{ updatingImageTag ? 'Updating…' : 'Update' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.config-table {
  display: flex;
  flex-direction: column;
}
.config-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 6%, transparent);
}
.config-header {
  padding-top: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
  border-bottom-color: color-mix(in srgb, var(--ink) 10%, transparent);
}
.config-add {
  border-bottom: none;
  margin-top: 6px;
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
  flex: 0 0 90px;
  display: flex;
  justify-content: flex-end;
}
</style>
