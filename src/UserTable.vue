<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth.js'
import PermissionsDialog from './components/PermissionsDialog.vue'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import BoolBadge from './components/BoolBadge.vue'
import { useTableList } from './composables/useTableList.js'

const { currentUserId, currentUserIsAdmin, hasModify } = useAuth()
const router = useRouter()
const route = useRoute()

// "us" is authentication/usertoken.ResourceUsers - the server is the one
// that actually enforces this; this only decides whether to show the button.
const canManagePermissions = computed(() => currentUserIsAdmin.value || hasModify('us'))
const showPermissionsDialog = ref(false)
const permissionsUserId = ref(null)
const permissionsUser = computed(() => users.value.find(u => u.id === permissionsUserId.value) ?? null)

const showCreateDialog = ref(false)
const creating = ref(false)
const newUser = ref({ username: '', password: '', name: '', surname: '', email: '' })
const createError = ref(null)

const showPasswordDialog = ref(false)
const changingPassword = ref(false)
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref(null)

const columns = [
  { key: 'id', label: 'ID', width: '60px', sortable: true },
  { key: 'username', label: 'Username', sortable: true, filter: { type: 'text' } },
  { key: 'name', label: 'Name', sortable: true, filter: { type: 'text' } },
  { key: 'email', label: 'Email', filter: { type: 'text' } },
  { key: 'local', label: 'Local', width: '55px' },
  { key: 'cloud', label: 'Cloud', width: '55px' },
  { key: 'isAdmin', label: 'Admin', width: '55px', filter: { type: 'boolean' } },
  { key: 'actions', label: '', width: '300px' },
]

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/authentication-service/v0/users', { params })
  const rows = response.data ?? []
  const totalHeader = response.headers['x-total-count']
  return { rows, total: totalHeader != null ? parseInt(totalHeader, 10) : rows.length }
}

const {
  rows: users,
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

function openCreateDialog() {
  newUser.value = { username: '', password: '', name: '', surname: '', email: '' }
  createError.value = null
  showCreateDialog.value = true
}

function closeCreateDialog() {
  if (creating.value) return
  showCreateDialog.value = false
}

async function createUser() {
  if (!newUser.value.username || !newUser.value.password) return
  creating.value = true
  createError.value = null
  try {
    await axios.post('/authentication-service/v0/users', {
      username: newUser.value.username,
      password: newUser.value.password,
      name: newUser.value.name,
      surname: newUser.value.surname,
      email: newUser.value.email || null,
    })
    // Pagination/total count shift when a user is added, so refetch rather than pushing locally.
    await refresh()
    showCreateDialog.value = false
  } catch (err) {
    createError.value = err.response?.data?.detail ?? err.message
  } finally {
    creating.value = false
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"?`)) return
  try {
    await axios.delete(`/authentication-service/v0/users/${id}`)
    if (selectedId.value === String(id)) {
      router.push({ name: 'Users' })
    }
    // Pagination/total count shift when a user is removed, so refetch rather than filtering locally.
    await refresh()
  } catch (err) {
    error.value = err
  }
}

function openPasswordDialog() {
  passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  passwordError.value = null
  showPasswordDialog.value = true
}

function closePasswordDialog() {
  if (changingPassword.value) return
  showPasswordDialog.value = false
}

async function changePassword() {
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value
  if (!currentPassword || !newPassword || !confirmPassword) return
  if (newPassword !== confirmPassword) {
    passwordError.value = 'New passwords do not match.'
    return
  }
  changingPassword.value = true
  passwordError.value = null
  try {
    await axios.put('/authentication-service/v0/users/me/update-password', {
      currentPassword,
      newPassword,
    })
    showPasswordDialog.value = false
  } catch (err) {
    passwordError.value = err.response?.data?.detail ?? err.message
  } finally {
    changingPassword.value = false
  }
}

function onRowClick(user) {
  if (selectedId.value === String(user.id)) {
    router.push({ name: 'Users' })
  } else {
    router.push({ name: 'UserDetail', params: { id: user.id } })
  }
}

function onUserUpdated(updated) {
  users.value = users.value.map(u => u.id === updated.id ? updated : u)
}

function openPermissionsDialog(userId) {
  permissionsUserId.value = userId
  showPermissionsDialog.value = true
}

function closePermissionsDialog() {
  showPermissionsDialog.value = false
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="user-table">
    <div class="pane-header">
      <h1>Users</h1>
      <button class="btn-create" @click="openCreateDialog">+ New user</button>
    </div>
    <div v-if="error" class="error">Error: {{ error.message }}</div>
    <div class="split-content">
      <TableShell
        :columns="columns"
        :rows="users"
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
        <template #cell-username="{ row }">
          {{ row.username }}
          <span v-if="row.id === currentUserId" class="badge-you">YOU</span>
        </template>
        <template #cell-name="{ row }">{{ [row.name, row.surname].filter(Boolean).join(' ') || '—' }}</template>
        <template #cell-email="{ row }">{{ row.email || '—' }}</template>
        <template #cell-local="{ row }"><BoolBadge :value="!!row.localLogin" /></template>
        <template #cell-cloud="{ row }"><BoolBadge :value="!!row.cloudLogin" /></template>
        <template #cell-isAdmin="{ row }"><BoolBadge :value="!!row.permissions?.admin" /></template>
        <template #cell-actions="{ row }">
          <div class="actions-cell">
            <button
              v-if="row.id === currentUserId"
              class="btn-change-password"
              @click.stop="openPasswordDialog"
            >
              Change Password
            </button>
            <button
              v-if="canManagePermissions"
              class="btn-permissions"
              @click.stop="openPermissionsDialog(row.id)"
            >
              Permissions
            </button>
            <button class="btn-delete" @click.stop="deleteUser(row.id, row.username)">Delete</button>
          </div>
        </template>
        <template #empty>
          <div class="empty">
            <p>No users yet.</p>
            <p>Click <strong>+ New user</strong> to create one.</p>
          </div>
        </template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view @updated="onUserUpdated" />
      </DetailOverlay>
    </div>

    <div v-if="showCreateDialog" class="dialog-backdrop" @click.self="closeCreateDialog">
      <div class="dialog">
        <h3>Create user</h3>
        <input
          v-model="newUser.username"
          class="create-input"
          type="text"
          placeholder="Username"
          autocomplete="username"
          :disabled="creating"
        />
        <input
          v-model="newUser.password"
          class="create-input"
          type="password"
          placeholder="Password"
          autocomplete="new-password"
          :disabled="creating"
        />
        <input
          v-model="newUser.name"
          class="create-input"
          type="text"
          placeholder="Name"
          :disabled="creating"
        />
        <input
          v-model="newUser.surname"
          class="create-input"
          type="text"
          placeholder="Surname"
          :disabled="creating"
        />
        <input
          v-model="newUser.email"
          class="create-input"
          type="email"
          placeholder="Email (optional)"
          :disabled="creating"
          @keyup.enter="createUser"
        />
        <div v-if="createError" class="dialog-error">{{ createError }}</div>
        <div class="dialog-actions">
          <button
            class="dialog-save-button"
            :disabled="creating || !newUser.username || !newUser.password"
            @click="createUser"
          >
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
          <button class="dialog-cancel-button" :disabled="creating" @click="closeCreateDialog">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="showPasswordDialog" class="dialog-backdrop" @click.self="closePasswordDialog">
      <div class="dialog">
        <h3>Change password</h3>
        <input
          v-model="passwordForm.currentPassword"
          class="create-input"
          type="password"
          placeholder="Current password"
          autocomplete="current-password"
          :disabled="changingPassword"
        />
        <input
          v-model="passwordForm.newPassword"
          class="create-input"
          type="password"
          placeholder="New password"
          autocomplete="new-password"
          :disabled="changingPassword"
        />
        <input
          v-model="passwordForm.confirmPassword"
          class="create-input"
          type="password"
          placeholder="Confirm new password"
          autocomplete="new-password"
          :disabled="changingPassword"
          @keyup.enter="changePassword"
        />
        <div v-if="passwordError" class="dialog-error">{{ passwordError }}</div>
        <div class="dialog-actions">
          <button
            class="dialog-save-button"
            :disabled="changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword"
            @click="changePassword"
          >
            {{ changingPassword ? 'Saving...' : 'Save' }}
          </button>
          <button class="dialog-cancel-button" :disabled="changingPassword" @click="closePasswordDialog">Cancel</button>
        </div>
      </div>
    </div>

    <PermissionsDialog
      :show="showPermissionsDialog"
      :user="permissionsUser"
      :viewer-is-admin="currentUserIsAdmin"
      @close="closePermissionsDialog"
      @updated="onUserUpdated"
    />
  </div>
</template>

<style scoped>
.user-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.split-content {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 1rem;
  flex-shrink: 0;
}
.pane-header h1 {
  margin: 0 0 0.5rem 0;
}
.btn-create {
  padding: 0.4rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-create:hover { background: #369870; }
.error { color: red; padding: 0.5rem; }
.actions-cell { display: flex; justify-content: flex-end; gap: 0.4rem; width: 100%; }
.badge-you {
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  background: #1565c0;
  color: #fff;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.03em;
}
.btn-delete {
  padding: 0.25rem 0.6rem;
  background: #fff;
  color: #c62828;
  border: 1px solid #c62828;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-delete:hover { background: #c62828; color: #fff; }
.btn-change-password {
  padding: 0.25rem 0.6rem;
  background: #1565c0;
  color: #fff;
  border: 1px solid #1565c0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-change-password:hover { background: #0d47a1; }
.btn-permissions {
  padding: 0.25rem 0.6rem;
  background: #fff;
  color: #555;
  border: 1px solid #999;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-permissions:hover { background: #f0f0f0; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
.empty p { margin: 0.25rem 0; }
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
.create-input:disabled { background: #f5f5f5; }
.dialog-error {
  color: #c62828;
  font-size: 0.85rem;
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
