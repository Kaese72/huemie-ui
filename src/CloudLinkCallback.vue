<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

// Receives the browser back from linking a user's account to the cloud (see
// UserDetail.vue's "Link Cloud" button). Unlike CloudLoginCallback, this is
// not public: the admin doing the linking is already logged in, and the
// router's navigation guard restores that session (via the refresh cookie)
// before this page runs, same as any other protected route.
const route = useRoute()
const router = useRouter()
const error = ref(null)
const CLOUD_LINK_STATE_KEY = 'cloudLinkState'

onMounted(async () => {
  const { code, state } = route.query
  if (!code || !state) {
    error.value = 'Missing login parameters. Start "Link Cloud" again from the user.'
    return
  }

  let saved = null
  try {
    saved = JSON.parse(sessionStorage.getItem(CLOUD_LINK_STATE_KEY) ?? 'null')
    sessionStorage.removeItem(CLOUD_LINK_STATE_KEY)
  } catch {
    // treated as a mismatch below
  }
  if (!saved || saved.state !== state) {
    error.value = 'This login was not started from this browser tab. Please try again.'
    return
  }

  try {
    await axios.post(`/authentication-service/v0/users/${saved.userId}/cloud/link/complete`, { code, state })
    router.replace({ name: 'UserDetail', params: { id: saved.userId } })
  } catch (err) {
    if (err.response?.status === 409) {
      error.value = 'This cloud account is already linked to another user.'
    } else if (err.response?.status === 401) {
      error.value = 'The cloud login was refused or has expired. Start "Link Cloud" again.'
    } else {
      error.value = err.response?.data?.detail ?? err.message
    }
  }
})
</script>

<template>
  <div class="callback-page">
    <div v-if="error" class="error">
      <h1>Linking cloud account failed</h1>
      <p>{{ error }}</p>
      <router-link :to="{ name: 'Users' }">Back to users</router-link>
    </div>
    <div v-else class="pending">
      <p>Linking cloud account…</p>
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
