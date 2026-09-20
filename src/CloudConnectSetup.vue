<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

// See cloud-connect's README, "Enrollment" section, for the full flow this
// page kicks off.
const status = ref(null)
const error = ref(null)
const connecting = ref(false)
const resetting = ref(false)
const rotating = ref(false)
const rotated = ref(false)
let pollId = null

onMounted(async () => {
  await fetchStatus()
  pollId = setInterval(fetchStatus, 5000)
})

onUnmounted(() => {
  if (pollId) clearInterval(pollId)
})

async function fetchStatus() {
  try {
    const response = await axios.get('/cloud-connect-client/v0/status')
    status.value = response.data
    error.value = null
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  }
}

async function connectToCloud() {
  connecting.value = true
  error.value = null
  try {
    const returnTo = `${window.location.origin}/cloud-connect/callback`
    const response = await axios.post('/cloud-connect-client/v0/enrollment/start', { returnTo })
    window.location.href = response.data.cloudUrl
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
    connecting.value = false
  }
}

async function rotateSecret() {
  if (!confirm('Rotate this appliance\'s cloud secret? The old secret stops working immediately and remote access reconnects with the new one.')) return
  rotating.value = true
  rotated.value = false
  error.value = null
  try {
    const response = await axios.post('/cloud-connect-client/v0/enrollment/rotate-secret')
    status.value = response.data
    rotated.value = true
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  } finally {
    rotating.value = false
  }
}

async function disconnect() {
  if (!confirm('Disconnect this appliance from the cloud? You will need to enroll again to restore remote access.')) return
  resetting.value = true
  error.value = null
  try {
    await axios.post('/cloud-connect-client/v0/enrollment/reset')
    await fetchStatus()
  } catch (err) {
    error.value = err.response?.data?.detail ?? err.message
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="cloud-connect-page">
    <h1>Cloud Connect</h1>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="status" class="panel">
      <p>
        Status:
        <span class="badge" :class="`badge-${status.status}`">{{ status.status }}</span>
        <span v-if="status.status === 'enrolled'" class="badge" :class="status.tunnelConnected ? 'badge-connected' : 'badge-disconnected'">
          {{ status.tunnelConnected ? 'connected' : 'disconnected' }}
        </span>
      </p>
      <p v-if="status.hostname" class="hostname">{{ status.hostname }}</p>

      <button v-if="status.status === 'unenrolled'" class="btn-connect" :disabled="connecting" @click="connectToCloud">
        {{ connecting ? 'Connecting…' : 'Connect to Cloud' }}
      </button>
      <template v-else>
        <button class="btn-rotate" :disabled="rotating || resetting" @click="rotateSecret">
          {{ rotating ? 'Rotating…' : 'Rotate secret' }}
        </button>
        <button class="btn-disconnect" :disabled="resetting || rotating" @click="disconnect">
          {{ resetting ? 'Disconnecting…' : 'Disconnect' }}
        </button>
        <p v-if="rotated" class="notice">Secret rotated.</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cloud-connect-page {
  width: 100%;
  max-width: 560px;
}
.panel {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
}
.hostname {
  color: #555;
  font-size: 0.9rem;
}
.badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-unenrolled { background: #f0f0f0; color: #666; }
.badge-enrolled { background: #d4edda; color: #1b5e20; }
.badge-connected { background: #d4edda; color: #1b5e20; }
.badge-disconnected { background: #fff3cd; color: #856404; }
.btn-connect, .btn-disconnect, .btn-rotate {
  margin-top: 1rem;
  margin-right: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-connect {
  background: #42b983;
  color: #fff;
}
.btn-connect:hover:not(:disabled) { background: #369b6f; }
.btn-disconnect {
  background: #fff;
  color: #c62828;
  border: 1px solid #c62828;
}
.btn-disconnect:hover:not(:disabled) { background: #c62828; color: #fff; }
.btn-rotate {
  background: #fff;
  color: #333;
  border: 1px solid #999;
}
.btn-rotate:hover:not(:disabled) { background: #f0f0f0; }
.btn-connect:disabled, .btn-disconnect:disabled, .btn-rotate:disabled { opacity: 0.6; cursor: default; }
.notice {
  color: #1b5e20;
  font-size: 0.9rem;
}
.error {
  color: #c62828;
  padding: 0.5rem 0;
  font-size: 0.9rem;
}
</style>
