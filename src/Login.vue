<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useAuth } from './composables/useAuth.js'

const router = useRouter()
const { login, cloudLoginAvailable, startCloudLogin } = useAuth()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const userSetupNeeded = ref(false)
const cloudAvailable = ref(false)

onMounted(async () => {
  try {
    const resp = await axios.get('/authentication-service/v0/setup/status')
    userSetupNeeded.value = !resp.data.user
  } catch {
    // If the status check fails, assume setup is done
  }
  cloudAvailable.value = await cloudLoginAvailable()
})

async function handleCloudLogin() {
  error.value = ''
  loading.value = true
  try {
    await startCloudLogin()
  } catch (e) {
    error.value = e.response?.data?.detail ?? e.message ?? 'Could not start cloud login. Please try again.'
    loading.value = false
  }
}

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
  <div class="auth-card">
    <p class="wordmark">Humi</p>
    <h1 class="auth-title">Welcome home.</h1>
    <p class="auth-subtitle">Log in to this Appliance.</p>

    <div v-if="userSetupNeeded" class="alert alert-warning setup-banner">
      No users have been created yet.
      <router-link to="/setup" class="setup-link">Set up the first user →</router-link>
    </div>

    <form @submit.prevent="handleSubmit">
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
          autocomplete="current-password"
          required
          :disabled="loading"
        />
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <button type="submit" :disabled="loading" class="btn btn-primary btn-block">
        {{ loading ? 'Logging in…' : 'Log in' }}
      </button>
    </form>

    <template v-if="cloudAvailable">
      <div class="divider"><span>or</span></div>
      <button type="button" :disabled="loading" class="btn btn-cloud btn-block" @click="handleCloudLogin">
        Log in with Humi Cloud
      </button>
    </template>
  </div>
</template>

<style scoped>
/* The one place the "Humi" gradient wordmark appears in the Appliance UI. */
.wordmark {
  margin: 0 0 14px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--humi-gradient);
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 8s linear infinite;
  display: inline-block;
}
@keyframes shimmer {
  from { background-position: 0% 0; }
  to { background-position: 250% 0; }
}
.setup-banner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 18px;
}
.setup-link {
  color: inherit;
  font-weight: 700;
  text-decoration: none;
}
.setup-link:hover {
  text-decoration: underline;
}
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 14px;
  color: var(--faint);
  font-size: 0.85rem;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
/* .auth-card .btn-block adds a top margin for the submit button; the cloud
   button follows the divider instead. */
.auth-card .btn-cloud.btn-block {
  margin-top: 0;
}
@media (prefers-reduced-motion: reduce) {
  .wordmark { animation: none; }
}
</style>
