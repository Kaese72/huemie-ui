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
.condition-node {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Drag state ───────────────────────────────────────────── */
.condition-row-wrap {
  position: relative;
}

.node--source > .condition-row-wrap > .condition-row {
  border-color: #42b983;
  box-shadow: 0 0 0 2px #42b98340;
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
  background: rgba(255, 255, 255, 0.82);
  border-radius: 5px;
  border: 2px dashed #90caf9;
  z-index: 20;
  padding: 0 8px;
}

.dz-btn {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}
.dz-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.dz-swap { background: #e8f5e9; color: #2e7d32; border-color: #2e7d32; }
.dz-swap:not(:disabled):hover { background: #2e7d32; color: #fff; }
.dz-and  { background: #e3f2fd; color: #1565c0; border-color: #1565c0; }
.dz-and:not(:disabled):hover  { background: #1565c0; color: #fff; }
.dz-or   { background: #f3e5f5; color: #6a1b9a; border-color: #6a1b9a; }
.dz-or:not(:disabled):hover   { background: #6a1b9a; color: #fff; }

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: #bbb;
  font-size: 1rem;
  padding: 0 2px;
  user-select: none;
  flex-shrink: 0;
  line-height: 1;
}
.drag-handle:hover { color: #888; }

/* ── Row layout ───────────────────────────────────────────── */
.condition-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 6px 8px;
  flex-wrap: wrap;
}
.type-select {
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
  min-width: 130px;
}
.time-input {
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
  width: 110px;
}
.id-input {
  width: 64px;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.attr-input {
  width: 100px;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.bool-select {
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.num-input {
  width: 80px;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.text-value-input {
  width: 140px;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.cooldown-input {
  width: 60px;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.tz-select {
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid #ccc;
  max-width: 180px;
}
.field-label {
  font-size: 0.8rem;
  color: #666;
}
.node-buttons {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.btn-rel {
  font-size: 0.75rem;
  padding: 2px 8px;
  border: 1px solid #aaa;
  border-radius: 3px;
  cursor: pointer;
  background: #fff;
  color: #333;
}
.btn-rel:hover:not(:disabled) {
  background: #e8f5e9;
  border-color: #42b983;
  color: #42b983;
}
.btn-rel:disabled {
  opacity: 0.35;
  cursor: default;
}
.btn-remove {
  font-size: 0.75rem;
  padding: 2px 7px;
  border: 1px solid #e57373;
  border-radius: 3px;
  cursor: pointer;
  background: #fff;
  color: #e57373;
}
.btn-remove:hover {
  background: #ffebee;
}

/* ── AND / OR blocks ──────────────────────────────────────── */
.and-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 24px;
  border-left: 2px solid #90caf9;
  margin-left: 8px;
}
.and-badge {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  background: #e3f2fd;
  color: #1565c0;
  align-self: flex-start;
}
.or-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  background: #ce93d8;
}
.or-badge {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  background: #f3e5f5;
  color: #6a1b9a;
  white-space: nowrap;
}
.days-picker {
  display: flex;
  gap: 2px;
}
.day-btn {
  width: 20px;
  height: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  border-radius: 3px;
  border: 1px solid #ccc;
  cursor: pointer;
  background: #f0f0f0;
  color: #aaa;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.day-btn--active {
  background: #42b983;
  border-color: #2d8f5e;
  color: #fff;
}
.day-btn:hover:not(.day-btn--active) {
  background: #e8f5e9;
  border-color: #42b983;
  color: #42b983;
}
</style>
