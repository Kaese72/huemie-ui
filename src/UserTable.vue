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
  { key: 'actions', label: '', width: '320px' },
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
  <div class="list-page">
    <div class="list-head">
      <div>
        <h1 class="list-title">Users</h1>
        <p class="list-lede">Who can sign in to this Appliance, and what they may do.</p>
      </div>
      <div class="list-actions">
        <button class="btn btn-primary" @click="openCreateDialog">New user</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
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
          <span v-if="row.id === currentUserId" class="badge badge-warm badge-you">You</span>
        </template>
        <template #cell-name="{ row }">
          <template v-if="[row.name, row.surname].filter(Boolean).length">{{ [row.name, row.surname].filter(Boolean).join(' ') }}</template>
          <span v-else class="na">—</span>
        </template>
        <template #cell-email="{ row }">
          <template v-if="row.email">{{ row.email }}</template>
          <span v-else class="na">—</span>
        </template>
        <template #cell-local="{ row }"><BoolBadge :value="!!row.localLogin" /></template>
        <template #cell-cloud="{ row }"><BoolBadge :value="!!row.cloudLogin" /></template>
        <template #cell-isAdmin="{ row }"><BoolBadge :value="!!row.permissions?.admin" /></template>
        <template #cell-actions="{ row }">
          <div class="actions-cell">
            <button
              v-if="row.id === currentUserId"
              class="btn btn-ghost btn-xs"
              @click.stop="openPasswordDialog"
            >
              Change password
            </button>
            <button
              v-if="canManagePermissions"
              class="btn btn-ghost btn-xs"
              @click.stop="openPermissionsDialog(row.id)"
            >
              Permissions
            </button>
            <button class="btn btn-danger btn-xs" @click.stop="deleteUser(row.id, row.username)">Delete</button>
          </div>
        </template>
        <template #empty>
          <div class="table-empty">
            <p>No users yet.</p>
            <p>Click <strong>New user</strong> to create one.</p>
          </div>
        </template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view @updated="onUserUpdated" />
      </DetailOverlay>
    </div>

    <div v-if="showCreateDialog" class="dialog-backdrop" @click.self="closeCreateDialog">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="dialog-title">New user</h3>
        <div class="field">
          <label for="new-username">Username</label>
          <input
            id="new-username"
            v-model="newUser.username"
            class="input"
            type="text"
            autocomplete="username"
            :disabled="creating"
          />
        </div>
        <div class="field">
          <label for="new-password">Password</label>
          <input
            id="new-password"
            v-model="newUser.password"
            class="input"
            type="password"
            autocomplete="new-password"
            :disabled="creating"
          />
        </div>
        <div class="name-pair">
          <div class="field">
            <label for="new-name">Name</label>
            <input
              id="new-name"
              v-model="newUser.name"
              class="input"
              type="text"
              :disabled="creating"
            />
          </div>
          <div class="field">
            <label for="new-surname">Surname</label>
            <input
              id="new-surname"
              v-model="newUser.surname"
              class="input"
              type="text"
              :disabled="creating"
            />
          </div>
        </div>
        <div class="field">
          <label for="new-email">Email (optional)</label>
          <input
            id="new-email"
            v-model="newUser.email"
            class="input"
            type="email"
            :disabled="creating"
            @keyup.enter="createUser"
          />
        </div>
        <div v-if="createError" class="alert alert-error">{{ createError }}</div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" :disabled="creating" @click="closeCreateDialog">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="creating || !newUser.username || !newUser.password"
            @click="createUser"
          >
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showPasswordDialog" class="dialog-backdrop" @click.self="closePasswordDialog">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="dialog-title">Change password</h3>
        <div class="field">
          <label for="current-password">Current password</label>
          <input
            id="current-password"
            v-model="passwordForm.currentPassword"
            class="input"
            type="password"
            autocomplete="current-password"
            :disabled="changingPassword"
          />
        </div>
        <div class="field">
          <label for="new-password-1">New password</label>
          <input
            id="new-password-1"
            v-model="passwordForm.newPassword"
            class="input"
            type="password"
            autocomplete="new-password"
            :disabled="changingPassword"
          />
        </div>
        <div class="field">
          <label for="new-password-2">Confirm new password</label>
          <input
            id="new-password-2"
            v-model="passwordForm.confirmPassword"
            class="input"
            type="password"
            autocomplete="new-password"
            :disabled="changingPassword"
            @keyup.enter="changePassword"
          />
        </div>
        <div v-if="passwordError" class="alert alert-error">{{ passwordError }}</div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" :disabled="changingPassword" @click="closePasswordDialog">Cancel</button>
          <button
            class="btn btn-primary"
            :disabled="changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword"
            @click="changePassword"
          >
            {{ changingPassword ? 'Saving…' : 'Save' }}
          </button>
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
.actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
}
.badge-you {
  margin-left: 8px;
}
.name-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}
.name-pair + .field {
  margin-top: 14px;
}
.name-pair .field + .field {
  margin-top: 0;
}
</style>
