<script setup>
// TableHeaderCell renders one <div class="table-cell header-cell"> and owns
// the combined ordering/filtering dialog for that column. It replaces the
// old design where clicking the header cycled sort directly and a small
// funnel button in the corner opened a separate apply/clear filter popover:
// now the whole cell is one click target that opens a single dialog with
// "Ordering" and "Filtering" clearly separated, filtering has no
// apply/clear buttons to press (typing/choosing a value debounces to an
// automatic apply, an emptied value auto-clears the same way), and a status
// symbol next to "Filtering" shows not-yet-applied/applying/applied for the
// in-flight edit. Sorting stays immediate (radio choice -> emit right away)
// since there's nothing to debounce there.
//
// This component is deliberately long-lived: TableShell mounts one instance
// per column for the life of the table (not re-created each time its
// dialog opens/closes), so its own filter-field state - and the debounce/
// status state machine below - survives across page changes and the
// dialog being closed and reopened.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  col: { type: Object, required: true },
  sort: { type: Object, default: null }, // { field, direction } | null - the table's current sort
  filterValue: { type: Object, default: null }, // { op, value } | null - this column's current applied filter
  stats: { type: Object, default: null }, // attribute stats, only used for filter.type === 'attribute'
  loading: { type: Boolean, default: false }, // true while any fetch this table triggered is in flight
})

const emit = defineEmits(['sort-change', 'filter-apply', 'filter-clear', 'min-width-computed', 'resize-column'])

const DEBOUNCE_MS = 400

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
// free-text columns; exact match is still available. col.filter.operators
// restricts this down, e.g. to just "equals" for an enum column.
const ALL_TEXT_OPERATORS = [
  { op: 'text-contains', label: 'contains' },
  { op: 'text-eq', label: 'equals' },
]

const DATE_OPERATORS = [
  { op: 'date-eq', label: 'on' },
  { op: 'date-lt', label: 'before' },
  { op: 'date-gt', label: 'after' },
]

const hasFilter = computed(() => !!props.col.filter)
const filterType = computed(() => props.col.filter?.type)
const clickable = computed(() => hasFilter.value || !!props.col.sortable)

// All the choice pickers below (attribute type, and each type's
// "Comparison" operator) render as a row of toggle buttons rather than a
// <select> - options that don't apply are kept visible but greyed out
// (disabled) rather than hidden, so e.g. a boolean-only attribute still
// shows Numeric/Text, just not selectable, and the applicable one is
// pre-selected.

// col.filter.operators, when given, restricts which comparisons a column
// offers (e.g. a 2-value enum column only makes sense with "equals" - see
// chatbot's status/initiative columns): the rest stay visible but disabled.
const textOperatorChoices = computed(() => {
  const allowed = props.col.filter?.operators
  return ALL_TEXT_OPERATORS.map(o => ({ ...o, enabled: !allowed || allowed.includes(o.op) }))
})

// Numeric/date comparisons have no such restriction mechanism today - every
// option is always enabled - but they still render as the same toggle-group
// so all three pickers (type/text-op/numeric-op/date-op) look and behave
// alike.
const numericOperatorChoices = computed(() => NUMERIC_OPERATORS.map(o => ({ ...o, enabled: true })))
const dateOperatorChoices = computed(() => DATE_OPERATORS.map(o => ({ ...o, enabled: true })))

// Only types with at least one device set to them are enabled/selectable.
// If none have any (e.g. a brand-new attribute with no stats yet), don't
// grey anything out - we simply don't know yet, so offer all three equally
// rather than leaving the user with nothing to pick.
const typeChoices = computed(() => {
  if (filterType.value !== 'attribute') return []
  const withCounts = TYPE_OPTIONS.map(t => ({ ...t, count: props.stats?.[t.statKey] || 0 }))
  const anyKnown = withCounts.some(t => t.count > 0)
  return withCounts.map(t => ({ ...t, enabled: !anyKnown || t.count > 0 }))
})

const defaultType = computed(() => {
  const enabledChoices = typeChoices.value.filter(t => t.enabled)
  const sorted = [...enabledChoices].sort((a, b) => (b.count || 0) - (a.count || 0))
  return sorted[0]?.type || 'text'
})

function defaultTextOperator() {
  return textOperatorChoices.value.find(o => o.enabled)?.op || 'text-contains'
}

// --- Sort (immediate, no debounce/status - there's nothing to wait on) ---

const sortDirection = computed(() => (
  props.sort && props.sort.field === props.col.key ? props.sort.direction : null
))
const sortBadge = computed(() => (
  sortDirection.value === 'asc' ? '▲' : sortDirection.value === 'desc' ? '▼' : ''
))

function setSort(direction) {
  emit('sort-change', direction ? { field: props.col.key, direction } : null)
}

// --- Filter field state ---

const idValue = ref('')
const selectedType = ref('text')
const userSelectedType = ref(false)
// null = neither True nor False picked yet (empty - no filter); true/false
// once one of the two toggle buttons is clicked. Clicking the already-active
// one toggles it back to null.
const booleanValue = ref(null)
const selectedOperator = ref('numeric-eq')
const selectedTextOperator = ref(defaultTextOperator())
const numericValue = ref('')
const textValue = ref('')
const selectedDateOperator = ref('date-eq')
const dateValue = ref('')

function selectType(choice) {
  if (!choice.enabled) return
  userSelectedType.value = true
  selectedType.value = choice.type
  selectedOperator.value = 'numeric-eq'
  selectedTextOperator.value = defaultTextOperator()
}

function selectTextOperator(choice) {
  if (!choice.enabled) return
  selectedTextOperator.value = choice.op
}

function selectNumericOperator(choice) {
  selectedOperator.value = choice.op
}

function selectDateOperator(choice) {
  selectedDateOperator.value = choice.op
}

function setBoolean(val) {
  booleanValue.value = booleanValue.value === val ? null : val
}

function clearFields() {
  idValue.value = ''
  numericValue.value = ''
  textValue.value = ''
  booleanValue.value = null
  selectedTextOperator.value = defaultTextOperator()
  dateValue.value = ''
  selectedDateOperator.value = 'date-eq'
  userSelectedType.value = false
}

// ISO -> the value a <input type="datetime-local"> wants (local time,
// truncated to minutes, no timezone/seconds).
function isoToLocalInput(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Populate the fields from an externally-known filter value (on mount, and
// whenever the applied filter changes from outside this component's own
// pending/in-flight edit - see the filterValue watcher below).
function hydrateFields(filter) {
  if (!filter) {
    clearFields()
    return
  }
  if (filterType.value === 'id-list') {
    idValue.value = filter.value
  } else if (filterType.value === 'text') {
    textValue.value = filter.value
    selectedTextOperator.value = filter.op
  } else if (filterType.value === 'boolean') {
    booleanValue.value = filter.value === 'true'
  } else if (filterType.value === 'date') {
    selectedDateOperator.value = filter.op
    dateValue.value = isoToLocalInput(filter.value)
  } else if (filterType.value === 'attribute') {
    userSelectedType.value = true
    if (filter.op === 'bool-eq') {
      selectedType.value = 'boolean'
      booleanValue.value = filter.value === 'true'
    } else if (filter.op.startsWith('numeric-')) {
      selectedType.value = 'numeric'
      selectedOperator.value = filter.op
      numericValue.value = filter.value
    } else {
      selectedType.value = 'text'
      selectedTextOperator.value = filter.op
      textValue.value = filter.value
    }
  }
}

function buildFilter() {
  if (filterType.value === 'id-list') {
    const trimmed = idValue.value.trim()
    if (!trimmed) return null
    return { op: 'in', value: trimmed }
  }
  if (filterType.value === 'text') {
    const trimmed = textValue.value.trim()
    if (!trimmed) return null
    return { op: selectedTextOperator.value, value: trimmed }
  }
  if (filterType.value === 'boolean') {
    if (booleanValue.value === null) return null
    return { op: 'bool-eq', value: booleanValue.value ? 'true' : 'false' }
  }
  if (filterType.value === 'date') {
    if (!dateValue.value) return null
    return { op: selectedDateOperator.value, value: new Date(dateValue.value).toISOString() }
  }
  // attribute
  if (selectedType.value === 'boolean') {
    if (booleanValue.value === null) return null
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

// --- Status: idle -> pending (debounce running) -> applying (debounce
// fired, emitted, waiting for the fetch it triggered to resolve) -> applied
// (that fetch resolved and the filter is still in effect) / idle (resolved
// with no filter in effect, e.g. it was a clear). ---

const applyStatus = ref(props.filterValue ? 'applied' : 'idle')
let debounceTimer = null

function syncFromExternal(filter) {
  hydrateFields(filter)
  applyStatus.value = filter ? 'applied' : 'idle'
}

onMounted(() => syncFromExternal(props.filterValue))
onBeforeUnmount(() => clearTimeout(debounceTimer))

// A prop change we didn't just cause ourselves (e.g. this column's filter
// was restored on load, or cleared some other way) - re-sync. While our own
// edit is pending/in flight, skip: the echo of our own emit shouldn't
// clobber fields the user may already be editing further.
watch(() => props.filterValue, (val) => {
  if (applyStatus.value === 'pending' || applyStatus.value === 'applying') return
  syncFromExternal(val)
})

// Our own emitted apply/clear resolves once the fetch it triggered
// finishes (loading flips true then back to false).
watch(() => props.loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading && applyStatus.value === 'applying') {
    applyStatus.value = props.filterValue ? 'applied' : 'idle'
  }
})

function filtersEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.op === b.op && String(a.value) === String(b.value)
}

// Includes the no-op case on purpose: this also fires right after mount,
// when hydrateFields() assigns the watched refs from the already-applied
// filterValue - without this check that would debounce straight into a
// redundant re-apply of the exact filter that's already in effect.
function scheduleApply() {
  clearTimeout(debounceTimer)
  const filter = buildFilter()
  if (filtersEqual(filter, props.filterValue)) {
    applyStatus.value = props.filterValue ? 'applied' : 'idle'
    return
  }
  applyStatus.value = 'pending'
  debounceTimer = setTimeout(() => {
    applyStatus.value = 'applying'
    if (filter) emit('filter-apply', filter)
    else emit('filter-clear')
  }, DEBOUNCE_MS)
}

// Any field edit reschedules the debounce - typing further keeps pushing
// it out, matching "apply once you stop writing" rather than "apply on
// every keystroke".
watch(
  [idValue, textValue, numericValue, dateValue, booleanValue, selectedType, selectedOperator, selectedTextOperator, selectedDateOperator],
  scheduleApply,
)

// The explicit Clear button (still offered alongside auto-clear-on-empty,
// per feedback that both should exist): resets the fields and clears right
// away, no debounce - it's already a deliberate, discrete action.
function explicitClear() {
  clearTimeout(debounceTimer)
  clearFields()
  if (!props.filterValue) {
    applyStatus.value = 'idle'
    return
  }
  applyStatus.value = 'applying'
  emit('filter-clear')
}

const hasAnyValue = computed(() => !!props.filterValue || applyStatus.value !== 'idle')

const STATUS = {
  idle: { symbol: '–', label: 'Not applied' },
  pending: { symbol: '…', label: 'Waiting for you to stop typing' },
  applying: { symbol: '◐', label: 'Applying…' },
  applied: { symbol: '✓', label: 'Applied' },
}
const statusSymbol = computed(() => STATUS[applyStatus.value].symbol)
const statusLabel = computed(() => STATUS[applyStatus.value].label)

// --- Dialog open/close/position ---

const open = ref(false)
const cellRef = ref(null)
const popoverRef = ref(null)
const popoverStyle = ref({})

function positionPopover() {
  const rect = cellRef.value.getBoundingClientRect()
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(4, Math.min(rect.left, window.innerWidth - 244))}px`,
  }
}

function handleOutsideClick(event) {
  if (popoverRef.value && popoverRef.value.contains(event.target)) return
  close()
}

function handleKeydown(event) {
  if (event.key === 'Escape') close()
}

function onHeaderClick() {
  if (!clickable.value) return
  if (open.value) {
    close()
    return
  }
  if (hasFilter.value && filterType.value === 'attribute' && !userSelectedType.value) {
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

// --- Minimum width (enough to fit the header) + drag-to-resize ---
//
// Neither is persisted anywhere: minWidth is recomputed fresh from the
// rendered header each time this component mounts, and a manual resize only
// lives in TableShell's in-memory columnWidths map for the life of the page.

const labelRef = ref(null)
const actionsRef = ref(null)
const minWidthPx = ref(0)

// Everything here is measured from the real, rendered DOM rather than
// guessed at with hardcoded pixel constants - both because it's more
// accurate and because it then automatically tracks any future change to
// the icons/paddings/gaps below without this needing to be kept in sync
// by hand.
function computeMinWidth() {
  // scrollWidth reflects the label's true, un-clipped text width even
  // though the box itself is overflow:hidden/white-space:nowrap and may
  // currently be rendered narrower (the standard truncation-detection
  // idiom, `scrollWidth > clientWidth`, relies on the same fact) - so this
  // is accurate regardless of whatever width the column happens to have
  // right now.
  const labelWidth = labelRef.value?.scrollWidth || 0
  // .header-actions never shrinks (flex-shrink: 0), so its own offsetWidth
  // is always its true natural size. The resize handle itself isn't
  // included here any more - it's now an absolutely-positioned strip
  // straddling the cell's right border rather than a flex child, so it
  // takes no layout space of its own to budget for.
  const actionsWidth = actionsRef.value?.offsetWidth || 0
  let paddingLeft = 8
  let paddingRight = 8
  let gap = 5
  if (cellRef.value) {
    const style = getComputedStyle(cellRef.value)
    paddingLeft = parseFloat(style.paddingLeft) || paddingLeft
    paddingRight = parseFloat(style.paddingRight) || paddingRight
    gap = parseFloat(style.columnGap) || gap
  }
  // +4px safety margin: the DOM measurements above should already be
  // exact, but a small buffer costs nothing and guards against any
  // sub-pixel/rounding edge case still leaving the hamburger or resize
  // handle visually cramped.
  return Math.ceil(paddingLeft + labelWidth + gap + actionsWidth + paddingRight) + 4
}

onMounted(() => {
  minWidthPx.value = computeMinWidth()
  emit('min-width-computed', minWidthPx.value)
})

// The filter-applied dot only exists in the DOM while a filter is actually
// active, so re-measure when that flips - otherwise a column that starts
// unfiltered would never budget the few extra px the dot needs once one
// gets applied.
watch(() => !!props.filterValue, async () => {
  await nextTick()
  const next = computeMinWidth()
  if (next === minWidthPx.value) return
  minWidthPx.value = next
  emit('min-width-computed', next)
})

function startResize(event) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = cellRef.value.getBoundingClientRect().width
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  function onMove(moveEvent) {
    const next = Math.round(startWidth + (moveEvent.clientX - startX))
    emit('resize-column', Math.max(minWidthPx.value, next))
  }
  function onUp() {
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <div ref="cellRef" class="table-cell header-cell" :class="{ clickable }" @click="onHeaderClick">
    <span ref="labelRef" class="header-label">{{ col.label }}</span>
    <span ref="actionsRef" class="header-actions">
      <span v-if="col.sortable" class="sort-indicator">{{ sortBadge }}</span>
      <span v-if="hasFilter && filterValue" class="filter-dot" title="Filter applied" />
      <span v-if="clickable" class="config-icon" title="Filtering/ordering options" aria-hidden="true">☰</span>
    </span>
    <span
      class="resize-handle"
      title="Drag to resize column"
      @pointerdown.stop="startResize"
      @click.stop
    ><span class="resize-grip">⋮</span></span>
    <Teleport to="body">
      <div v-if="open" ref="popoverRef" class="header-popover" :style="popoverStyle" @click.stop>
        <template v-if="col.sortable">
          <div class="popover-section-title">Ordering</div>
          <label class="radio-row">
            <input type="radio" name="sort" :checked="sortDirection === null" @change="setSort(null)" />
            None
          </label>
          <label class="radio-row">
            <input type="radio" name="sort" :checked="sortDirection === 'asc'" @change="setSort('asc')" />
            Ascending
          </label>
          <label class="radio-row">
            <input type="radio" name="sort" :checked="sortDirection === 'desc'" @change="setSort('desc')" />
            Descending
          </label>
        </template>

        <template v-if="hasFilter">
          <div class="popover-section-title" :class="col.sortable ? 'with-divider' : ''">
            Filtering
            <span class="status-symbol" :class="applyStatus" :title="statusLabel">{{ statusSymbol }}</span>
          </div>

          <template v-if="filterType === 'id-list'">
            <label class="field-label">ID (or comma-separated list)</label>
            <div class="value-field">
              <input v-model="idValue" type="text" placeholder="e.g. 3 or 3,4,5" class="filter-input" />
              <button type="button" class="clear-x" :disabled="!hasAnyValue" title="Clear filter" @click="explicitClear">✕</button>
            </div>
          </template>

          <template v-else-if="filterType === 'text'">
            <label class="field-label">Comparison</label>
            <div class="toggle-group">
              <button
                v-for="o in textOperatorChoices"
                :key="o.op"
                type="button"
                class="toggle-btn"
                :class="{ active: selectedTextOperator === o.op }"
                :disabled="!o.enabled"
                @click="selectTextOperator(o)"
              >{{ o.label }}</button>
            </div>
            <label class="field-label">Value</label>
            <div class="value-field">
              <input v-model="textValue" type="text" class="filter-input" />
              <button type="button" class="clear-x" :disabled="!hasAnyValue" title="Clear filter" @click="explicitClear">✕</button>
            </div>
          </template>

          <template v-else-if="filterType === 'boolean'">
            <label class="field-label">Value</label>
            <div class="toggle-group">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: booleanValue === true }"
                @click="setBoolean(true)"
              >True</button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: booleanValue === false }"
                @click="setBoolean(false)"
              >False</button>
            </div>
          </template>

          <template v-else-if="filterType === 'date'">
            <label class="field-label">Comparison</label>
            <div class="toggle-group">
              <button
                v-for="o in dateOperatorChoices"
                :key="o.op"
                type="button"
                class="toggle-btn"
                :class="{ active: selectedDateOperator === o.op }"
                :disabled="!o.enabled"
                @click="selectDateOperator(o)"
              >{{ o.label }}</button>
            </div>
            <label class="field-label">Value</label>
            <div class="value-field">
              <input v-model="dateValue" type="datetime-local" class="filter-input" />
              <button type="button" class="clear-x" :disabled="!hasAnyValue" title="Clear filter" @click="explicitClear">✕</button>
            </div>
          </template>

          <template v-else>
            <label class="field-label">Type</label>
            <div class="toggle-group">
              <button
                v-for="t in typeChoices"
                :key="t.type"
                type="button"
                class="toggle-btn"
                :class="{ active: selectedType === t.type }"
                :disabled="!t.enabled"
                :title="t.enabled ? '' : `No devices currently set this attribute as ${t.label.toLowerCase()}`"
                @click="selectType(t)"
              >{{ t.label }}</button>
            </div>

            <template v-if="selectedType === 'boolean'">
              <label class="field-label">Value</label>
              <div class="toggle-group">
                <button
                  type="button"
                  class="toggle-btn"
                  :class="{ active: booleanValue === true }"
                  @click="setBoolean(true)"
                >True</button>
                <button
                  type="button"
                  class="toggle-btn"
                  :class="{ active: booleanValue === false }"
                  @click="setBoolean(false)"
                >False</button>
              </div>
            </template>

            <template v-else-if="selectedType === 'numeric'">
              <label class="field-label">Comparison</label>
              <div class="toggle-group">
                <button
                  v-for="o in numericOperatorChoices"
                  :key="o.op"
                  type="button"
                  class="toggle-btn"
                  :class="{ active: selectedOperator === o.op }"
                  :disabled="!o.enabled"
                  @click="selectNumericOperator(o)"
                >{{ o.label }}</button>
              </div>
              <label class="field-label">Value</label>
              <div class="value-field">
                <input v-model="numericValue" type="number" step="any" class="filter-input" />
                <button type="button" class="clear-x" :disabled="!hasAnyValue" title="Clear filter" @click="explicitClear">✕</button>
              </div>
            </template>

            <template v-else>
              <label class="field-label">Comparison</label>
              <div class="toggle-group">
                <button
                  v-for="o in textOperatorChoices"
                  :key="o.op"
                  type="button"
                  class="toggle-btn"
                  :class="{ active: selectedTextOperator === o.op }"
                  :disabled="!o.enabled"
                  @click="selectTextOperator(o)"
                >{{ o.label }}</button>
              </div>
              <label class="field-label">Value</label>
              <div class="value-field">
                <input v-model="textValue" type="text" class="filter-input" />
                <button type="button" class="clear-x" :disabled="!hasAnyValue" title="Clear filter" @click="explicitClear">✕</button>
              </div>
            </template>
          </template>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.header-cell {
  position: relative;
  display: flex;
  align-items: center;
  /* Kept tight on purpose: this directly feeds the computed minimum width
     (see computeMinWidth in the script), and a narrow column (e.g. a device
     attribute) is mostly icon budget, not label. */
  gap: 0.2rem;
  height: 100%;
  box-sizing: border-box;
  /* A divider on both edges of each header cell - not just the row's
     bottom border - so it reads as a row of distinct column headers
     rather than one continuous bar. Left+right (rather than just
     right, with :last-child dropping it) so a header with empty
     trailing space past the last real column doesn't end in a
     dangling divider. */
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  margin-left: -1px; /* collapse the shared edge between adjacent cells */
}
.header-cell.clickable {
  cursor: pointer;
}
.header-cell.clickable:hover {
  background: rgba(0, 0, 0, 0.04);
}
.header-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  /* Pushes the whole trailing icon cluster (sort/filter/hamburger/resize)
     flush to the cell's right edge, whatever subset is actually present. */
  margin-left: auto;
}
.sort-indicator {
  font-size: 0.65rem;
  color: #1890ff;
  flex-shrink: 0;
}
.filter-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1890ff;
}
.config-icon {
  /* An explicit min-width (rather than relying on the "☰" glyph's own
     rendered size, which varies by font/browser) gives the min-width
     calculation in the script something concrete and reliable to measure -
     the glyph itself is centered inside it. */
  flex-shrink: 0;
  min-width: 13px;
  text-align: center;
  font-size: 0.7rem;
  line-height: 1;
  color: #666;
  opacity: 0.45;
}
.header-cell.clickable:hover .config-icon {
  opacity: 0.85;
}
/* Sits directly on top of the cell's right border (the column divider)
   rather than taking up flex space next to the other header icons - a
   strip straddling the shared edge between this column and the next, the
   way most spreadsheet/table UIs place their resize grips. The handle
   itself (.resize-handle) is the full-height invisible drag hit area;
   .resize-grip inside it is the small visible pill the "⋮" glyph sits
   centered in - a slightly greyed box at rest, so it's apparent at a
   glance that the divider is draggable, turning solid blue on hover. */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  transform: translateX(50%);
  width: 13px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
  z-index: 1;
}
.resize-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 11px;
  height: 18px;
  border-radius: 3px;
  font-size: 0.75rem;
  line-height: 1;
  color: #999;
  background: rgba(0, 0, 0, 0.06);
}
.resize-handle:hover .resize-grip {
  color: #fff;
  background: #1890ff;
}

.header-popover {
  z-index: 2000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 240px;
  font-weight: normal;
  font-size: 0.85rem;
  cursor: default;
}
.popover-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #999;
  margin: 0.1rem 0;
}
.popover-section-title.with-divider {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
}
.radio-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.field-label {
  font-size: 0.75rem;
  color: #666;
  font-weight: 500;
}
.filter-input {
  padding: 0.35rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: inherit;
}
.toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.toggle-btn {
  flex: 1 1 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fafafa;
  color: #333;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
}
.toggle-btn:hover:not(:disabled) {
  background: #f0f0f0;
}
.toggle-btn:disabled {
  color: #bbb;
  background: #f5f5f5;
  border-color: #eee;
  cursor: default;
}
.toggle-btn.active {
  background: #1890ff;
  border-color: #1890ff;
  color: white;
}
.value-field {
  position: relative;
  display: flex;
}
.value-field .filter-input {
  flex: 1 1 auto;
  width: 100%;
  padding-right: 1.6rem;
}
.clear-x {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  transform: translateY(-50%);
  border: none;
  background: none;
  padding: 0.1rem 0.25rem;
  line-height: 1;
  font-size: 0.75rem;
  font-weight: bold;
  color: #d4380d;
  cursor: pointer;
  border-radius: 3px;
}
.clear-x:hover:not(:disabled) {
  background: rgba(212, 56, 13, 0.1);
}
.clear-x:disabled {
  color: #ccc;
  cursor: default;
}

.status-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: bold;
  flex-shrink: 0;
}
.status-symbol.idle {
  color: #aaa;
  background: #f0f0f0;
}
.status-symbol.pending {
  color: #b8860b;
  background: #fff6db;
}
.status-symbol.applying {
  color: #1890ff;
  background: #e6f4ff;
  animation: status-spin 0.8s linear infinite;
}
.status-symbol.applied {
  color: #fff;
  background: #52c41a;
}
@keyframes status-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
