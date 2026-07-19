<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'

const emit = defineEmits(['updated'])

const route = useRoute()
const user = ref(null)
const form = ref({ name: '', surname: '', email: '' })
const saving = ref(false)
const error = ref(null)
const saveError = ref(null)

onMounted(fetchUser)
watch(() => route.params.id, fetchUser)

async function fetchUser() {
  if (!route.params.id) return
  user.value = null
  saveError.value = null
  try {
    const response = await axios.get(`/authentication-service/v0/users/${route.params.id}`)
    user.value = response.data
    error.value = null
    resetForm()
  } catch (err) {
    error.value = err
    user.value = null
  }
}

function resetForm() {
  form.value = {
    name: user.value?.name ?? '',
    surname: user.value?.surname ?? '',
    email: user.value?.email ?? '',
  }
}

function isDirty() {
  if (!user.value) return false
  return form.value.name !== (user.value.name ?? '') ||
    form.value.surname !== (user.value.surname ?? '') ||
    form.value.email !== (user.value.email ?? '')
}

async function saveUser() {
  if (!route.params.id) return
  saving.value = true
  saveError.value = null
  try {
    const response = await axios.put(`/authentication-service/v0/users/${route.params.id}`, {
      name: form.value.name,
      surname: form.value.surname,
      email: form.value.email || null,
    })
    user.value = response.data
    resetForm()
    emit('updated', user.value)
  } catch (err) {
    saveError.value = err.response?.data?.detail ?? err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="error">Error: {{ error.message }}</div>
  <div v-else-if="user">
    <h2>User Details: {{ user.username }}</h2>
    <div class="user-info">
      <div class="info-section">
        <h3>General Information</h3>
        <ul>
          <li><strong>ID:</strong> {{ user.id }}</li>
          <li><strong>Username:</strong> {{ user.username }}</li>
        </ul>
      </div>

      <div class="info-section">
        <h3>Profile</h3>
        <div class="form-row">
          <label>Name</label>
          <input v-model="form.name" type="text" class="form-input" :disabled="saving" />
        </div>
        <div class="form-row">
          <label>Surname</label>
          <input v-model="form.surname" type="text" class="form-input" :disabled="saving" />
        </div>
        <div class="form-row">
          <label>Email</label>
          <input v-model="form.email" type="email" class="form-input" :disabled="saving" />
        </div>
        <div v-if="saveError" class="save-error">{{ saveError }}</div>
        <div class="form-actions">
          <button class="save-button" :disabled="saving || !isDirty()" @click="saveUser">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
          <button class="cancel-button" :disabled="saving || !isDirty()" @click="resetForm">Reset</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else>Loading...</div>
</template>

<style scoped>
.user-info {
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

.form-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.75rem;
}

.form-row label {
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 0.3rem;
}

.form-input {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.form-input:disabled { background: #f0f0f0; }

.save-error {
  color: #c62828;
  font-size: 0.85rem;
  margin-bottom: 0.6rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.save-button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  background: #2d8cff;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
}

.save-button:disabled {
  background: #9bbcf2;
  cursor: not-allowed;
}

.cancel-button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: #f4f4f4;
  color: #222;
  cursor: pointer;
  font-size: 0.9rem;
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
