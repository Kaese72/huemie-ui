<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const username = ref('')
const password = ref('')
const name = ref('')
const surname = ref('')
const email = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await axios.post('/authentication-service/v0/setup/user', {
      username: username.value,
      password: password.value,
      name: name.value,
      surname: surname.value,
      email: email.value || null
    })
    done.value = true
    setTimeout(() => router.push({ name: 'Login' }), 1500)
  } catch (e) {
    if (e.response?.status === 400) {
      error.value = 'A user has already been created. Please log in instead.'
    } else {
      error.value = 'Setup failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-card">
    <p class="kicker">First start</p>
    <h1 class="auth-title">Create the first user.</h1>
    <p class="auth-subtitle">This account manages your Appliance. You can add more people later.</p>

    <div v-if="done" class="alert alert-success">
      User created. Redirecting to login…
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <div class="field">
        <label for="username">Username</label>
        <input
          id="username"
          v-model="username"
          type="text"
          class="input"
          autocomplete="username"
          required
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input"
          autocomplete="new-password"
          required
          :disabled="loading"
        />
      </div>
      <div class="name-pair">
        <div class="field">
          <label for="name">Name</label>
          <input
            id="name"
            v-model="name"
            type="text"
            class="input"
            autocomplete="given-name"
            required
            :disabled="loading"
          />
        </div>
        <div class="field">
          <label for="surname">Surname</label>
          <input
            id="surname"
            v-model="surname"
            type="text"
            class="input"
            autocomplete="family-name"
            required
            :disabled="loading"
          />
        </div>
      </div>
      <div class="field">
        <label for="email">Email (optional)</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input"
          autocomplete="email"
          :disabled="loading"
        />
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <button type="submit" :disabled="loading" class="btn btn-primary btn-block">
        {{ loading ? 'Creating…' : 'Create user' }}
      </button>
    </form>

    <div class="auth-links">
      <router-link to="/login">← Back to login</router-link>
    </div>
  </div>
</template>

<style scoped>
.name-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}
.name-pair .field + .field {
  margin-top: 0;
}
.name-pair + .field {
  margin-top: 14px;
}
</style>
