<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import AiControlTabs from './components/AiControlTabs.vue'

const apiKeys = ref([])
const loading = ref(true)
const error = ref(null)

// Only one key is edited at a time; the secret value is write-only, so the
// form only ever holds the replacement, never the current value.
const editingId = ref(null)
const newValue = ref('')
const saving = ref(false)
const saveError = ref(null)
const savedId = ref(null)

async function fetchApiKeys() {
  try {
    const response = await axios.get('/chatbot-service/v0/api-keys')
    apiKeys.value = response.data['api-keys'] ?? []
    error.value = null
  } catch (err) {
    error.value = err
  }
}

onMounted(async () => {
  await fetchApiKeys()
  loading.value = false
})

function startEditing(key) {
  editingId.value = key.id
  newValue.value = ''
  saveError.value = null
  savedId.value = null
}

function cancelEditing() {
  editingId.value = null
  newValue.value = ''
  saveError.value = null
}

async function replaceValue(key) {
  saveError.value = null
  saving.value = true
  try {
    await axios.patch(`/chatbot-service/v0/api-keys/${key.id}`, { value: newValue.value })
    editingId.value = null
    newValue.value = ''
    savedId.value = key.id
    await fetchApiKeys()
  } catch (err) {
    saveError.value = err
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="scroll-page">
    <div class="page enter">
      <div class="list-head settings-head">
        <div>
          <h1 class="list-title">AI Control</h1>
          <p class="list-lede">Settings for the assistant.</p>
        </div>
        <AiControlTabs />
      </div>

      <p v-if="loading" class="empty">Loading…</p>
      <div v-else-if="error" class="alert alert-error">Error: {{ error.message }}</div>

      <section v-else class="panel">
        <h2 class="panel-title">Anthropic API keys</h2>
        <p class="hint key-hint">
          The key value is never shown after it has been saved. Replace it here to switch to a new one.
        </p>

        <div v-if="apiKeys.length === 0" class="empty-keys">
          <p class="empty">No API key has been set up yet.</p>
          <router-link :to="{ name: 'AIControlNew' }">Set one up from a new chat</router-link>
        </div>

        <ul class="rows">
          <li v-for="key in apiKeys" :key="key.id" class="row key-row">
            <div class="key-header">
              <div class="row-main">
                <p class="row-title">
                  {{ key.name }}
                  <span class="badge" :class="key.active ? 'badge-green' : 'badge-neutral'">{{ key.active ? 'Active' : 'Inactive' }}</span>
                </p>
                <p class="row-meta">Updated {{ new Date(key.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</p>
              </div>
              <button v-if="editingId !== key.id" class="btn btn-ghost btn-sm" @click="startEditing(key)">Replace key</button>
            </div>

            <div v-if="savedId === key.id" class="alert alert-success">API key replaced.</div>

            <form v-if="editingId === key.id" @submit.prevent="replaceValue(key)" class="key-form">
              <div class="field">
                <label :for="`key-value-${key.id}`">New API key value</label>
                <input :id="`key-value-${key.id}`" v-model="newValue" type="password" class="input" autocomplete="off" required :disabled="saving" />
              </div>
              <div v-if="saveError" class="alert alert-error">{{ saveError.response?.data?.detail || saveError.message }}</div>
              <div class="key-actions">
                <button type="button" class="btn btn-ghost btn-sm" :disabled="saving" @click="cancelEditing">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">{{ saving ? 'Saving…' : 'Save new key' }}</button>
              </div>
            </form>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-head {
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.key-hint {
  margin: -8px 0 18px;
}
.empty-keys {
  margin-bottom: 8px;
}
.key-row {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.key-header {
  display: flex;
  align-items: center;
  gap: 14px;
}
.row-title .badge {
  margin-left: 8px;
}
.key-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.key-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
