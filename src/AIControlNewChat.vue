<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const loadingStatus = ref(true)
const apiKeyConfigured = ref(false)
const statusError = ref(null)

const apiKeyName = ref('')
const apiKeyValue = ref('')
const settingUpApiKey = ref(false)
const apiKeyError = ref(null)

const query = ref('')
const creating = ref(false)
const createError = ref(null)

const ready = () => apiKeyConfigured.value

async function fetchStatus() {
  try {
    const response = await axios.get('/chatbot-service/v0/status')
    apiKeyConfigured.value = response.data['api-key']
    statusError.value = null
  } catch (err) {
    statusError.value = err
  }
}

onMounted(async () => {
  await fetchStatus()
  loadingStatus.value = false
})

async function setupApiKey() {
  apiKeyError.value = null
  settingUpApiKey.value = true
  try {
    await axios.post('/chatbot-service/v0/api-keys', {
      name: apiKeyName.value,
      type: 'ANTHROPIC',
      active: true,
      value: apiKeyValue.value,
    })
    await fetchStatus()
  } catch (err) {
    apiKeyError.value = err
  } finally {
    settingUpApiKey.value = false
  }
}

async function startConversation() {
  createError.value = null
  creating.value = true
  try {
    const response = await axios.post('/chatbot-service/v0/conversations/new', { query: query.value })
    router.push({ name: 'AIControlChat', params: { id: response.data.id } })
  } catch (err) {
    createError.value = err
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="new-chat-view">
    <div class="pane-header">
      <h2 class="detail-title">New chat</h2>
      <router-link :to="{ name: 'AIControl' }" class="icon-btn" title="Back to conversations" aria-label="Back to conversations">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </router-link>
    </div>

    <p v-if="loadingStatus" class="empty">Checking the assistant's status…</p>
    <div v-else-if="statusError" class="alert alert-error">Error: {{ statusError.message }}</div>

    <div v-else class="setup-card">
      <div v-if="!ready()" class="onboarding">
        <p class="hint onboarding-intro">Before you can start a conversation, the assistant needs an Anthropic API key.</p>

        <div class="panel step" :class="{ done: apiKeyConfigured }">
          <div class="step-header">
            <span class="step-icon">{{ apiKeyConfigured ? '✓' : '1' }}</span>
            <span class="step-title">An Anthropic API key</span>
          </div>
          <form v-if="!apiKeyConfigured" @submit.prevent="setupApiKey" class="step-form">
            <div class="field">
              <label for="api-key-name">Name</label>
              <input id="api-key-name" v-model="apiKeyName" type="text" class="input" required :disabled="settingUpApiKey" />
            </div>
            <div class="field">
              <label for="api-key-value">API key value</label>
              <input id="api-key-value" v-model="apiKeyValue" type="password" class="input" required :disabled="settingUpApiKey" />
            </div>
            <div v-if="apiKeyError" class="alert alert-error">{{ apiKeyError.response?.data?.detail || apiKeyError.message }}</div>
            <button type="submit" class="btn btn-primary" :disabled="settingUpApiKey">
              {{ settingUpApiKey ? 'Saving…' : 'Save API key' }}
            </button>
          </form>
        </div>
      </div>

      <form v-else @submit.prevent="startConversation" class="start-form">
        <div class="field">
          <label for="query">What do you want to ask?</label>
          <textarea id="query" v-model="query" rows="4" class="input" required :disabled="creating"></textarea>
        </div>
        <div v-if="createError" class="alert alert-error">{{ createError.response?.data?.detail || createError.message }}</div>
        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Starting…' : 'Start conversation' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.new-chat-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.setup-card {
  max-width: 480px;
  margin-top: 8px;
}
.onboarding-intro {
  margin: 0 0 14px;
}
.step.done {
  opacity: 0.7;
}
.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.step-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--warm) 40%, transparent);
  color: var(--warm-ink);
  font-size: 0.85rem;
  font-weight: 700;
  flex-shrink: 0;
}
.step.done .step-icon {
  border-color: color-mix(in srgb, var(--green) 40%, transparent);
  background: color-mix(in srgb, var(--green) 14%, transparent);
  color: var(--green-ink);
}
.step-title {
  font-weight: 600;
}
.step-form,
.start-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step-form .field + .field,
.start-form .field + .field {
  margin-top: 0;
}
.step-form .btn,
.start-form .btn {
  align-self: flex-start;
}
</style>
