<script setup>
defineOptions({ name: 'ConditionNode' })

const props = defineProps({
  node: { type: Object, required: true },
  isRoot: { type: Boolean, default: false },
})
const emit = defineEmits(['update', 'remove'])

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
  } else if (newType === 'device-id-attribute-boolean-eq') {
    condition.id = 1
    condition.attribute = 'active'
    condition.boolean = false
  }
  update({ condition })
}

const newNode = () => ({ condition: { type: 'time-range', from: '06:00:00', to: '22:00:00' }, and: null, or: null })

function addAnd() { update({ and: newNode() }) }
function addOr()  { update({ or:  newNode() }) }
function updateAnd(n) { update({ and: n }) }
function updateOr(n)  { update({ or:  n }) }
function removeAnd()  { update({ and: null }) }
function removeOr()   { update({ or:  null }) }
</script>

<template>
  <div class="condition-node">
    <div class="condition-row">
      <select :value="node.condition.type" @change="changeType($event.target.value)" class="type-select">
        <option value="time-range">Time range</option>
        <option value="device-id-attribute-boolean-eq">Device attr =</option>
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

      <div class="node-buttons">
        <button @click="addAnd" :disabled="!!node.and" class="btn-rel">+ AND</button>
        <button @click="addOr"  :disabled="!!node.or"  class="btn-rel">+ OR</button>
        <button v-if="!isRoot" @click="emit('remove')" class="btn-remove">✕</button>
      </div>
    </div>

    <div v-if="node.and" class="and-block">
      <div class="and-badge">AND</div>
      <ConditionNode :node="node.and" @update="updateAnd" @remove="removeAnd" />
    </div>

    <div v-if="node.or" class="or-block">
      <div class="or-divider"><span class="or-badge">OR</span></div>
      <ConditionNode :node="node.or" @update="updateOr" @remove="removeOr" />
    </div>
  </div>
</template>

<style scoped>
.condition-node {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
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
</style>
