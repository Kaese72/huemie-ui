<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import ConditionNode from './components/ConditionNode.vue'

const route = useRoute()
const router = useRouter()
const emit = defineEmits(['updated', 'deleted'])

const rule = ref(null)
const error = ref(null)
const saving = ref(false)

// Editable copies
const editName = ref('')
const editEnabled = ref(false)
const editConditionTree = ref(null)

// Evaluate state
const evaluating = ref(false)
const evalResult = ref(null) // { result: bool, reason?: string } | null

async function evaluateRule() {
  if (!rule.value) return
  evaluating.value = true
  evalResult.value = null
  try {
    const res = await axios.get(`/ittt-orchestrator/v0/rules/${rule.value.id}/evaluate`)
    evalResult.value = res.data
  } catch (err) {
    error.value = err
  } finally {
    evaluating.value = false
  }
}

// Action state
const actions = ref([])
const showActionForm = ref(false)
const editingAction = ref(null) // { actionId, type, id, capability, args }

onMounted(fetchRule)
watch(() => route.params.id, fetchRule)

async function fetchRule() {
  if (!route.params.id) return
  error.value = null
  try {
    const res = await axios.get(`/ittt-orchestrator/v0/rules/${route.params.id}`)
    applyRule(res.data)
  } catch (err) {
    error.value = err
  }
}

function applyRule(data) {
  rule.value = data
  editName.value = data.name
  editEnabled.value = data.enabled
  editConditionTree.value = data['condition-tree']
    ? JSON.parse(JSON.stringify(data['condition-tree']))
    : null
  actions.value = data.actions ? JSON.parse(JSON.stringify(data.actions)) : []
}

function addRootCondition() {
  editConditionTree.value = { condition: { type: 'time-range', from: '06:00:00', to: '22:00:00' }, and: null, or: null }
}

function removeRootCondition() {
  editConditionTree.value = null
}

async function saveRule() {
  if (!rule.value) return
  saving.value = true
  try {
    const res = await axios.put(`/ittt-orchestrator/v0/rules/${rule.value.id}`, {
      name: editName.value,
      enabled: editEnabled.value,
      'condition-tree': editConditionTree.value ?? undefined,
    })
    applyRule(res.data)
    emit('updated', res.data)
  } catch (err) {
    error.value = err
  } finally {
    saving.value = false
  }
}

async function deleteRule() {
  if (!rule.value) return
  if (!confirm(`Delete rule "${rule.value.name}"?`)) return
  try {
    await axios.delete(`/ittt-orchestrator/v0/rules/${rule.value.id}`)
    emit('deleted', rule.value.id)
  } catch (err) {
    error.value = err
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

function openNewActionForm() {
  editingAction.value = { actionId: null, type: 'device-capability', id: 1, capability: '', args: '' }
  showActionForm.value = true
}

function openEditActionForm(action) {
  editingAction.value = {
    actionId: action['action-id'],
    type: action.type,
    id: action.id,
    capability: action.capability,
    args: action.args ? JSON.stringify(action.args, null, 2) : '',
  }
  showActionForm.value = true
}

function cancelActionForm() {
  showActionForm.value = false
  editingAction.value = null
}

function parseArgs(raw) {
  if (!raw || raw.trim() === '') return {}
  try { return JSON.parse(raw) } catch { return {} }
}

async function saveAction() {
  if (!editingAction.value) return
  const payload = {
    type: editingAction.value.type,
    id: editingAction.value.id,
    capability: editingAction.value.capability,
    args: parseArgs(editingAction.value.args),
  }
  try {
    if (editingAction.value.actionId) {
      const res = await axios.put(
        `/ittt-orchestrator/v0/rules/${rule.value.id}/actions/${editingAction.value.actionId}`,
        payload
      )
      const idx = actions.value.findIndex(a => a['action-id'] === editingAction.value.actionId)
      if (idx !== -1) actions.value.splice(idx, 1, res.data)
    } else {
      const res = await axios.post(`/ittt-orchestrator/v0/rules/${rule.value.id}/actions`, payload)
      actions.value.push(res.data)
    }
    cancelActionForm()
  } catch (err) {
    error.value = err
  }
}

async function deleteAction(action) {
  if (!confirm(`Delete action "${action.capability}"?`)) return
  try {
    await axios.delete(`/ittt-orchestrator/v0/rules/${rule.value.id}/actions/${action['action-id']}`)
    actions.value = actions.value.filter(a => a['action-id'] !== action['action-id'])
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div v-if="error" class="error">Error: {{ error.message }}</div>
  <div v-else-if="!rule" class="loading">Loading…</div>
  <div v-else class="rule-detail">

    <div class="detail-header">
      <h2>Rule #{{ rule.id }}</h2>
      <button class="btn-danger" @click="deleteRule">Delete rule</button>
    </div>

    <!-- ── Basic fields ── -->
    <section class="section">
      <div class="field-row">
        <label class="field-label">Name</label>
        <input v-model="editName" type="text" class="name-input" />
      </div>
      <div class="field-row">
        <label class="field-label">Enabled</label>
        <input v-model="editEnabled" type="checkbox" class="enabled-check" />
      </div>
      <div class="field-row">
        <label class="field-label">Next run</label>
        <span class="field-value">{{ rule['next-occurence'] ? new Date(rule['next-occurence']).toLocaleString() : '—' }}</span>
      </div>
    </section>

    <!-- ── Condition tree ── -->
    <section class="section">
      <div class="section-header">
        <h3>Condition tree</h3>
        <button v-if="!editConditionTree" class="btn-secondary" @click="addRootCondition">
          + Add condition
        </button>
        <button v-else class="btn-danger-sm" @click="removeRootCondition">
          Clear all
        </button>
      </div>
      <div v-if="editConditionTree" class="tree-container">
        <ConditionNode
          :node="editConditionTree"
          :isRoot="true"
          @update="editConditionTree = $event"
        />
      </div>
      <div v-else class="empty-hint">No conditions — rule will never trigger.</div>
    </section>

    <!-- ── Save / Test row ── -->
    <div class="save-row">
      <button class="btn-primary" @click="saveRule" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save rule' }}
      </button>
      <button class="btn-secondary" @click="evaluateRule" :disabled="evaluating">
        {{ evaluating ? 'Testing…' : 'Test now' }}
      </button>
      <span v-if="evalResult !== null" class="eval-result" :class="evalResult.result ? 'eval-true' : 'eval-false'">
        {{ evalResult.result ? '✓ true' : '✗ false' }}
        <span v-if="!evalResult.result && evalResult.reason" class="eval-reason">— {{ evalResult.reason }}</span>
        <span v-if="evalResult['next-occurrence']" class="eval-next">· next: {{ new Date(evalResult['next-occurrence']).toLocaleString() }}</span>
      </span>
    </div>

    <!-- ── Actions ── -->
    <section class="section">
      <div class="section-header">
        <h3>Actions</h3>
        <button v-if="!showActionForm" class="btn-secondary" @click="openNewActionForm">
          + Add action
        </button>
      </div>

      <div v-if="actions.length === 0 && !showActionForm" class="empty-hint">
        No actions configured.
      </div>

      <table v-if="actions.length > 0" class="actions-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Target ID</th>
            <th>Capability</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="action in actions" :key="action['action-id']">
            <td>{{ action.type }}</td>
            <td>{{ action.id }}</td>
            <td>{{ action.capability }}</td>
            <td class="action-btns">
              <button class="btn-sm" @click="openEditActionForm(action)">Edit</button>
              <button class="btn-sm btn-sm-danger" @click="deleteAction(action)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Inline action form -->
      <div v-if="showActionForm && editingAction" class="action-form">
        <h4>{{ editingAction.actionId ? 'Edit action' : 'New action' }}</h4>
        <div class="form-grid">
          <label>Type</label>
          <select v-model="editingAction.type">
            <option value="device-capability">device-capability</option>
            <option value="group-capability">group-capability</option>
          </select>

          <label>Target ID</label>
          <input type="number" v-model.number="editingAction.id" min="1" />

          <label>Capability</label>
          <input type="text" v-model="editingAction.capability" placeholder="e.g. activate" />

          <label>Args (JSON)</label>
          <textarea v-model="editingAction.args" rows="3" placeholder='e.g. {"brightness": 100}'></textarea>
        </div>
        <div class="form-buttons">
          <button class="btn-primary" @click="saveAction">Save</button>
          <button class="btn-secondary" @click="cancelActionForm">Cancel</button>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.rule-detail {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.detail-header h2 { margin: 0; }
.section {
  margin-bottom: 1.5rem;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.section-header h3 { margin: 0; }
.field-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.field-label {
  width: 72px;
  font-weight: 500;
  color: #444;
  flex-shrink: 0;
}
.name-input {
  flex: 1;
  max-width: 320px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
}
.enabled-check {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.field-value {
  color: #555;
  font-size: 0.9rem;
}
.tree-container {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem;
  background: #fafafa;
}
.empty-hint {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}
.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.eval-result {
  font-size: 0.9rem;
  font-weight: 500;
}
.eval-true { color: #2e7d32; }
.eval-false { color: #c62828; }
.eval-reason {
  font-weight: normal;
  color: #555;
}
.eval-next {
  font-weight: normal;
  color: #777;
  font-size: 0.85rem;
}
.actions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}
.actions-table th,
.actions-table td {
  border: 1px solid #e0e0e0;
  padding: 6px 10px;
  text-align: left;
}
.actions-table th { background: #f5f5f5; }
.action-btns { display: flex; gap: 6px; white-space: nowrap; }
.action-form {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  background: #fafafa;
  margin-top: 0.75rem;
}
.action-form h4 { margin: 0 0 0.75rem 0; }
.form-grid {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 0.75rem;
}
.form-grid label { font-weight: 500; color: #444; }
.form-grid input,
.form-grid select,
.form-grid textarea {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
}
.form-buttons { display: flex; gap: 8px; }
.error { color: #c62828; margin-bottom: 1rem; }
.loading { color: #999; }

/* Buttons */
.btn-primary {
  padding: 6px 18px;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }
.btn-secondary {
  padding: 5px 14px;
  background: #fff;
  color: #42b983;
  border: 1px solid #42b983;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-secondary:hover { background: #f0faf5; }
.btn-danger {
  padding: 5px 14px;
  background: #fff;
  color: #e53935;
  border: 1px solid #e53935;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-danger:hover { background: #ffebee; }
.btn-danger-sm {
  padding: 3px 10px;
  background: #fff;
  color: #e53935;
  border: 1px solid #e53935;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-danger-sm:hover { background: #ffebee; }
.btn-sm {
  padding: 3px 10px;
  font-size: 0.8rem;
  border: 1px solid #aaa;
  border-radius: 3px;
  cursor: pointer;
  background: #fff;
}
.btn-sm:hover { background: #f5f5f5; }
.btn-sm-danger { border-color: #e57373; color: #e53935; }
.btn-sm-danger:hover { background: #ffebee; }
</style>
