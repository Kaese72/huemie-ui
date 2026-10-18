<script setup>
defineOptions({ name: 'ConditionNode' })

const props = defineProps({
  node:   { type: Object,  required: true },
  isRoot: { type: Boolean, default: false },
  path:   { type: Array,   default: () => [] },
})
const emit = defineEmits(['update', 'remove'])

import { computed, inject, ref } from 'vue'
import { useTimezones, localTimezone } from '../composables/useTimezones.js'
import { pathsEqual } from '../composables/useConditionDrag.js'

const allTimezones = useTimezones()
const drag = inject('conditionDrag', null)

const rowEl = ref(null)

// ── Drag state helpers ────────────────────────────────────────────────────────

const isBeingDragged = computed(() => drag?.isSource(props.path) ?? false)

// Show drop zones on every node except the source itself.
// AND/OR placement is additionally gated on isDescendantOfSource (would create cycle).
// Swap is condition-only so it is always safe.
const isDropTarget = computed(() =>
  drag?.isDragging.value && !isBeingDragged.value
)

const isGreyed = computed(() =>
  drag?.isDragging.value && !isBeingDragged.value
)

const swapDisabled = computed(() => false)

const andDisabled = computed(() =>
  !!props.node.and || (drag?.isDescendantOfSource(props.path) ?? false)
)

const orDisabled = computed(() =>
  drag?.isDescendantOfSource(props.path) ?? false
)

function onMousedown(e) {
  e.preventDefault()
  if (!drag || props.isRoot) return
  const rect = rowEl.value?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 }
  drag.onDragStart(props.path, rect)
}

// ── Condition types ───────────────────────────────────────────────────────────

const weekdays = [
  { key: 'monday',    label: 'M' },
  { key: 'tuesday',   label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday',  label: 'T' },
  { key: 'friday',    label: 'F' },
  { key: 'saturday',  label: 'S' },
  { key: 'sunday',    label: 'S' },
]

const numberTypes = new Set([
  'device-id-attribute-number-eq',
  'device-id-attribute-number-eq-margin',
  'device-id-attribute-number-lt',
  'device-id-attribute-number-gt',
  'device-id-attribute-number-lte',
  'device-id-attribute-number-gte',
])
const textTypes = new Set([
  'device-id-attribute-text-eq',
  'device-id-attribute-text-substring',
])

const deviceTypes = new Set([
  'device-id-attribute-boolean-eq',
  ...numberTypes,
  ...textTypes,
])

const isNumberType  = computed(() => numberTypes.has(props.node.condition.type))
const isTextType    = computed(() => textTypes.has(props.node.condition.type))
const isDeviceType  = computed(() => deviceTypes.has(props.node.condition.type))

// ── Tree update helpers ───────────────────────────────────────────────────────

function update(changes) {
  emit('update', { ...props.node, ...changes })
}

function updateCondition(changes) {
  update({ condition: { ...props.node.condition, ...changes } })
}

function changeType(newType) {
  const condition = { type: newType }
  if (newType === 'time-range') {
    condition.from = '06:00:00'
    condition.to = '22:00:00'
    condition.timezone = localTimezone.value
  } else if (newType === 'time-range-days') {
    condition.from = '06:00:00'
    condition.to = '22:00:00'
    condition.timezone = localTimezone.value
    condition.days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  } else if (newType === 'device-id-attribute-boolean-eq') {
    condition.id = 1
    condition.attribute = 'active'
    condition.boolean = false
  } else if (numberTypes.has(newType)) {
    condition.id = 1
    condition.attribute = ''
    condition.value = 0
    if (newType === 'device-id-attribute-number-eq-margin') condition.margin = 1
  } else if (textTypes.has(newType)) {
    condition.id = 1
    condition.attribute = ''
    condition.value = ''
  }
  update({ condition })
}

function toggleDay(day) {
  const days = props.node.condition.days || []
  const newDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day]
  updateCondition({ days: newDays })
}

const newNode = () => ({ condition: { type: 'time-range', from: '06:00:00', to: '22:00:00', timezone: localTimezone.value }, and: null, or: null })

function addAnd() { update({ and: newNode() }) }
function addOr()  { update({ or:  newNode() }) }
function updateAnd(n) { update({ and: n }) }
function updateOr(n)  { update({ or:  n }) }
function removeAnd()  { update({ and: null }) }
function removeOr()   { update({ or:  null }) }
</script>

<template>
  <div
    class="condition-node"
    :class="{
      'node--source': isBeingDragged,
      'node--greyed': isGreyed,
    }"
  >
    <!-- Condition row + drop-zone wrapper -->
    <div class="condition-row-wrap" ref="rowEl">
      <div class="condition-row">
        <!-- Drag handle -->
        <div
          v-if="!isRoot && drag"
          class="drag-handle"
          @mousedown="onMousedown"
          title="Drag to reorder"
        >⠿</div>

        <select :value="node.condition.type" @change="changeType($event.target.value)" class="type-select">
          <option value="time-range">Time range</option>
          <option value="time-range-days">Time range (days)</option>
          <optgroup label="Device — boolean">
            <option value="device-id-attribute-boolean-eq">Device bool =</option>
          </optgroup>
          <optgroup label="Device — number">
            <option value="device-id-attribute-number-eq">Device num ≈</option>
            <option value="device-id-attribute-number-eq-margin">Device num ≈±</option>
            <option value="device-id-attribute-number-lt">Device num &lt;</option>
            <option value="device-id-attribute-number-gt">Device num &gt;</option>
            <option value="device-id-attribute-number-lte">Device num ≤</option>
            <option value="device-id-attribute-number-gte">Device num ≥</option>
          </optgroup>
          <optgroup label="Device — text">
            <option value="device-id-attribute-text-eq">Device text =</option>
            <option value="device-id-attribute-text-substring">Device text ∋</option>
          </optgroup>
        </select>

        <template v-if="node.condition.type === 'time-range'">
          <span class="field-label">From</span>
          <input type="time" step="1"
            :value="node.condition.from"
            @change="updateCondition({ from: $event.target.value })"
            class="time-input" />
          <span class="field-label">To</span>
          <input type="time" step="1"
            :value="node.condition.to"
            @change="updateCondition({ to: $event.target.value })"
            class="time-input" />
          <span class="field-label">TZ</span>
          <select
            @change="updateCondition({ timezone: $event.target.value })"
            class="tz-select">
            <option
              v-for="tz in allTimezones" :key="tz" :value="tz"
              :selected="(node.condition.timezone || localTimezone) === tz"
            >{{ tz }}</option>
          </select>
        </template>

        <template v-else-if="node.condition.type === 'time-range-days'">
          <span class="field-label">From</span>
          <input type="time" step="1"
            :value="node.condition.from"
            @change="updateCondition({ from: $event.target.value })"
            class="time-input" />
          <span class="field-label">To</span>
          <input type="time" step="1"
            :value="node.condition.to"
            @change="updateCondition({ to: $event.target.value })"
            class="time-input" />
          <span class="field-label">TZ</span>
          <select
            @change="updateCondition({ timezone: $event.target.value })"
            class="tz-select">
            <option
              v-for="tz in allTimezones" :key="tz" :value="tz"
              :selected="(node.condition.timezone || localTimezone) === tz"
            >{{ tz }}</option>
          </select>
          <div class="days-picker">
            <button
              v-for="day in weekdays" :key="day.key"
              type="button"
              :class="['day-btn', { 'day-btn--active': (node.condition.days || []).includes(day.key) }]"
              @click="toggleDay(day.key)"
            >{{ day.label }}</button>
          </div>
        </template>

        <template v-else-if="node.condition.type === 'device-id-attribute-boolean-eq'">
          <span class="field-label">Device ID</span>
          <input type="number" min="1"
            :value="node.condition.id"
            @input="updateCondition({ id: parseInt($event.target.value) || 1 })"
            class="id-input" />
          <span class="field-label">.</span>
          <input type="text" placeholder="attribute"
            :value="node.condition.attribute"
            @input="updateCondition({ attribute: $event.target.value })"
            class="attr-input" />
          <span class="field-label">=</span>
          <select
            :value="String(node.condition.boolean)"
            @change="updateCondition({ boolean: $event.target.value === 'true' })"
            class="bool-select">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </template>

        <template v-else-if="isNumberType">
          <span class="field-label">Device ID</span>
          <input type="number" min="1"
            :value="node.condition.id"
            @input="updateCondition({ id: parseInt($event.target.value) || 1 })"
            class="id-input" />
          <span class="field-label">.</span>
          <input type="text" placeholder="attribute"
            :value="node.condition.attribute"
            @input="updateCondition({ attribute: $event.target.value })"
            class="attr-input" />
          <span class="field-label">value</span>
          <input type="number" step="any"
            :value="node.condition.value"
            @input="updateCondition({ value: parseFloat($event.target.value) || 0 })"
            class="num-input" />
          <template v-if="node.condition.type === 'device-id-attribute-number-eq-margin'">
            <span class="field-label">±</span>
            <input type="number" step="any" min="0"
              :value="node.condition.margin"
              @input="updateCondition({ margin: parseFloat($event.target.value) || 0 })"
              class="num-input" />
          </template>
        </template>

        <template v-else-if="isTextType">
          <span class="field-label">Device ID</span>
          <input type="number" min="1"
            :value="node.condition.id"
            @input="updateCondition({ id: parseInt($event.target.value) || 1 })"
            class="id-input" />
          <span class="field-label">.</span>
          <input type="text" placeholder="attribute"
            :value="node.condition.attribute"
            @input="updateCondition({ attribute: $event.target.value })"
            class="attr-input" />
          <span class="field-label">value</span>
          <input type="text" placeholder="value"
            :value="node.condition.value"
            @input="updateCondition({ value: $event.target.value })"
            class="text-value-input" />
        </template>

        <template v-if="isDeviceType">
          <span class="field-label">cooldown</span>
          <input type="number" min="0" placeholder="none"
            :value="node.condition['cooldown-seconds'] ?? ''"
            @input="updateCondition({ 'cooldown-seconds': parseInt($event.target.value) > 0 ? parseInt($event.target.value) : undefined })"
            class="cooldown-input" />
          <span class="field-label">s</span>
        </template>

        <div class="node-buttons">
          <button @click="addAnd" :disabled="!!node.and" class="btn-rel">+ AND</button>
          <button @click="addOr"  :disabled="!!node.or"  class="btn-rel">+ OR</button>
          <button v-if="!isRoot" @click="emit('remove')" class="btn-remove">✕</button>
        </div>
      </div>

      <!-- Drop zone overlay — appears on every non-source node while dragging -->
      <div v-if="isDropTarget" class="drop-zones">
        <button
          class="dz-btn dz-swap"
          :disabled="swapDisabled"
          @mouseenter="drag.setHover(path, 'swap')"
          @mouseleave="drag.clearHover()"
          @mouseup.stop="drag.commitDrop(path, 'swap')"
        >↔ Swap</button>
        <button
          class="dz-btn dz-and"
          :disabled="andDisabled"
          @mouseenter="drag.setHover(path, 'and')"
          @mouseleave="drag.clearHover()"
          @mouseup.stop="drag.commitDrop(path, 'and')"
        >∧ AND here</button>
        <button
          class="dz-btn dz-or"
          :disabled="orDisabled"
          @mouseenter="drag.setHover(path, 'or')"
          @mouseleave="drag.clearHover()"
          @mouseup.stop="drag.commitDrop(path, 'or')"
        >∨ OR here</button>
      </div>
    </div>

    <div v-if="node.and" class="and-block">
      <div class="and-badge">AND</div>
      <ConditionNode :node="node.and" :path="[...path, 'and']" @update="updateAnd" @remove="removeAnd" />
    </div>

    <div v-if="node.or" class="or-block">
      <div class="or-divider"><span class="or-badge">OR</span></div>
      <ConditionNode :node="node.or" :path="[...path, 'or']" @update="updateOr" @remove="removeOr" />
    </div>
  </div>
</template>

<style scoped>
/* DESIGN.md (this repo), section 6 "Rules". AND/OR are logic, not meaning,
   so they stay neutral. Green marks the drag/drop interaction. Nothing here
   is dashed - dashed means Cloud. */
.condition-node {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Drag state ───────────────────────────────────────────── */
.condition-row-wrap {
  position: relative;
}

.node--source > .condition-row-wrap > .condition-row {
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent);
}

.node--greyed > .condition-row-wrap > .condition-row {
  opacity: 0.35;
  pointer-events: none;
}

/* Drop zones overlay */
.drop-zones {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border-radius: 12px;
  border: 2px solid color-mix(in srgb, var(--ink) 14%, transparent);
  z-index: 20;
  padding: 0 8px;
}

.dz-btn {
  padding: 4px 12px;
  border-radius: 999px;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--text);
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  white-space: nowrap;
}
.dz-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.dz-btn:not(:disabled):hover {
  background: color-mix(in srgb, var(--green) 16%, transparent);
  border-color: var(--green);
  color: var(--green-ink);
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: var(--faint);
  font-size: 1rem;
  padding: 0 2px;
  user-select: none;
  flex-shrink: 0;
  line-height: 1;
}
.drag-handle:hover { color: var(--text); }

/* ── Row layout ───────────────────────────────────────────── */
.condition-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 12px;
  padding: 7px 10px;
  flex-wrap: wrap;
  transition: border-color 0.2s, box-shadow 0.2s;
}

/* All the small inline controls share one look (a compact .input). */
.type-select,
.time-input,
.id-input,
.attr-input,
.bool-select,
.num-input,
.text-value-input,
.cooldown-input,
.tz-select {
  font: inherit;
  font-size: 0.85rem;
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--text);
  outline: none;
  color-scheme: var(--scheme);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.type-select:focus,
.time-input:focus,
.id-input:focus,
.attr-input:focus,
.bool-select:focus,
.num-input:focus,
.text-value-input:focus,
.cooldown-input:focus,
.tz-select:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 22%, transparent);
}
.type-select option,
.type-select optgroup,
.bool-select option,
.tz-select option {
  background: var(--surface);
  color: var(--text);
}
.type-select {
  min-width: 130px;
  font-weight: 600;
}
.time-input { width: 110px; }
.id-input { width: 64px; }
.attr-input { width: 100px; }
.num-input { width: 80px; }
.text-value-input { width: 140px; }
.cooldown-input { width: 60px; }
.tz-select { max-width: 180px; }

.field-label {
  font-size: 0.8rem;
  color: var(--muted);
}
.node-buttons {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.btn-rel {
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
  border-radius: 999px;
  cursor: pointer;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--muted);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.btn-rel:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 9%, transparent);
  border-color: color-mix(in srgb, var(--ink) 35%, transparent);
  color: var(--text);
}
.btn-rel:disabled {
  opacity: 0.35;
  cursor: default;
}
.btn-remove {
  font: inherit;
  font-size: 0.72rem;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  background: none;
  color: var(--muted);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.btn-remove:hover {
  color: var(--danger-ink);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}

/* ── AND / OR blocks ──────────────────────────────────────── */
/* AND: the next condition hangs off a solid neutral line with an AND chip. */
.and-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 22px;
  border-left: 2px solid color-mix(in srgb, var(--ink) 12%, transparent);
  margin-left: 10px;
}
.and-badge,
.or-badge {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 2px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.and-badge {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--muted);
  align-self: flex-start;
}
/* OR: a full-width divider with an outlined OR chip in the middle. */
.or-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.or-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0;
}
.or-divider::before,
.or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--ink) 14%, transparent);
}
.or-badge {
  border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
  color: var(--muted);
}
.days-picker {
  display: flex;
  gap: 3px;
}
.day-btn {
  width: 22px;
  height: 22px;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  cursor: pointer;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  color: var(--faint);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.day-btn--active {
  background: color-mix(in srgb, var(--green) 18%, transparent);
  border-color: var(--green);
  color: var(--green-ink);
}
.day-btn:hover:not(.day-btn--active) {
  border-color: color-mix(in srgb, var(--green) 60%, transparent);
  color: var(--text);
}
</style>
