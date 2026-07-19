<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth.js'

const { currentUserId } = useAuth()
const router = useRouter()
const route = useRoute()

const users = ref([])
const error = ref(null)
const showCreateDialog = ref(false)
const creating = ref(false)
const newUser = ref({ username: '', password: '', name: '', surname: '', email: '' })
const createError = ref(null)

const showPasswordDialog = ref(false)
const changingPassword = ref(false)
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordError = ref(null)

onMounted(fetchUsers)

async function fetchUsers() {
  try {
    const response = await axios.get('/authentication-service/v0/users')
    users.value = response.data ?? []
    error.value = null
  } catch (err) {
    error.value = err
  }
}

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
    const response = await axios.post('/authentication-service/v0/users', {
      username: newUser.value.username,
      password: newUser.value.password,
      name: newUser.value.name,
      surname: newUser.value.surname,
      email: newUser.value.email || null,
    })
    users.value.push(response.data)
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
    users.value = users.value.filter(u => u.id !== id)
    if (selectedId.value === String(id)) {
      router.push({ name: 'Users' })
    }
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

function onRowClick(userId) {
  if (selectedId.value === String(userId)) {
    router.push({ name: 'Users' })
  } else {
    router.push({ name: 'UserDetail', params: { id: userId } })
  }
}

function onUserUpdated(updated) {
  users.value = users.value.map(u => u.id === updated.id ? updated : u)
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="user-split-layout">
    <div class="user-table" :class="{ 'half': selectedId }">
      <div class="pane-header">
        <h1>Users</h1>
        <button class="btn-create" @click="openCreateDialog">+ New user</button>
      </div>
      <div v-if="error" class="error">Error: {{ error.message }}</div>
      <div v-if="users.length > 0" class="table-wrapper">
        <div class="table-header">
          <div class="cell cell-id">ID</div>
          <div class="cell cell-username">Username</div>
          <div class="cell cell-name">Name</div>
          <div class="cell cell-email">Email</div>
          <div class="cell cell-actions"></div>
        </div>
        <div
          v-for="user in users"
          :key="user.id"
          class="table-row"
          :class="{ selected: String(user.id) === selectedId }"
          @click="onRowClick(user.id)"
        >
          <div class="cell cell-id">{{ user.id }}</div>
          <div class="cell cell-username">
            {{ user.username }}
            <span v-if="user.id === currentUserId" class="badge-you">YOU</span>
          </div>
          <div class="cell cell-name">{{ [user.name, user.surname].filter(Boolean).join(' ') || '—' }}</div>
          <div class="cell cell-email">{{ user.email || '—' }}</div>
          <div class="cell cell-actions">
            <button
              v-if="user.id === currentUserId"
              class="btn-change-password"
              @click.stop="openPasswordDialog"
            >
              Change Password
            </button>
            <button class="btn-delete" @click.stop="deleteUser(user.id, user.username)">Delete</button>
          </div>
        </div>
      </div>
      <div v-else-if="!error" class="empty">
        <p>No users yet.</p>
        <p>Click <strong>+ New user</strong> to create one.</p>
      </div>
    </div>
    <div v-if="selectedId" class="user-detail-half">
      <router-view @updated="onUserUpdated" />
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
  </div>
</template>

<style scoped>
.user-split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.user-table {
  flex: 1 1 0;
  min-width: 0;
  transition: flex 0.3s;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.user-table.half {
  flex: 1;
  max-width: 50%;
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
.table-wrapper {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eee;
}
.table-header {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  position: sticky;
  top: 0;
}
.table-row { cursor: pointer; transition: background 0.15s; }
.table-row:hover { background: #f0f9f5; }
.table-row.selected { background: #e6f7ff; }
.cell {
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-id       { width: 60px;  flex-shrink: 0; font-weight: bold; }
.cell-username { flex: 1; min-width: 0; }
.cell-name     { flex: 1; min-width: 0; }
.cell-email    { flex: 1; min-width: 0; }
.cell-actions  { width: 200px; flex-shrink: 0; display: flex; justify-content: flex-end; gap: 0.5rem; }
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
.user-detail-half {
  flex: 1;
  max-width: 50%;
  border-left: 1px solid #ddd;
  padding-left: 2rem;
  background: #fff;
  overflow-y: auto;
}
</style>
