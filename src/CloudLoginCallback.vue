<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth.js'

// Receives the browser back from cloud-ui's /appliance-login redirect - see
// appliance-registry's README, "Cloud login" section. Public: the user has no
// local session yet, only a single-use code that this appliance redeems
// with the cloud.
const route = useRoute()
const router = useRouter()
const { completeCloudLogin } = useAuth()
const error = ref(null)

onMounted(async () => {
  const { code, state } = route.query
  if (!code || !state) {
    error.value = 'Missing login parameters. Start the login again.'
    return
  }
  try {
    await completeCloudLogin(code, state)
    router.replace({ name: 'Home' })
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      error.value = 'The cloud login was refused or has expired. Start the login again.'
    } else {
      error.value = err.response?.data?.detail ?? err.message
    }
  }
})
</script>

<template>
  <div class="callback-page">
    <div v-if="error" class="status-card">
      <h1 class="status-title">Cloud login failed.</h1>
      <div class="alert alert-error">{{ error }}</div>
      <router-link :to="{ name: 'Login' }" class="btn btn-ghost">Back to login</router-link>
    </div>
    <div v-else class="status-card">
      <span class="spinner" aria-hidden="true" />
      <p class="status-text">Logging you in…</p>
    </div>
  </div>
</template>
