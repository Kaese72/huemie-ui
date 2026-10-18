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
  <div class="scroll-page">
    <div class="page page-narrow enter">
      <p class="kicker cloud-kicker">Optional</p>
      <h1 class="page-title">Cloud Connect</h1>
      <p class="page-lede">
        Connect this Appliance to Humi Cloud for remote access. Your home keeps
        working on its own either way.
      </p>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <section v-if="status" class="panel panel-cloud">
        <!-- Home - tunnel - Cloud. The line lights up green while connected. -->
        <div
          class="link-visual"
          :class="{ enrolled: status.status === 'enrolled', live: status.status === 'enrolled' && status.tunnelConnected }"
          aria-hidden="true"
        >
          <svg class="end home" viewBox="0 0 32 32">
            <path d="M5 15 16 6l11 9v11H5z" />
            <rect x="13" y="18" width="6" height="8" rx="1" />
          </svg>
          <span class="tunnel" />
          <svg class="end cloud" viewBox="0 0 32 32">
            <path d="M9 24h15a5 5 0 0 0 .6-9.96A7 7 0 0 0 11.2 12.2 6 6 0 0 0 9 24z" />
          </svg>
        </div>

        <dl class="kv">
          <dt>Status</dt>
          <dd>
            <span class="badge" :class="status.status === 'enrolled' ? 'badge-cloud' : 'badge-neutral'">{{ status.status }}</span>
            <span v-if="status.status === 'enrolled'" class="badge" :class="status.tunnelConnected ? 'badge-green' : 'badge-warm'">
              {{ status.tunnelConnected ? 'connected' : 'disconnected' }}
            </span>
          </dd>
          <template v-if="status.hostname">
            <dt>Hostname</dt>
            <dd class="mono">{{ status.hostname }}</dd>
          </template>
        </dl>

        <div class="form-actions">
          <button v-if="status.status === 'unenrolled'" class="btn btn-cloud" :disabled="connecting" @click="connectToCloud">
            {{ connecting ? 'Connecting…' : 'Connect to Humi Cloud' }}
          </button>
          <template v-else>
            <button class="btn btn-ghost" :disabled="rotating || resetting" @click="rotateSecret">
              {{ rotating ? 'Rotating…' : 'Rotate secret' }}
            </button>
            <button class="btn btn-danger" :disabled="resetting || rotating" @click="disconnect">
              {{ resetting ? 'Disconnecting…' : 'Disconnect' }}
            </button>
          </template>
        </div>
        <div v-if="rotated" class="alert alert-success">Secret rotated.</div>
      </section>
      <p v-else-if="!error" class="empty">Loading…</p>
    </div>
  </div>
</template>

<style scoped>
.cloud-kicker {
  color: var(--cloud-ink);
}
.link-visual {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 0 22px;
}
.end {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
}
.home {
  stroke: var(--warm);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--warm) 50%, transparent));
}
.home rect {
  fill: var(--warm);
  stroke: none;
}
.cloud {
  stroke: var(--cloud);
  filter: var(--cloud-off-filter);
  transition: filter 0.4s;
}
.enrolled .cloud {
  filter: none;
}
.tunnel {
  flex: 1;
  height: 0;
  border-top: 2px dashed color-mix(in srgb, var(--cloud) 40%, transparent);
  transition: border-color 0.4s, box-shadow 0.4s;
}
.live .tunnel {
  border-top-style: solid;
  border-top-color: var(--green);
  box-shadow: 0 0 10px color-mix(in srgb, var(--green) 60%, transparent);
}
.panel .alert {
  margin-bottom: 0;
}
</style>
