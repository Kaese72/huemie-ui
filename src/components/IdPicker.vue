<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import axios from 'axios'

// IdPicker is a form field for a device or group ID. It shows the selected
// item's name, and clicking it opens a dialog where you search by name and
// click a result to select it. v-model is the numeric ID (or null).
const props = defineProps({
  modelValue: { type: Number, default: null },
  kind: { type: String, default: 'device', validator: v => v === 'device' || v === 'group' },
  // compact matches the small inline inputs in rule conditions.
  compact: { type: Boolean, default: false },
  id: { type: String, default: undefined },
})
const emit = defineEmits(['update:modelValue'])

const RESULT_LIMIT = 25
const SEARCH_DEBOUNCE_MS = 200

const endpoint = computed(() => `/device-store/v0/${props.kind}s`)
const kindLabel = computed(() => props.kind === 'group' ? 'group' : 'device')

// The field has a fixed width and cuts long names off, so the tooltip shows
// the whole thing.
const tooltip = computed(() => {
  if (props.modelValue == null) return `Choose ${kindLabel.value}`
  if (selectedName.value) return `#${props.modelValue} ${selectedName.value}`
  if (selectedMissing.value) return `#${props.modelValue} Unknown ${kindLabel.value}`
  return `#${props.modelValue}`
})

// ── Selected item's name ─────────────────────────────────────────────────────

const selectedName = ref(null)
const selectedMissing = ref(false)

async function resolveSelected() {
  selectedName.value = null
  selectedMissing.value = false
  if (props.modelValue == null) return
  const id = props.modelValue
  const kind = props.kind
  try {
    const response = await axios.get(`${endpoint.value}/${id}`)
    // Ignore a stale answer if the value changed while it was in flight.
    if (props.modelValue === id && props.kind === kind) selectedName.value = response.data.name
  } catch {
    if (props.modelValue === id && props.kind === kind) selectedMissing.value = true
  }
}

watch(() => [props.modelValue, props.kind], resolveSelected, { immediate: true })

// ── Search dialog ────────────────────────────────────────────────────────────

const open = ref(false)
const query = ref('')
const results = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref(null)
const highlighted = ref(0)
const searchInput = ref(null)
const resultList = ref(null)
let debounceTimer = null
let searchSeq = 0

function openDialog() {
  open.value = true
  query.value = ''
  highlighted.value = 0
  search()
  nextTick(() => searchInput.value?.focus())
}

function closeDialog() {
  open.value = false
  clearTimeout(debounceTimer)
}

async function search() {
  const seq = ++searchSeq
  loading.value = true
  const params = {
    limit: RESULT_LIMIT,
    sort: JSON.stringify([{ field: 'name', direction: 'asc' }]),
  }
  const text = query.value.trim()
  if (text) params.filters = JSON.stringify([{ field: 'name', operator: 'text-contains', value: text }])
  try {
    const response = await axios.get(endpoint.value, { params })
    if (seq !== searchSeq) return
    results.value = response.data || []
    const totalHeader = response.headers['x-total-count']
    total.value = totalHeader != null ? parseInt(totalHeader, 10) : results.value.length
    error.value = null
    highlighted.value = 0
  } catch (err) {
    if (seq !== searchSeq) return
    results.value = []
    total.value = 0
    error.value = err
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS)
})

onUnmounted(() => clearTimeout(debounceTimer))

function select(item) {
  selectedName.value = item.name
  selectedMissing.value = false
  emit('update:modelValue', item.id)
  closeDialog()
}

function moveHighlight(delta) {
  if (!results.value.length) return
  const count = results.value.length
  highlighted.value = (highlighted.value + delta + count) % count
  nextTick(() => {
    resultList.value?.children[highlighted.value]?.scrollIntoView({ block: 'nearest' })
  })
}

function onSearchKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveHighlight(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveHighlight(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const item = results.value[highlighted.value]
    if (item) select(item)
  } else if (event.key === 'Escape') {
    closeDialog()
  }
}
</script>

<template>
  <button
    :id="id"
    type="button"
    class="id-picker"
    :class="{ 'id-picker--compact': compact }"
    :title="tooltip"
    @click="openDialog"
  >
    <span v-if="modelValue == null" class="id-picker-text id-picker-placeholder">Choose {{ kindLabel }}…</span>
    <template v-else>
      <span class="mono id-picker-id">#{{ modelValue }}</span>
      <span v-if="selectedName" class="id-picker-text id-picker-name">{{ selectedName }}</span>
      <span v-else-if="selectedMissing" class="id-picker-text id-picker-missing">Unknown {{ kindLabel }}</span>
    </template>
    <svg class="id-picker-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" />
    </svg>
  </button>

  <!-- Teleported so the backdrop covers the whole app, as CapabilityDialog does. -->
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="closeDialog" @keydown.esc="closeDialog">
      <div class="dialog id-picker-dialog" role="dialog" aria-modal="true" :aria-label="`Choose ${kindLabel}`">
        <div class="dialog-head">
          <h3 class="dialog-title">Choose {{ kindLabel }}</h3>
          <button class="icon-btn" title="Close" aria-label="Close" @click="closeDialog">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <input
          ref="searchInput"
          v-model="query"
          type="search"
          class="input"
          :placeholder="`Search ${kindLabel}s by name`"
          autocomplete="off"
          @keydown="onSearchKeydown"
        />

        <div class="id-picker-results">
          <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
          <p v-else-if="!results.length" class="empty">
            {{ loading ? 'Searching…' : (query.trim() ? `No ${kindLabel}s match "${query.trim()}".` : `No ${kindLabel}s yet.`) }}
          </p>
          <ul v-else ref="resultList" class="id-picker-list" role="listbox">
            <li
              v-for="(item, index) in results"
              :key="item.id"
              role="option"
              :aria-selected="item.id === modelValue"
              class="id-picker-option"
              :class="{
                'id-picker-option--highlighted': index === highlighted,
                'id-picker-option--selected': item.id === modelValue,
              }"
              @click="select(item)"
              @mouseenter="highlighted = index"
            >
              <span class="id-picker-option-name">{{ item.name || '(unnamed)' }}</span>
              <span class="mono">#{{ item.id }}</span>
            </li>
          </ul>
        </div>

        <p v-if="total > results.length" class="hint id-picker-more">
          Showing {{ results.length }} of {{ total }}. Type more to narrow it down.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.id-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  max-width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  padding: 7px 11px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--text);
  cursor: pointer;
}
.id-picker:hover {
  border-color: color-mix(in srgb, var(--ink) 24%, transparent);
}
.id-picker:focus-visible {
  outline: none;
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 22%, transparent);
}
.id-picker--compact {
  font-size: 0.85rem;
  padding: 3px 8px;
  border-radius: 8px;
  gap: 6px;
  width: 180px;
}
.id-picker-id {
  flex-shrink: 0;
}
/* Fills the space between the ID and the icon; cut off when too long. */
.id-picker-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.id-picker-name {
  font-weight: 600;
}
.id-picker-placeholder,
.id-picker-missing {
  color: var(--faint);
}
.id-picker-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-left: auto;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.id-picker-dialog {
  width: 460px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.dialog-head .dialog-title {
  margin: 0;
}
.id-picker-results {
  margin-top: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.id-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.id-picker-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  cursor: pointer;
}
.id-picker-option--highlighted {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
/* The current value reads like a selected table row: green bar and tint. */
.id-picker-option--selected {
  background: color-mix(in srgb, var(--green) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--green);
}
.id-picker-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.id-picker-more {
  margin: 10px 0 0;
}
</style>
