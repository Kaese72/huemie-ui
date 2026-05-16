<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuth } from './composables/useAuth.js'

const router = useRouter()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const userSetupNeeded = ref(false)

onMounted(async () => {
  try {
    const resp = await axios.get('/authentication-service/v0/setup/status')
    userSetupNeeded.value = !resp.data.user
  } catch {
    // If the status check fails, assume setup is done
  }
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(username.value, password.value)
    router.push({ name: 'Home' })
  } catch (e) {
    if (e.response?.status === 401) {
      error.value = 'Invalid username or password.'
    } else {
      error.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="app-title">Huemie</h1>

      <div v-if="userSetupNeeded" class="setup-banner">
        No users have been created yet.
        <router-link to="/setup" class="setup-link">Set up initial user →</router-link>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            :disabled="loading"
          />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f7f9fa;
}

.login-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.10);
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
}

.app-title {
  margin: 0 0 1.5rem;
  font-size: 1.8rem;
  color: #222e3a;
  text-align: center;
}

.setup-banner {
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
  font-size: 0.9rem;
  color: #5a4500;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.setup-link {
  color: #1565c0;
  font-weight: 600;
  text-decoration: none;
}

.setup-link:hover {
  text-decoration: underline;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.9rem;
  color: #444;
  font-weight: 500;
}

.form-group input {
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.15s;
}

.form-group input:focus {
  border-color: #42b983;
}

.form-group input:disabled {
  background: #f5f5f5;
}

.error-msg {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: #721c24;
}

.submit-btn {
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.65rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 0.25rem;
}

.submit-btn:hover:not(:disabled) {
  background: #369b6f;
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: default;
}
</style>
