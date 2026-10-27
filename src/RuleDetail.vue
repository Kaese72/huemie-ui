<script setup>
import { ref, watch, onMounted, onUnmounted, provide, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import ConditionNode from './components/ConditionNode.vue'
import { localTimezone } from './composables/useTimezones.js'
import { useConditionDrag, applySwap, applyMoveToSlot } from './composables/useConditionDrag.js'

const route = useRoute()
const router = useRouter()
const emit = defineEmits(['created', 'updated', 'deleted'])

// The same view creates rules (route RuleNew) and edits existing ones (route RuleDetail).
// A new rule only exists locally until the first save, which POSTs everything at once.
const isNew = computed(() => route.name === 'RuleNew')

const rule = ref(null)
const error = ref(null)
const saving = ref(false)

// Editable copies
const editName = ref('')
const editEnabled = ref(false)
const editConditionTree = ref(null)

// ── Undo history (resets on save) ────────────────────────────────────────────
const undoStack = ref([])

// Sentinel used instead of null so we can distinguish "no snapshot" from "snapshot is null tree"
const SNAP_EMPTY = Symbol()
let historySnapshot = SNAP_EMPTY   // state captured at the START of the current edit batch
let historyTimer = null
let skipNextHistory = false        // set before programmatic tree assignments to suppress the watcher

// Called before any programmatic tree change that already handles history itself.
function suppressNextHistory() {
  skipNextHistory = true
}

// Flush any pending debounced snapshot immediately (used before drag-drop commits).
function flushHistorySnapshot() {
  clearTimeout(historyTimer)
  if (historySnapshot !== SNAP_EMPTY) {
    undoStack.value.push(historySnapshot)
    historySnapshot = SNAP_EMPTY
  }
}

function undo() {
  clearTimeout(historyTimer)
  // If there are uncommitted (debounced) edits, roll back to before those first.
  if (historySnapshot !== SNAP_EMPTY) {
    const target = historySnapshot
    historySnapshot = SNAP_EMPTY
    suppressNextHistory()
    editConditionTree.value = target
    return
  }
  if (undoStack.value.length === 0) return
  suppressNextHistory()
  editConditionTree.value = undoStack.value.pop()
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
}

// Watch every change to the tree. Debounce so rapid keystrokes are one undo step.
watch(editConditionTree, (newVal, oldVal) => {
  if (skipNextHistory) {
    skipNextHistory = false
    return
  }
  // Capture the state at the beginning of an edit batch (before any changes).
  if (historySnapshot === SNAP_EMPTY) {
    historySnapshot = oldVal !== null ? JSON.parse(JSON.stringify(oldVal)) : null
  }
  clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    undoStack.value.push(historySnapshot)
    historySnapshot = SNAP_EMPTY
  }, 400)
})

// ── Drag & drop ───────────────────────────────────────────────────────────────
const dragCtx = useConditionDrag()

function onDragStart(path, rect) {
  dragCtx.startDrag(path, rect)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'

  function onMouseMove(e) {
    dragCtx.updateMouse(e.clientX, e.clientY)
  }
  function onMouseUp() {
    dragCtx.endDrag()
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function commitDrop(targetPath, action) {
  if (!dragCtx.sourcePath.value) return
  const src = dragCtx.sourcePath.value
  let newTree
  if (action === 'swap') {
    newTree = applySwap(editConditionTree.value, src, targetPath)
  } else if (action === 'and') {
    newTree = applyMoveToSlot(editConditionTree.value, src, targetPath, 'and')
  } else if (action === 'or') {
    newTree = applyMoveToSlot(editConditionTree.value, src, targetPath, 'or')
  }
  if (newTree) {
    flushHistorySnapshot()  // commit any pending debounced edits first
    undoStack.value.push(JSON.parse(JSON.stringify(editConditionTree.value)))
    suppressNextHistory()
    editConditionTree.value = newTree
  }
  dragCtx.endDrag()
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

// Arrow overlay: source center → current mouse position
const arrowVisible = computed(() => dragCtx.isDragging.value && dragCtx.sourceRect.value)
const arrowX1 = computed(() => (dragCtx.sourceRect.value?.left ?? 0) + (dragCtx.sourceRect.value?.width ?? 0) / 2)
const arrowY1 = computed(() => (dragCtx.sourceRect.value?.top ?? 0) + (dragCtx.sourceRect.value?.height ?? 0) / 2)
const arrowX2 = computed(() => dragCtx.mouseX.value)
const arrowY2 = computed(() => dragCtx.mouseY.value)

provide('conditionDrag', {
  isDragging:        dragCtx.isDragging,
  sourcePath:        dragCtx.sourcePath,
  hoveredTargetPath: dragCtx.hoveredTargetPath,
  hoveredAction:     dragCtx.hoveredAction,
  setHover:          dragCtx.setHover,
  clearHover:        dragCtx.clearHover,
  isSource:          dragCtx.isSource,
  isDescendantOfSource: dragCtx.isDescendantOfSource,
  isAncestorOfSource:   dragCtx.isAncestorOfSource,
  onDragStart,
  commitDrop,
})

// Evaluate state
const evaluating = ref(false)
const evalResult = ref(null) // { result: bool, reason?: string } | null

async function evaluateRule() {
  if (!rule.value) return
  evaluating.value = true
  evalResult.value = null
  try {
    // An unsaved rule has nothing stored to evaluate, so test the tree being edited instead.
    const res = isNew.value
      ? await axios.post('/ittt-orchestrator/v0/evaluate', {
          rule: { name: editName.value, enabled: editEnabled.value, 'condition-tree': editConditionTree.value },
        })
      : await axios.get(`/ittt-orchestrator/v0/rules/${rule.value.id}/evaluate`)
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
const editingAction = ref(null) // { index, type, id, capability, args }; index is null for a new action

onMounted(() => {
  fetchRule()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(historyTimer)
})
watch(() => `${String(route.name)}/${route.params.id ?? ''}`, fetchRule)

async function fetchRule() {
  error.value = null
  evalResult.value = null
  cancelActionForm()
  if (isNew.value) {
    applyRule({ name: 'New rule', enabled: false, actions: [] })
    return
  }
  if (!route.params.id) return
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
  clearTimeout(historyTimer)
  historySnapshot = SNAP_EMPTY
  undoStack.value = []
  suppressNextHistory()
  editConditionTree.value = data['condition-tree']
    ? JSON.parse(JSON.stringify(data['condition-tree']))
    : null
  actions.value = data.actions ? JSON.parse(JSON.stringify(data.actions)) : []
}

function addRootCondition() {
  editConditionTree.value = { condition: { type: 'time-range', from: '06:00:00', to: '22:00:00', timezone: localTimezone.value }, and: null, or: null }
}

function removeRootCondition() {
  editConditionTree.value = null
}

async function saveRule() {
  if (!rule.value) return
  saving.value = true
  const body = {
    name: editName.value,
    enabled: editEnabled.value,
    'condition-tree': editConditionTree.value ?? undefined,
    actions: actions.value.map(({ type, id, capability, args }) => ({ type, id, capability, args })),
  }
  try {
    if (isNew.value) {
      const res = await axios.post('/ittt-orchestrator/v0/rules', body)
      emit('created', res.data)
      return
    }
    const res = await axios.put(`/ittt-orchestrator/v0/rules/${rule.value.id}`, body)
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
  editingAction.value = { index: null, type: 'device-capability', id: 1, capability: '', args: '' }
  showActionForm.value = true
}

function openEditActionForm(action, index) {
  editingAction.value = {
    index,
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

// Actions are edited locally and persisted together with the rule by saveRule().
function applyAction() {
  if (!editingAction.value) return
  const action = {
    type: editingAction.value.type,
    id: editingAction.value.id,
    capability: editingAction.value.capability,
    args: parseArgs(editingAction.value.args),
  }
  if (editingAction.value.index !== null) {
    actions.value.splice(editingAction.value.index, 1, action)
  } else {
    actions.value.push(action)
  }
  cancelActionForm()
}

function removeAction(index) {
  actions.value.splice(index, 1)
  if (editingAction.value?.index === index) cancelActionForm()
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
  <p v-else-if="!rule" class="empty">Loading…</p>
  <div v-else class="rule-detail">

    <div class="detail-head">
      <h2 class="detail-title">{{ isNew ? 'New rule' : rule.name }}</h2>
      <button v-if="!isNew" class="btn btn-danger btn-sm" @click="deleteRule">Delete rule</button>
    </div>
    <div v-if="!isNew" class="detail-meta">
      <span><strong>ID</strong> <span class="mono">{{ rule.id }}</span></span>
    </div>

    <!-- ── Basic fields ── -->
    <section class="section">
      <div class="field-row">
        <label class="field-label" for="rule-name">Name</label>
        <input id="rule-name" v-model="editName" type="text" class="input input-sm name-input" />
      </div>
      <div class="field-row">
        <label class="field-label" for="rule-enabled">Enabled</label>
        <input id="rule-enabled" v-model="editEnabled" type="checkbox" class="enabled-check" />
      </div>
      <div v-if="!isNew" class="field-row">
        <span class="field-label">Next occurrence</span>
        <span class="field-value">{{ rule['next-occurence'] ? new Date(rule['next-occurence']).toLocaleString(undefined, { timeZoneName: 'short' }) : '—' }}</span>
      </div>
      <div v-if="rule['cooldown-until']" class="field-row">
        <span class="field-label">Cooldown until</span>
        <span class="field-value">
          {{ new Date(rule['cooldown-until']).toLocaleString(undefined, { timeZoneName: 'short' }) }}
          <span v-if="new Date(rule['cooldown-until']) > new Date()" class="badge badge-neutral">Cooling down</span>
        </span>
      </div>
    </section>

    <!-- ── Condition tree ── -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title"><span class="when">When</span> Conditions</h3>
        <button v-if="!editConditionTree" class="btn btn-ghost btn-sm" @click="addRootCondition">
          Add condition
        </button>
        <button v-else class="btn btn-danger btn-sm" @click="removeRootCondition">
          Clear all
        </button>
      </div>
      <div v-if="editConditionTree" class="tree-container">
        <ConditionNode
          :node="editConditionTree"
          :isRoot="true"
          :path="[]"
          @update="editConditionTree = $event"
        />
      </div>
      <p v-else class="hint">No conditions — the rule will never trigger.</p>
    </section>

    <!-- ── Save / Test row ── -->
    <div class="save-row">
      <button class="btn btn-primary" @click="saveRule" :disabled="saving">
        {{ saving ? 'Saving…' : (isNew ? 'Create rule' : 'Save rule') }}
      </button>
      <button class="btn btn-ghost" @click="evaluateRule" :disabled="evaluating || (isNew && !editConditionTree)">
        {{ evaluating ? 'Testing…' : 'Test now' }}
      </button>
      <span v-if="evalResult !== null" class="eval-result">
        <span class="badge" :class="evalResult.result ? 'badge-green' : 'badge-danger'">
          {{ evalResult.result ? 'Matches' : 'No match' }}
        </span>
        <span v-if="!evalResult.result && evalResult.reason" class="eval-reason">{{ evalResult.reason }}</span>
        <span v-if="evalResult['next-occurrence']" class="eval-next">Next: {{ new Date(evalResult['next-occurrence']).toLocaleString(undefined, { timeZoneName: 'short' }) }}</span>
      </span>
    </div>

    <!-- ── Actions ── -->
    <section class="section">
      <div class="section-header">
        <h3 class="section-title"><span class="then">Do</span> Actions</h3>
        <button v-if="!showActionForm" class="btn btn-ghost btn-sm" @click="openNewActionForm">
          Add action
        </button>
      </div>

      <p v-if="actions.length === 0 && !showActionForm" class="hint">
        No actions configured.
      </p>
      <p v-else class="hint">Action changes are stored when you save the rule.</p>

      <table v-if="actions.length > 0" class="data-table actions-table">
        <thead>
          <tr>
            <th></th>
            <th>Type</th>
            <th>Target ID</th>
            <th>Capability</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(action, index) in actions" :key="index">
            <td class="out-cell">
              <svg class="out-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </td>
            <td>{{ action.type }}</td>
            <td class="mono">{{ action.id }}</td>
            <td>{{ action.capability }}</td>
            <td class="actions">
              <button class="btn btn-ghost btn-sm" @click="openEditActionForm(action, index)">Edit</button>
              <button class="btn btn-danger btn-sm" @click="removeAction(index)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Inline action form -->
      <div v-if="showActionForm && editingAction" class="action-form">
        <h4 class="action-form-title">{{ editingAction.index !== null ? 'Edit action' : 'New action' }}</h4>
        <div class="form-grid">
          <label for="action-type">Type</label>
          <select id="action-type" v-model="editingAction.type" class="input input-sm">
            <option value="device-capability">device-capability</option>
            <option value="group-capability">group-capability</option>
          </select>

          <label for="action-target">Target ID</label>
          <input id="action-target" type="number" v-model.number="editingAction.id" min="1" class="input input-sm" />

          <label for="action-capability">Capability</label>
          <input id="action-capability" type="text" v-model="editingAction.capability" placeholder="e.g. activate" class="input input-sm" />

          <label for="action-args">Args (JSON)</label>
          <textarea id="action-args" v-model="editingAction.args" rows="3" placeholder='e.g. {"brightness": 100}' class="input input-sm mono-input"></textarea>
        </div>
        <div class="form-buttons">
          <button class="btn btn-ghost btn-sm" @click="cancelActionForm">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="applyAction">{{ editingAction.index !== null ? 'Update action' : 'Add action' }}</button>
        </div>
      </div>
    </section>

  </div>

  <!-- Drag arrow overlay — teleported to body so it renders above everything -->
  <Teleport to="body">
    <svg
      v-if="arrowVisible"
      class="drag-arrow-svg"
    >
      <defs>
        <marker id="da-head" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" class="drag-arrow-head" />
        </marker>
      </defs>
      <line
        :x1="arrowX1" :y1="arrowY1"
        :x2="arrowX2" :y2="arrowY2"
        class="drag-arrow-line"
        stroke-width="2"
        stroke-dasharray="6 3"
        marker-end="url(#da-head)"
      />
    </svg>
  </Teleport>
</template>

<style scoped>
.rule-detail {
  display: flex;
  flex-direction: column;
}
.section {
  margin-bottom: 24px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  /* As tall as a .btn-sm, so the section doesn't jump when its button is hidden. */
  min-height: calc(0.85rem * 1.2 + 14px);
}
.section-header .section-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
/* "When … Do …": the rule reads as a sentence. Conditions are what the
   Appliance reads in (green), actions what it sends out (amber). */
.when,
.then {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
}
.when {
  color: var(--green-ink);
  background: color-mix(in srgb, var(--green) 14%, transparent);
}
.then {
  color: var(--warm-ink);
  background: color-mix(in srgb, var(--warm) 15%, transparent);
}
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.field-label {
  width: 130px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  flex-shrink: 0;
}
.name-input {
  flex: 1;
  max-width: 340px;
}
.enabled-check {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.field-value {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.92rem;
}
.tree-container {
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: 16px;
  padding: 12px;
  background: color-mix(in srgb, var(--ink) 2.5%, transparent);
}
.save-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.eval-result {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.88rem;
}
.eval-reason {
  color: var(--muted);
}
.eval-next {
  color: var(--faint);
  font-size: 0.85rem;
}
.out-cell {
  width: 18px;
  padding-right: 0;
}
.out-arrow {
  display: block;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--warm);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.actions-table .actions .btn + .btn {
  margin-left: 6px;
}
.action-form {
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 16px;
  padding: 16px;
  background: color-mix(in srgb, var(--ink) 3%, transparent);
  margin-top: 12px;
}
.action-form-title {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 700;
}
.form-grid {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 14px;
}
.form-grid label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
}
.mono-input {
  font-family: ui-monospace, 'Cascadia Code', 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.85rem;
}
.form-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Drag arrow — fixed, full-viewport, non-interactive */
:global(.drag-arrow-svg) {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  overflow: visible;
}
:global(.drag-arrow-line) {
  stroke: var(--green);
}
:global(.drag-arrow-head) {
  fill: var(--green);
}
</style>
