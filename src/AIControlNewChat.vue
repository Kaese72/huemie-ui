<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const loadingStatus = ref(true)
const identityConfigured = ref(false)
const apiKeyConfigured = ref(false)
const statusError = ref(null)

const identityName = ref('')
const settingUpIdentity = ref(false)
const identityError = ref(null)

const apiKeyName = ref('')
const apiKeyValue = ref('')
const settingUpApiKey = ref(false)
const apiKeyError = ref(null)

const query = ref('')
const creating = ref(false)
const createError = ref(null)

const ready = () => identityConfigured.value && apiKeyConfigured.value

async function fetchStatus() {
  try {
    const response = await axios.get('/chatbot-service/v0/status')
    identityConfigured.value = response.data.identity
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

async function setupIdentity() {
  identityError.value = null
  settingUpIdentity.value = true
  try {
    await axios.post('/chatbot-service/v0/identities/setup', { name: identityName.value })
    await fetchStatus()
  } catch (err) {
    identityError.value = err
  } finally {
    settingUpIdentity.value = false
  }
}

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
      <h1>New chat</h1>
      <router-link :to="{ name: 'AIControl' }" class="back-link">← Back to conversations</router-link>
    </div>

    <div v-if="loadingStatus" class="empty">Checking chatbot status…</div>
    <div v-else-if="statusError" class="error">Error: {{ statusError.message }}</div>

    <div v-else class="setup-card">
      <div v-if="!ready()" class="onboarding">
        <p class="onboarding-intro">Before you can start a conversation, the chatbot needs:</p>

        <div class="step" :class="{ done: apiKeyConfigured }">
          <div class="step-header">
            <span class="step-icon">{{ apiKeyConfigured ? '✓' : '1' }}</span>
            <span class="step-title">An Anthropic API key</span>
          </div>
          <form v-if="!apiKeyConfigured" @submit.prevent="setupApiKey" class="step-form">
            <div class="form-group">
              <label for="api-key-name">Name</label>
              <input id="api-key-name" v-model="apiKeyName" type="text" required :disabled="settingUpApiKey" />
            </div>
            <div class="form-group">
              <label for="api-key-value">API key value</label>
              <input id="api-key-value" v-model="apiKeyValue" type="password" required :disabled="settingUpApiKey" />
            </div>
            <div v-if="apiKeyError" class="error-msg">{{ apiKeyError.response?.data?.detail || apiKeyError.message }}</div>
            <button type="submit" class="submit-btn" :disabled="settingUpApiKey">
              {{ settingUpApiKey ? 'Saving…' : 'Save API key' }}
            </button>
          </form>
        </div>

        <div class="step" :class="{ done: identityConfigured }">
          <div class="step-header">
            <span class="step-icon">{{ identityConfigured ? '✓' : '2' }}</span>
            <span class="step-title">Its own identity</span>
          </div>
          <form v-if="!identityConfigured" @submit.prevent="setupIdentity" class="step-form">
            <div class="form-group">
              <label for="identity-name">Display name</label>
              <input id="identity-name" v-model="identityName" type="text" required :disabled="settingUpIdentity" />
            </div>
            <div v-if="identityError" class="error-msg">{{ identityError.response?.data?.detail || identityError.message }}</div>
            <button type="submit" class="submit-btn" :disabled="settingUpIdentity">
              {{ settingUpIdentity ? 'Setting up…' : 'Set up identity' }}
            </button>
          </form>
        </div>
      </div>

      <form v-else @submit.prevent="startConversation" class="start-form">
        <div class="form-group">
          <label for="query">What do you want to ask?</label>
          <textarea id="query" v-model="query" rows="4" required :disabled="creating"></textarea>
        </div>
        <div v-if="createError" class="error-msg">{{ createError.response?.data?.detail || createError.message }}</div>
        <button type="submit" class="submit-btn" :disabled="creating">
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
  padding-right: 1rem;
  flex-shrink: 0;
}
.pane-header h1 { margin: 0 0 0.5rem 0; }
.back-link { color: #666; text-decoration: none; font-size: 0.9rem; }
.back-link:hover { color: #42b983; }
.error { color: red; padding: 0.5rem; }
.empty { padding: 2rem 1rem; color: #999; font-style: italic; text-align: center; }

.setup-card {
  max-width: 480px;
  margin-top: 1rem;
}
.onboarding-intro { color: #555; margin-bottom: 1rem; }
.step {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #fff;
}
.step.done { opacity: 0.7; }
.step-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0f0f0;
  font-size: 0.85rem;
  font-weight: bold;
  flex-shrink: 0;
}
.step.done .step-icon { background: #e8f5e9; color: #1b5e20; }
.step-title { font-weight: 600; }

.step-form, .start-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form-group label { font-size: 0.9rem; color: #444; font-weight: 500; }
.form-group input, .form-group textarea {
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  resize: vertical;
}
.form-group input:focus, .form-group textarea:focus { border-color: #42b983; }
.form-group input:disabled, .form-group textarea:disabled { background: #f5f5f5; }

.error-msg {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: #721c24;
}
.submit-btn {
  align-self: flex-start;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.5rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.submit-btn:hover:not(:disabled) { background: #369b6f; }
.submit-btn:disabled { opacity: 0.65; cursor: default; }
</style>
