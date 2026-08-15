<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

// type: 'id' filters the device id field (always uses the backend's `in`
// operator, so a single id or a comma-separated list both work).
// type: 'name' filters the device's own name field with a plain
// contains/equals text comparison (no type selector, unlike 'attribute').
// type: 'attribute' filters a device attribute; `stats` (from
// GET /device-store/v0/attributes/statistics) tells us which of the three
// possible types (boolean/numeric/text) actually occur for this attribute,
// so we only offer types that exist and preselect the most common one.
const props = defineProps({
  type: { type: String, required: true },
  stats: { type: Object, default: null },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['apply', 'clear'])

const TYPE_OPTIONS = [
  { type: 'boolean', statKey: 'n-boolean', label: 'Boolean' },
  { type: 'numeric', statKey: 'n-numeric', label: 'Numeric' },
  { type: 'text', statKey: 'n-text', label: 'Text' },
]

const NUMERIC_OPERATORS = [
  { op: 'numeric-eq', label: '=' },
  { op: 'numeric-aeq', label: '≈' },
  { op: 'numeric-lt', label: '<' },
  { op: 'numeric-gt', label: '>' },
]

// "contains" (case-insensitive substring) is the more useful default for
// free-text attributes; exact match is still available.
const TEXT_OPERATORS = [
  { op: 'text-contains', label: 'contains' },
  { op: 'text-eq', label: 'equals' },
]

// Only types with at least one device set to them are selectable. If none
// have any (e.g. a brand-new attribute), fall back to offering all three
// rather than leaving the user with nothing to pick.
const availableTypes = computed(() => {
  if (props.type !== 'attribute') return []
  if (!props.stats) return TYPE_OPTIONS
  const withCounts = TYPE_OPTIONS.map(t => ({ ...t, count: props.stats[t.statKey] || 0 }))
  const present = withCounts.filter(t => t.count > 0)
  return present.length > 0 ? present : withCounts
})

const defaultType = computed(() => {
  const sorted = [...availableTypes.value].sort((a, b) => (b.count || 0) - (a.count || 0))
  return sorted[0]?.type || 'text'
})

const open = ref(false)
const buttonRef = ref(null)
const popoverRef = ref(null)
const popoverStyle = ref({})

const idValue = ref('')
const selectedType = ref('text')
const userSelectedType = ref(false)
const booleanValue = ref(true)
const selectedOperator = ref('numeric-eq')
const selectedTextOperator = ref('text-contains')
const numericValue = ref('')
const textValue = ref('')

function onTypeChange() {
  userSelectedType.value = true
  selectedOperator.value = 'numeric-eq'
  selectedTextOperator.value = 'text-contains'
}

function positionPopover() {
  const rect = buttonRef.value.getBoundingClientRect()
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(4, rect.left - 180)}px`,
  }
}

function handleOutsideClick(event) {
  if (popoverRef.value && popoverRef.value.contains(event.target)) return
  if (buttonRef.value && buttonRef.value.contains(event.target)) return
  close()
}

function handleKeydown(event) {
  if (event.key === 'Escape') close()
}

function togglePopover() {
  if (open.value) {
    close()
    return
  }
  if (!userSelectedType.value) {
    selectedType.value = defaultType.value
  }
  positionPopover()
  open.value = true
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
  document.addEventListener('mousedown', handleOutsideClick)
  document.addEventListener('keydown', handleKeydown)
}

function close() {
  if (!open.value) return
  open.value = false
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
  document.removeEventListener('mousedown', handleOutsideClick)
  document.removeEventListener('keydown', handleKeydown)
}

onBeforeUnmount(close)

function buildFilter() {
  if (props.type === 'id') {
    const trimmed = idValue.value.trim()
    if (!trimmed) return null
    return { op: 'in', value: trimmed }
  }
  if (props.type === 'name') {
    const trimmed = textValue.value.trim()
    if (!trimmed) return null
    return { op: selectedTextOperator.value, value: trimmed }
  }
  if (selectedType.value === 'boolean') {
    return { op: 'bool-eq', value: booleanValue.value ? 'true' : 'false' }
  }
  if (selectedType.value === 'numeric') {
    if (numericValue.value === '' || numericValue.value === null) return null
    return { op: selectedOperator.value, value: String(numericValue.value) }
  }
  const trimmed = textValue.value.trim()
  if (!trimmed) return null
  return { op: selectedTextOperator.value, value: trimmed }
}

function apply() {
  const filter = buildFilter()
  if (!filter) return
  emit('apply', filter)
  close()
}

function clear() {
  idValue.value = ''
  numericValue.value = ''
  textValue.value = ''
  booleanValue.value = true
  selectedTextOperator.value = 'text-contains'
  userSelectedType.value = false
  emit('clear')
  close()
}
</script>

<template>
  <div class="column-filter">
    <button
      ref="buttonRef"
      type="button"
      class="filter-btn"
      :class="{ active }"
      :title="active ? 'Filter applied — click to edit' : 'Filter this column'"
      @click.stop="togglePopover"
    >
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
        <path d="M1 2h14l-5.5 6.7V14l-3-1.6V8.7z" fill="currentColor" />
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="open" ref="popoverRef" class="filter-popover" :style="popoverStyle" @click.stop>
        <template v-if="type === 'id'">
          <label class="field-label">ID (or comma-separated list)</label>
          <input v-model="idValue" type="text" placeholder="e.g. 3 or 3,4,5" class="filter-input" @keydown.enter="apply" />
        </template>
        <template v-else-if="type === 'name'">
          <label class="field-label">Comparison</label>
          <select v-model="selectedTextOperator" class="filter-select">
            <option v-for="o in TEXT_OPERATORS" :key="o.op" :value="o.op">{{ o.label }}</option>
          </select>
          <label class="field-label">Value</label>
          <input v-model="textValue" type="text" class="filter-input" @keydown.enter="apply" />
        </template>
        <template v-else>
          <label class="field-label">Type</label>
          <select v-model="selectedType" class="filter-select" @change="onTypeChange">
            <option v-for="t in availableTypes" :key="t.type" :value="t.type">{{ t.label }}</option>
          </select>

          <template v-if="selectedType === 'boolean'">
            <label class="field-label">Value</label>
            <select v-model="booleanValue" class="filter-select">
              <option :value="true">true</option>
              <option :value="false">false</option>
            </select>
          </template>

          <template v-else-if="selectedType === 'numeric'">
            <label class="field-label">Comparison</label>
            <select v-model="selectedOperator" class="filter-select">
              <option v-for="o in NUMERIC_OPERATORS" :key="o.op" :value="o.op">{{ o.label }}</option>
            </select>
            <label class="field-label">Value</label>
            <input v-model="numericValue" type="number" step="any" class="filter-input" @keydown.enter="apply" />
          </template>

          <template v-else>
            <label class="field-label">Comparison</label>
            <select v-model="selectedTextOperator" class="filter-select">
              <option v-for="o in TEXT_OPERATORS" :key="o.op" :value="o.op">{{ o.label }}</option>
            </select>
            <label class="field-label">Value</label>
            <input v-model="textValue" type="text" class="filter-input" @keydown.enter="apply" />
          </template>
        </template>

        <div class="popover-actions">
          <button type="button" class="btn btn-clear" :disabled="!active" @click="clear">Clear</button>
          <button type="button" class="btn btn-apply" @click="apply">Apply</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.column-filter {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.filter-btn {
  background: none;
  border: none;
  padding: 3px;
  margin: 0;
  cursor: pointer;
  color: #333;
  opacity: 0.35;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: opacity 0.15s, background 0.15s;
}
.filter-btn:hover {
  opacity: 0.8;
  background: rgba(0, 0, 0, 0.06);
}
.filter-btn.active {
  opacity: 1;
  color: #1890ff;
}
.filter-popover {
  z-index: 2000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 220px;
  font-weight: normal;
  font-size: 0.85rem;
}
.field-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
}
.filter-input,
.filter-select {
  padding: 0.35rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: inherit;
}
.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.btn {
  padding: 0.3rem 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}
.btn-apply {
  background: #42b983;
  color: white;
}
.btn-apply:hover {
  background: #369870;
}
.btn-clear {
  background: #f5f5f5;
  color: #333;
}
.btn-clear:hover:not(:disabled) {
  background: #e0e0e0;
}
.btn-clear:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
