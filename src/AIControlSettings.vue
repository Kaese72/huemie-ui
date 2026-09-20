<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

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
  <div class="settings-view">
    <div class="pane-header">
      <h1>AI Control settings</h1>
    </div>

    <div v-if="loading" class="empty">Loading…</div>
    <div v-else-if="error" class="error">Error: {{ error.message }}</div>

    <div v-else class="settings-card">
      <h2>Anthropic API keys</h2>
      <p class="hint">
        The key value is never shown after it has been saved. Replace it here to switch to a new one.
      </p>

      <div v-if="apiKeys.length === 0" class="empty">
        <p>No API key has been set up yet.</p>
        <router-link :to="{ name: 'AIControlNew' }">Set one up from a new chat</router-link>
      </div>

      <div v-for="key in apiKeys" :key="key.id" class="key">
        <div class="key-header">
          <span class="key-name">{{ key.name }}</span>
          <span class="badge" :class="key.active ? 'active' : 'inactive'">{{ key.active ? 'Active' : 'Inactive' }}</span>
          <span class="key-updated">Updated {{ new Date(key.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</span>
          <button v-if="editingId !== key.id" class="secondary-btn" @click="startEditing(key)">Replace key</button>
        </div>

        <div v-if="savedId === key.id" class="success-msg">API key replaced.</div>

        <form v-if="editingId === key.id" @submit.prevent="replaceValue(key)" class="key-form">
          <div class="form-group">
            <label :for="`key-value-${key.id}`">New API key value</label>
            <input :id="`key-value-${key.id}`" v-model="newValue" type="password" autocomplete="off" required :disabled="saving" />
          </div>
          <div v-if="saveError" class="error-msg">{{ saveError.response?.data?.detail || saveError.message }}</div>
          <div class="form-actions">
            <button type="submit" class="submit-btn" :disabled="saving">{{ saving ? 'Saving…' : 'Save new key' }}</button>
            <button type="button" class="secondary-btn" :disabled="saving" @click="cancelEditing">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
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
.error { color: red; padding: 0.5rem; }
.empty { padding: 1rem; color: #999; font-style: italic; text-align: center; }
.empty p { margin: 0.25rem 0; }

.settings-card { max-width: 560px; margin-top: 0.5rem; }
.settings-card h2 { font-size: 1.1rem; margin: 0 0 0.25rem 0; }
.hint { color: #555; margin: 0 0 1rem 0; font-size: 0.9rem; }

.key {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  background: #fff;
}
.key-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.key-name { font-weight: 600; }
.key-updated { color: #777; font-size: 0.85rem; flex: 1; }
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
}
.badge.active { background: #e8f5e9; color: #1b5e20; }
.badge.inactive { background: #f0f0f0; color: #666; }

.key-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
.form-group label { font-size: 0.9rem; color: #444; font-weight: 500; }
.form-group input {
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.form-group input:focus { border-color: #42b983; }
.form-group input:disabled { background: #f5f5f5; }
.form-actions { display: flex; gap: 0.5rem; }

.error-msg {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: #721c24;
}
.success-msg {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #1b5e20;
}
.submit-btn {
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
.secondary-btn {
  background: #fff;
  color: #444;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0.4rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
}
.secondary-btn:hover:not(:disabled) { background: #f5f5f5; }
.secondary-btn:disabled { opacity: 0.65; cursor: default; }
</style>
