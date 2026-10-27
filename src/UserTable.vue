<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth.js'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import BoolBadge from './components/BoolBadge.vue'
import { useTableList } from './composables/useTableList.js'

const { currentUserId } = useAuth()
const router = useRouter()
const route = useRoute()

const showCreateDialog = ref(false)
const creating = ref(false)
const newUser = ref({ username: '', password: '', name: '', surname: '', email: '' })
const createError = ref(null)

const columns = [
  { key: 'id', label: 'ID', width: '60px', sortable: true },
  { key: 'username', label: 'Username', sortable: true, filter: { type: 'text' } },
  { key: 'name', label: 'Name', sortable: true, filter: { type: 'text' } },
  { key: 'email', label: 'Email', filter: { type: 'text' } },
  { key: 'local', label: 'Local', width: '55px' },
  { key: 'cloud', label: 'Cloud', width: '55px' },
  { key: 'isAdmin', label: 'Admin', width: '55px', filter: { type: 'boolean' } },
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

function onUserDeleted() {
  router.push({ name: 'Users' })
  // Pagination/total count shift when a user is removed, so refetch rather than filtering locally.
  refresh()
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
        <template #empty>
          <div class="table-empty">
            <p>No users yet.</p>
            <p>Click <strong>New user</strong> to create one.</p>
          </div>
        </template>
      </TableShell>
      <DetailOverlay v-if="selectedId">
        <router-view @updated="onUserUpdated" @deleted="onUserDeleted" />
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
  </div>
</template>

<style scoped>
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
