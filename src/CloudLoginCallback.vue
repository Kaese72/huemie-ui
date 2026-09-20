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
    <div v-if="error" class="error">
      <h1>Cloud login failed</h1>
      <p>{{ error }}</p>
      <router-link :to="{ name: 'Login' }">Back to login</router-link>
    </div>
    <div v-else class="pending">
      <p>Logging you in…</p>
    </div>
  </div>
</template>

<style scoped>
.callback-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.error {
  color: #c62828;
  max-width: 420px;
}
.pending {
  color: #555;
}
</style>
