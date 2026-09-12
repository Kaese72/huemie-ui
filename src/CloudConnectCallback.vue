<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

// Receives the browser back from cloud-ui's /enroll redirect - see
// cloud-connect's README, "Enrollment" section, step 3-4.
const route = useRoute()
const router = useRouter()
const error = ref(null)
const done = ref(false)

onMounted(async () => {
  const { code, state, applianceId } = route.query
  if (!code || !state || !applianceId) {
    error.value = 'Missing enrollment parameters. Restart "Connect to Cloud" from the appliance.'
    return
  }
  try {
    await axios.post('/cloud-connect-client/v0/enrollment/complete', {
      code,
      state,
      applianceId: Number(applianceId),
    })
    done.value = true
    setTimeout(() => router.push({ name: 'CloudConnectSetup' }), 1500)
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  }
})
</script>

<template>
  <div class="callback-page">
    <div v-if="error" class="error">
      <h1>Enrollment failed</h1>
      <p>{{ error }}</p>
      <router-link :to="{ name: 'CloudConnectSetup' }">Back to Cloud Connect</router-link>
    </div>
    <div v-else-if="done" class="success">
      <p>Enrolled. Connecting the tunnel…</p>
    </div>
    <div v-else class="pending">
      <p>Finishing enrollment…</p>
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
.success, .pending {
  color: #555;
}
</style>
