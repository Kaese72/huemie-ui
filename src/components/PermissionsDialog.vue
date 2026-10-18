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
  <Teleport to="body">
    <div v-if="show" class="dialog-backdrop" @click.self="close">
      <div class="dialog permissions-dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <h3 class="dialog-title">Permissions for {{ user?.username }}</h3>
          <button class="icon-btn" title="Close" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div class="dialog-body">
          <div v-if="viewerIsAdmin" class="admin-section">
            <div class="admin-row">
              <div>
                <strong class="admin-label">Admin</strong>
                <p class="hint admin-hint">Bypasses every permission check below.</p>
              </div>
              <button
                class="btn btn-sm"
                :class="isTargetAdmin ? 'btn-danger' : 'btn-ghost'"
                :disabled="adminSaving"
                @click="toggleAdmin"
              >
                {{ adminSaving ? 'Saving…' : (isTargetAdmin ? 'Revoke admin' : 'Make admin') }}
              </button>
            </div>
            <div class="row-feedback">
              <span v-if="adminJustSaved" class="saved-tick">✓ Saved</span>
              <span v-if="adminError" class="row-error">{{ adminError }}</span>
            </div>
          </div>

          <p v-if="isTargetAdmin" class="alert alert-warning">
            This user is an admin and has full access to everything. The permissions below
            have no effect until admin is revoked.
          </p>

          <div v-if="resourcesError" class="alert alert-error">{{ resourcesError }}</div>

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

        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="close">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.permissions-dialog {
  width: 500px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.dialog-head .dialog-title {
  margin: 0;
}
.dialog-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.admin-section {
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}
.admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.admin-label {
  font-weight: 600;
}
.admin-hint {
  margin: 2px 0 0;
  font-size: 0.82rem;
}
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.resource-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.resource-row.disabled { opacity: 0.5; }
.resource-name {
  font-weight: 500;
  min-width: 8rem;
}
/* Segmented control: neutral, the active segment is lifted like a tab. */
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  flex-shrink: 0;
}
.segment {
  padding: 5px 14px;
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.segment.active {
  background: var(--surface);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--shadow-ink) 20%, transparent);
}
.segment:disabled { cursor: not-allowed; }
.segment:hover:not(:disabled):not(.active) { color: var(--text); }
.row-feedback {
  flex-basis: 100%;
  min-height: 1.1rem;
  display: flex;
  gap: 10px;
  font-size: 0.78rem;
}
.saving { color: var(--faint); }
.saved-tick {
  color: var(--green-ink);
  font-weight: 600;
  animation: ui-fade-in 0.15s ease-in;
}
.row-error { color: var(--danger-ink); }
</style>
