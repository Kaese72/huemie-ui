<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuth } from '../composables/useAuth.js'
import GatedButton from './GatedButton.vue'

// The signed-in user's own API tokens: long-lived bearer tokens for scripts
// and integrations, looked up by the receiving service on every use (see
// authentication's README, "API tokens"). Only ever shown for the viewer's
// own account - the endpoints are /users/me/...
//
// Creating one requires a session that began with a local username and
// password; listing and deleting work from any session.

const TOKENS_URL = '/authentication-service/v0/users/me/api-tokens'
const RESOURCES_URL = '/authentication-service/v0/permissions/resources'
const LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'view', label: 'View' },
  { value: 'modify', label: 'Manage' },
]
const EXPIRY_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
  { value: null, label: 'Never' },
]

const { hasView, hasModify, localLoginRequiredReason } = useAuth()

const tokens = ref([])
const resources = ref([])
const loading = ref(true)
const error = ref(null)
const deletingId = ref(null)

const createBlockedReason = computed(() => localLoginRequiredReason('Creating API tokens'))

const showDialog = ref(false)
const creating = ref(false)
const createError = ref(null)
const form = ref({ name: '', expiresInDays: 90, levels: {} })
// The token itself, shown once right after creation and never again.
const createdToken = ref(null)
const copied = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [tokensResponse, resourcesResponse] = await Promise.all([
      axios.get(TOKENS_URL),
      axios.get(RESOURCES_URL),
    ])
    tokens.value = tokensResponse.data ?? []
    resources.value = resourcesResponse.data ?? []
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  } finally {
    loading.value = false
  }
}

function resourceName(code) {
  return resources.value.find(r => r.code === code)?.name ?? code
}

function scopeSummary(token) {
  const parts = Object.entries(token.resources ?? {})
    .filter(([, grant]) => grant.view || grant.modify)
    .map(([code, grant]) => `${resourceName(code)}: ${grant.modify ? 'manage' : 'view'}`)
  return parts.length ? parts.join(', ') : 'No access'
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function isExpired(token) {
  return token.expiresAt != null && new Date(token.expiresAt) <= new Date()
}

// A token can't grant more than its creator has, so offer only what the
// viewer holds themselves. Returns why `level` is unavailable, or null.
function levelBlockedReason(code, level) {
  if (level === 'view' && !hasView(code)) return `You don't have view access to ${resourceName(code)} yourself.`
  if (level === 'modify' && !hasModify(code)) return `You don't have manage access to ${resourceName(code)} yourself.`
  return null
}

const anyLevelChosen = computed(() => Object.values(form.value.levels).some(l => l !== 'none'))

function openDialog() {
  if (createBlockedReason.value) return
  const levels = {}
  for (const r of resources.value) levels[r.code] = 'none'
  form.value = { name: '', expiresInDays: 90, levels }
  createError.value = null
  createdToken.value = null
  copied.value = false
  showDialog.value = true
}

function closeDialog() {
  if (creating.value) return
  showDialog.value = false
  createdToken.value = null
}

async function createToken() {
  if (!form.value.name.trim() || !anyLevelChosen.value) return
  creating.value = true
  createError.value = null
  try {
    const body = { name: form.value.name.trim(), resources: {} }
    for (const [code, level] of Object.entries(form.value.levels)) {
      if (level !== 'none') body.resources[code] = { view: true, modify: level === 'modify' }
    }
    if (form.value.expiresInDays != null) body.expiresInDays = form.value.expiresInDays
    const response = await axios.post(TOKENS_URL, body)
    createdToken.value = response.data.token
    tokens.value = [...tokens.value, response.data.apiToken]
  } catch (err) {
    createError.value = err.response?.data?.detail ?? err.message
  } finally {
    creating.value = false
  }
}

async function copyToken() {
  try {
    await navigator.clipboard.writeText(createdToken.value)
    copied.value = true
  } catch {
    // Clipboard blocked: the token is still selectable in the field.
  }
}

async function deleteToken(token) {
  if (!confirm(`Delete API token "${token.name}"? Anything using it stops working.`)) return
  deletingId.value = token.id
  error.value = null
  try {
    await axios.delete(`${TOKENS_URL}/${token.id}`)
    tokens.value = tokens.value.filter(t => t.id !== token.id)
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="tokens-head">
    <h3 class="section-title">API tokens</h3>
    <GatedButton class="btn btn-ghost btn-sm" :reason="createBlockedReason" :disabled="loading" @click="openDialog">
      New API token
    </GatedButton>
  </div>
  <p class="hint tokens-hint">
    For scripts and integrations. A token acts as you, limited to the access you give it,
    and never more than you have yourself.
  </p>

  <div v-if="error" class="alert alert-error">{{ error }}</div>
  <p v-if="loading" class="empty">Loading…</p>
  <p v-else-if="tokens.length === 0" class="empty">No API tokens.</p>
  <ul v-else class="rows">
    <li v-for="token in tokens" :key="token.id" class="row">
      <div class="row-main">
        <p class="row-title">
          {{ token.name }}
          <span v-if="isExpired(token)" class="badge badge-danger">Expired</span>
        </p>
        <p class="row-meta mono">{{ token.prefix }}…</p>
        <p class="row-meta">{{ scopeSummary(token) }}</p>
        <p class="row-meta">
          Created {{ formatDate(token.createdAt) }} ·
          {{ token.expiresAt ? (isExpired(token) ? 'Expired' : 'Expires') + ' ' + formatDate(token.expiresAt) : 'Never expires' }} ·
          {{ token.lastUsedAt ? 'Last used ' + formatDate(token.lastUsedAt) : 'Never used' }}
        </p>
      </div>
      <button class="btn btn-danger btn-sm" :disabled="deletingId === token.id" @click="deleteToken(token)">
        {{ deletingId === token.id ? 'Deleting…' : 'Delete' }}
      </button>
    </li>
  </ul>

  <Teleport to="body">
    <div v-if="showDialog" class="dialog-backdrop" @click.self="closeDialog">
      <div class="dialog token-dialog" role="dialog" aria-modal="true">
        <template v-if="createdToken">
          <h3 class="dialog-title">API token created</h3>
          <p class="alert alert-warning">
            Copy it now. It won't be shown again; if it's lost, delete it and create a new one.
          </p>
          <div class="field">
            <label for="created-token">Token</label>
            <input id="created-token" class="input mono" type="text" readonly :value="createdToken" @focus="$event.target.select()" />
          </div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="copyToken">{{ copied ? '✓ Copied' : 'Copy' }}</button>
            <button class="btn btn-primary" @click="closeDialog">Done</button>
          </div>
        </template>

        <template v-else>
          <h3 class="dialog-title">New API token</h3>
          <div class="field">
            <label for="token-name">Name</label>
            <input id="token-name" v-model="form.name" class="input" type="text" maxlength="100" placeholder="e.g. Home Assistant" :disabled="creating" />
          </div>
          <div class="field">
            <label for="token-expiry">Expires</label>
            <select id="token-expiry" v-model="form.expiresInDays" class="input" :disabled="creating">
              <option v-for="opt in EXPIRY_OPTIONS" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div class="field">
            <span class="label">Access</span>
            <div class="resource-list">
              <div v-for="resource in resources" :key="resource.code" class="resource-row">
                <div class="resource-name">{{ resource.name }}</div>
                <div class="segmented">
                  <span
                    v-for="lvl in LEVELS"
                    :key="lvl.value"
                    class="segment-wrap"
                    :title="levelBlockedReason(resource.code, lvl.value) || undefined"
                  >
                    <button
                      type="button"
                      class="segment"
                      :class="{ active: form.levels[resource.code] === lvl.value }"
                      :disabled="creating || !!levelBlockedReason(resource.code, lvl.value)"
                      @click="form.levels[resource.code] = lvl.value"
                    >
                      {{ lvl.label }}
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="createError" class="alert alert-error">{{ createError }}</div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" :disabled="creating" @click="closeDialog">Cancel</button>
            <button
              class="btn btn-primary"
              :disabled="creating || !form.name.trim() || !anyLevelChosen"
              :title="!anyLevelChosen ? 'Give the token access to at least one area.' : undefined"
              @click="createToken"
            >
              {{ creating ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tokens-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tokens-hint {
  margin: -4px 0 12px;
}
.token-dialog {
  width: 500px;
  max-height: 85vh;
  overflow-y: auto;
}
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.resource-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.resource-name {
  font-weight: 500;
  min-width: 8rem;
}
/* Segmented control, as in PermissionsDialog. */
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  flex-shrink: 0;
}
.segment-wrap {
  display: inline-flex;
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
/* Disabled segments let hover through to the wrapper's tooltip. */
.segment:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  pointer-events: none;
}
.segment-wrap:has(.segment:disabled) {
  cursor: not-allowed;
}
.segment:hover:not(:disabled):not(.active) { color: var(--text); }
</style>
