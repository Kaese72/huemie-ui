<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'

// user is the row from GET /authentication-service/v0/users - it carries
// `permissions: { admin, resources: { code: { view, modify } } }` (see
// authentication/restmodels.UserResponse). The parent owns that object (it
// lives in its users list), so once we emit 'updated' with the server's
// fresh copy and the parent applies it, `user` here updates reactively too -
// we don't need our own copy of it.
const props = defineProps({
  show: { type: Boolean, default: false },
  user: { type: Object, default: null },
  // Whether the *viewer* (not the user being edited) is an admin. Only an
  // admin may promote or revoke anyone's admin flag - see requireAdmin on
  // the authentication service.
  viewerIsAdmin: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'updated'])

const RESOURCES_URL = '/authentication-service/v0/permissions/resources'
const LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'view', label: 'View' },
  { value: 'modify', label: 'Manage' },
]

const resources = ref([])
const resourcesError = ref(null)
const levels = ref({})   // resource code -> 'none' | 'view' | 'modify'
const rowState = ref({}) // resource code -> { saving, justSaved, error }
const adminSaving = ref(false)
const adminJustSaved = ref(false)
const adminError = ref(null)

const savedTimers = {}
let adminSavedTimer = null

const isTargetAdmin = computed(() => props.user?.permissions?.admin === true)

// Only reset from the user's current permissions when a dialog opens (for
// whichever user), not on every prop change - our own successful saves also
// change `user` (the parent applies our 'updated' event to it), and that
// must not stomp the saving/just-saved feedback mid-flight.
watch(() => [props.show, props.user?.id], ([visible]) => {
  if (visible) open()
}, { immediate: true })

async function open() {
  resourcesError.value = null
  adminError.value = null
  adminJustSaved.value = false
  try {
    const response = await axios.get(RESOURCES_URL)
    resources.value = response.data ?? []
  } catch (err) {
    resourcesError.value = err.response?.data?.detail ?? err.message
    resources.value = []
  }
  const grants = props.user?.permissions?.resources ?? {}
  const nextLevels = {}
  const nextRowState = {}
  for (const resource of resources.value) {
    const grant = grants[resource.code]
    nextLevels[resource.code] = grant?.modify ? 'modify' : (grant?.view ? 'view' : 'none')
    nextRowState[resource.code] = { saving: false, justSaved: false, error: null }
  }
  levels.value = nextLevels
  rowState.value = nextRowState
}

function close() {
  emit('close')
}

async function selectLevel(code, level) {
  if (isTargetAdmin.value || rowState.value[code]?.saving) return
  const previous = levels.value[code]
  if (previous === level) return

  levels.value[code] = level
  rowState.value[code] = { saving: true, justSaved: false, error: null }
  try {
    const response = await axios.put(
      `/authentication-service/v0/users/${props.user.id}/permissions/${code}`,
      { view: level === 'view' || level === 'modify', modify: level === 'modify' }
    )
    rowState.value[code] = { saving: false, justSaved: true, error: null }
    clearTimeout(savedTimers[code])
    savedTimers[code] = setTimeout(() => {
      if (rowState.value[code]) rowState.value[code] = { ...rowState.value[code], justSaved: false }
    }, 1500)
    emit('updated', response.data)
  } catch (err) {
    levels.value[code] = previous
    rowState.value[code] = { saving: false, justSaved: false, error: err.response?.data?.detail ?? err.message }
  }
}

async function toggleAdmin() {
  adminSaving.value = true
  adminError.value = null
  try {
    const response = await axios.put(`/authentication-service/v0/users/${props.user.id}/admin`, {
      admin: !isTargetAdmin.value,
    })
    adminJustSaved.value = true
    clearTimeout(adminSavedTimer)
    adminSavedTimer = setTimeout(() => { adminJustSaved.value = false }, 1500)
    emit('updated', response.data)
  } catch (err) {
    adminError.value = err.response?.data?.detail ?? err.message
  } finally {
    adminSaving.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(adminSavedTimer)
  Object.values(savedTimers).forEach(clearTimeout)
})
</script>

<template>
  <div v-if="show" class="dialog-overlay" @click.self="close">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>Permissions: {{ user?.username }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>

      <div class="dialog-body">
        <div v-if="viewerIsAdmin" class="admin-section">
          <div class="admin-row">
            <div>
              <strong>Admin</strong>
              <p class="hint">Bypasses every permission check below.</p>
            </div>
            <button
              class="admin-btn"
              :class="{ 'is-admin': isTargetAdmin }"
              :disabled="adminSaving"
              @click="toggleAdmin"
            >
              {{ adminSaving ? 'Saving…' : (isTargetAdmin ? 'Revoke Admin' : 'Promote to Admin') }}
            </button>
          </div>
          <div class="row-feedback">
            <span v-if="adminJustSaved" class="saved-tick">✓ Saved</span>
            <span v-if="adminError" class="row-error">{{ adminError }}</span>
          </div>
        </div>

        <p v-if="isTargetAdmin" class="admin-note">
          This user is an admin and has full access to everything. The permissions below
          have no effect until admin is revoked.
        </p>

        <div v-if="resourcesError" class="row-error">{{ resourcesError }}</div>

        <div class="resource-list">
          <div
            v-for="resource in resources"
            :key="resource.code"
            class="resource-row"
            :class="{ disabled: isTargetAdmin }"
          >
            <div class="resource-name">{{ resource.name }}</div>
            <div class="segmented">
              <button
                v-for="lvl in LEVELS"
                :key="lvl.value"
                type="button"
                class="segment"
                :class="{ active: levels[resource.code] === lvl.value }"
                :disabled="isTargetAdmin || rowState[resource.code]?.saving"
                @click="selectLevel(resource.code, lvl.value)"
              >
                {{ lvl.label }}
              </button>
            </div>
            <div class="row-feedback">
              <span v-if="rowState[resource.code]?.saving" class="saving">Saving…</span>
              <span v-else-if="rowState[resource.code]?.justSaved" class="saved-tick">✓ Saved</span>
              <span v-if="rowState[resource.code]?.error" class="row-error">{{ rowState[resource.code].error }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="close">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}
.dialog-header h3 { margin: 0; font-size: 1.15rem; color: #333; }
.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover { color: #333; }
.dialog-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}
.admin-section {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #eee;
}
.admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.admin-row strong { color: #333; }
.hint { margin: 0.15rem 0 0; font-size: 0.8rem; color: #777; }
.admin-btn {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  border: 1px solid #1565c0;
  background: #1565c0;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.admin-btn.is-admin {
  border-color: #c62828;
  background: #fff;
  color: #c62828;
}
.admin-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.admin-note {
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #7a5d00;
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  font-size: 0.85rem;
  margin: 0 0 1rem;
}
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.resource-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.resource-row.disabled { opacity: 0.5; }
.resource-name { font-weight: 500; color: #333; min-width: 8rem; }
.segmented {
  display: inline-flex;
  border: 1px solid #d0d0d0;
  border-radius: 20px;
  overflow: hidden;
  flex-shrink: 0;
}
.segment {
  padding: 0.3rem 0.85rem;
  border: none;
  background: #fff;
  color: #444;
  cursor: pointer;
  font-size: 0.8rem;
  border-right: 1px solid #d0d0d0;
}
.segment:last-child { border-right: none; }
.segment.active { background: #1565c0; color: #fff; }
.segment:disabled { cursor: not-allowed; }
.segment:hover:not(:disabled):not(.active) { background: #f0f4fa; }
.row-feedback {
  flex-basis: 100%;
  min-height: 1.1rem;
  display: flex;
  gap: 0.6rem;
  font-size: 0.78rem;
}
.saving { color: #888; }
.saved-tick {
  color: #2e7d32;
  font-weight: 500;
  animation: fade-in 0.15s ease-in;
}
.row-error { color: #c62828; }
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e0e0;
}
.btn {
  padding: 0.45rem 1.1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-secondary { background: #f5f5f5; color: #333; }
.btn-secondary:hover { background: #e0e0e0; }
</style>
