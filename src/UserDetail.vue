<script setup>

import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth.js'
import BoolBadge from './components/BoolBadge.vue'

const emit = defineEmits(['updated'])
const { cloudLoginAvailable, currentUserId } = useAuth()

const route = useRoute()
const user = ref(null)
const form = ref({ name: '', surname: '', email: '' })
const saving = ref(false)
const error = ref(null)
const saveError = ref(null)

// Whether the appliance is enrolled with the cloud at all - "Link Cloud" is
// pointless (and would just fail) to offer otherwise.
const cloudAvailable = ref(false)
const linkingCloud = ref(false)
const linkError = ref(null)
// Read by CloudLinkCallback.vue when the browser comes back from the cloud,
// to check the callback belongs to a link this tab started and to know which
// user to complete the link for.
const CLOUD_LINK_STATE_KEY = 'cloudLinkState'

onMounted(fetchUser)
onMounted(async () => { cloudAvailable.value = await cloudLoginAvailable() })
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

// Sends the browser to the cloud to link this user's account. On return,
// CloudLinkCallback.vue finishes the link and comes back here.
async function linkCloud() {
  if (!user.value || !cloudAvailable.value || user.value.id !== currentUserId.value) return
  linkingCloud.value = true
  linkError.value = null
  try {
    const returnTo = `${window.location.origin}/cloud-link/callback`
    const response = await axios.post(
      `/authentication-service/v0/users/${user.value.id}/cloud/link/start`,
      { returnTo }
    )
    try {
      sessionStorage.setItem(CLOUD_LINK_STATE_KEY, JSON.stringify({ state: response.data.state, userId: user.value.id }))
    } catch {
      throw new Error('This browser blocks the storage needed for cloud login.')
    }
    window.location.href = response.data.cloudUrl
  } catch (err) {
    linkError.value = err.response?.data?.detail ?? err.message
    linkingCloud.value = false
  }
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <div v-else-if="user">
    <div class="detail-head">
      <h2 class="detail-title">
        {{ user.username }}
        <span v-if="user.id === currentUserId" class="badge badge-warm">You</span>
      </h2>
    </div>
    <div class="detail-meta">
      <span><strong>ID</strong> <span class="mono">{{ user.id }}</span></span>
    </div>

    <h3 class="section-title">Sign-in</h3>
    <dl class="kv">
      <dt>Username</dt>
      <dd>{{ user.username }}</dd>
      <dt>Local login</dt>
      <dd>
        <BoolBadge :value="!!user.localLogin" />
        <span :class="user.localLogin ? '' : 'na'">{{ user.localLogin ? 'Yes, has a password' : 'No' }}</span>
      </dd>
      <dt>Humi Cloud</dt>
      <dd>
        <span v-if="user.cloudLogin" class="badge badge-cloud">Linked</span>
        <span v-else class="na">Not linked</span>
        <button
          v-if="!user.cloudLogin && cloudAvailable && user.id === currentUserId"
          class="btn btn-cloud btn-sm"
          :disabled="linkingCloud"
          @click="linkCloud"
        >
          {{ linkingCloud ? 'Redirecting…' : 'Link Humi Cloud' }}
        </button>
      </dd>
    </dl>
    <div v-if="linkError" class="alert alert-error">{{ linkError }}</div>

    <h3 class="section-title">Profile</h3>
    <div class="name-pair">
      <div class="field">
        <label for="user-name">Name</label>
        <input id="user-name" v-model="form.name" type="text" class="input" :disabled="saving" />
      </div>
      <div class="field">
        <label for="user-surname">Surname</label>
        <input id="user-surname" v-model="form.surname" type="text" class="input" :disabled="saving" />
      </div>
    </div>
    <div class="field email-field">
      <label for="user-email">Email</label>
      <input id="user-email" v-model="form.email" type="email" class="input" :disabled="saving" />
    </div>
    <div v-if="saveError" class="alert alert-error">{{ saveError }}</div>
    <div class="form-actions">
      <button class="btn btn-primary" :disabled="saving || !isDirty()" @click="saveUser">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
      <button class="btn btn-ghost" :disabled="saving || !isDirty()" @click="resetForm">Reset</button>
    </div>
  </div>
  <p v-else class="empty">Loading…</p>
</template>

<style scoped>
.name-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.name-pair .field + .field {
  margin-top: 0;
}
.email-field {
  margin-top: 14px;
}
</style>
