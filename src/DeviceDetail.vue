<script setup>

import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import CapabilityDialog from './components/CapabilityDialog.vue'
import AttributeValue from './components/AttributeValue.vue'

const route = useRoute()
const router = useRouter()
const device = ref(null)
const error = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)
const triggerAudits = ref([])
const activeTab = computed(() => route.params.tab)
const editingName = ref(false)
const nameDraft = ref('')
const savingName = ref(false)

onMounted(fetchDevice)
watch(() => route.params.id, fetchDevice)
watch(activeTab, (tab) => {
  if (tab === 'history' && triggerAudits.value.length === 0) refreshAudits()
})

async function fetchDevice() {
  if (!route.params.id) return
  try {
    const response = await axios.get(`/device-store/v0/devices/${route.params.id}`)
    device.value = response.data
    triggerAudits.value = []
    error.value = null
  } catch (err) {
    error.value = err
    device.value = null
  }
}

function selectTab(tab) {
  router.push({ name: 'DeviceDetail', params: { id: route.params.id, tab } })
}

function openCapabilityDialog(capability) {
  selectedCapability.value = capability
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  selectedCapability.value = null
}

async function refreshAudits() {
  if (!route.params.id) return
  try {
    const response = await axios.get(`/device-store/v0/devices/${route.params.id}/capability-trigger-audits`)
    triggerAudits.value = response.data || []
  } catch (err) {
    console.error('Error fetching trigger audits:', err)
  }
}

function triggerCapability(argumentValues) {
  if (!device.value || !selectedCapability.value) return;

  axios.post(
    `/device-store/v0/devices/${device.value.id}/capabilities/${selectedCapability.value.name}`,
    argumentValues
  )
    .then(() => {
      closeDialog()
      if (activeTab.value === 'history') refreshAudits()
    })
    .catch(err => {
      console.error('Error triggering capability:', err)
      if (activeTab.value === 'history') refreshAudits()
    })
}

function startEditingName() {
  nameDraft.value = device.value.name || ''
  editingName.value = true
}

function cancelEditingName() {
  editingName.value = false
}

async function saveName(name) {
  if (!device.value) return
  savingName.value = true
  try {
    const response = await axios.patch(`/device-store/v0/devices/${device.value.id}`, { name })
    device.value = response.data
    editingName.value = false
  } catch (err) {
    error.value = err
  } finally {
    savingName.value = false
  }
}

function setAttributeAsName(attribute) {
  const value = attribute['string-state']
  if (value === undefined || value === null || value === '') return
  saveName(value)
}

function extractAttributeValue(attribute) {
  if (!attribute) return 'Unknown'
  if (attribute['string-state'] !== undefined && attribute['string-state'] !== null && attribute['string-state'] !== '') {
    return attribute['string-state']
  }
  if (attribute['boolean-state'] !== undefined && attribute['boolean-state'] !== null) {
    return attribute['boolean-state']
  }
  if (attribute['numeric-state'] !== undefined && attribute['numeric-state'] !== null) {
    return attribute['numeric-state']
  }
  return 'Unknown'
}

async function forgetDevice() {
  if (!device.value) return
  const accepted = window.confirm(`Forget device ${device.value.id}?`)
  if (!accepted) return

  try {
    await axios.delete(`/device-store/v0/devices/${device.value.id}`)
    window.dispatchEvent(new CustomEvent('device-forgotten', { detail: { id: device.value.id } }))
    await router.push({ name: 'Devices' })
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <div v-else-if="device">
    <div class="detail-head">
      <h2 class="detail-title">
        <template v-if="!editingName">
          {{ device.name || '(unnamed)' }}
          <button class="icon-btn edit-name" title="Edit name" aria-label="Edit name" @click="startEditingName">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
          </button>
        </template>
        <template v-else>
          <input
            v-model="nameDraft"
            class="input input-sm name-input"
            maxlength="255"
            :disabled="savingName"
            @keyup.enter="saveName(nameDraft)"
            @keyup.esc="cancelEditingName"
          >
          <button class="btn btn-primary btn-sm" :disabled="savingName" @click="saveName(nameDraft)">Save</button>
          <button class="btn btn-ghost btn-sm" :disabled="savingName" @click="cancelEditingName">Cancel</button>
        </template>
      </h2>
    </div>
    <div class="detail-meta">
      <span><strong>ID</strong> <span class="mono">{{ device.id }}</span></span>
      <span><strong>Bridge identifier</strong> <span class="mono">{{ device['bridge-identifier'] }}</span></span>
      <span><strong>Last updated</strong> {{ device.updated || 'Unknown' }}</span>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'state' }" @click="selectTab('state')">State</button>
      <button class="tab" :class="{ active: activeTab === 'history' }" @click="selectTab('history')">Trigger history</button>
    </div>

    <div v-if="activeTab === 'state'">
      <div v-if="device.attributes && device.attributes.length">
        <h3 class="section-title">Attributes</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="attribute in device.attributes" :key="attribute.name">
              <td>{{ attribute.name }}</td>
              <td>
                <span class="value">
                  <span v-if="attribute['boolean-state'] === true" class="lit-dot" />
                  <AttributeValue :value="extractAttributeValue(attribute)" />
                </span>
              </td>
              <td class="muted">{{ attribute.updated || 'Unknown' }}</td>
              <td class="actions">
                <button
                  v-if="attribute['string-state']"
                  class="btn btn-ghost btn-sm"
                  :disabled="savingName"
                  @click="setAttributeAsName(attribute)"
                >
                  Set as name
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="device.capabilities && device.capabilities.length">
        <h3 class="section-title">Capabilities</h3>
        <div class="capabilities">
          <button
            v-for="cap in device.capabilities"
            :key="cap.name"
            class="btn btn-ghost btn-sm capability"
            :title="`Updated ${cap.updated || 'Unknown'}`"
            @click="openCapabilityDialog(cap)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            {{ cap.name }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'history'">
      <p v-if="!triggerAudits.length" class="empty">No capability triggers recorded yet.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Time</th>
            <th>Result</th>
            <th>Arguments</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="audit in triggerAudits" :key="audit.id">
            <td>{{ audit.name }}</td>
            <td class="muted">{{ audit.timestamp }}</td>
            <td :class="audit.success ? 'text-ok' : 'text-fail'">
              {{ audit.success ? 'Success' : 'Failed' }}
            </td>
            <td><code>{{ audit.arguments }}</code></td>
            <td class="text-fail-plain">{{ audit['error-message'] || '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-footer">
      <button class="btn btn-danger btn-sm" @click="forgetDevice">Forget device</button>
    </div>

    <CapabilityDialog
      v-if="selectedCapability"
      :capability="selectedCapability"
      :show="showDialog"
      @close="closeDialog"
      @trigger="triggerCapability"
    />
  </div>
  <p v-else class="empty">Loading…</p>
</template>

<style scoped>
.edit-name {
  opacity: 0;
  transition: opacity 0.15s;
}
.detail-title:hover .edit-name,
.edit-name:focus-visible {
  opacity: 1;
}
.name-input {
  flex: 1;
  min-width: 160px;
  font-size: 1rem;
}
.value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--muted);
}
.text-fail-plain {
  color: var(--danger-ink);
}
</style>
