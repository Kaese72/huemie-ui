<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  capability: {
    type: Object,
    required: true
  },
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'trigger'])

const argumentValues = ref({})

// Reset values when capability changes or dialog opens
watch(() => [props.capability, props.show], () => {
  if (props.show && props.capability) {
    initializeArgumentValues()
  }
}, { immediate: true })

function initializeArgumentValues() {
  const values = {}
  if (props.capability['argument-specs']) {
    props.capability['argument-specs'].forEach(spec => {
      if (spec.boolean) {
        values[spec.name] = spec.boolean.default ?? false
      } else if (spec.numeric) {
        values[spec.name] = spec.numeric.default ?? spec.numeric.min
      } else if (spec.text) {
        values[spec.name] = spec.text.default ?? ''
      }
    })
  }
  argumentValues.value = values
}

const hasArguments = computed(() => {
  return props.capability['argument-specs'] && props.capability['argument-specs'].length > 0
})

function close() {
  emit('close')
}

function triggerCapability() {
  emit('trigger', argumentValues.value)
}

function getArgumentType(spec) {
  if (spec.boolean) return 'boolean'
  if (spec.numeric) return 'numeric'
  if (spec.text) return 'text'
  return null
}
</script>

<template>
  <div v-if="show" class="dialog-overlay" @click.self="close">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3>Trigger {{ capability.name }}</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="dialog-body">
        <div v-if="!hasArguments" class="no-arguments">
          <p>This capability has no arguments.</p>
        </div>
        
        <div v-else class="arguments-form">
          <div 
            v-for="spec in capability['argument-specs']" 
            :key="spec.name" 
            class="argument-field"
          >
            <label :for="'arg-' + spec.name">
              {{ spec.name }}
              <span v-if="getArgumentType(spec) === 'numeric' && spec.numeric" class="hint">
                ({{ spec.numeric.min }} - {{ spec.numeric.max }})
              </span>
              <span v-if="getArgumentType(spec) === 'text' && spec.text && (spec.text.min || spec.text.max)" class="hint">
                (length: {{ spec.text.min ?? 0 }} - {{ spec.text.max ?? '∞' }})
              </span>
            </label>
            
            <!-- Boolean input -->
            <input
              v-if="getArgumentType(spec) === 'boolean'"
              :id="'arg-' + spec.name"
              v-model="argumentValues[spec.name]"
              type="checkbox"
              class="checkbox-input"
            />
            
            <!-- Numeric input with slider -->
            <div v-else-if="getArgumentType(spec) === 'numeric'" class="numeric-input-group">
              <input
                :id="'arg-slider-' + spec.name"
                v-model.number="argumentValues[spec.name]"
                type="range"
                :min="spec.numeric.min"
                :max="spec.numeric.max"
                :step="(spec.numeric.max - spec.numeric.min) > 1 ? 1 : 0.01"
                class="slider-input"
              />
              <input
                :id="'arg-' + spec.name"
                v-model.number="argumentValues[spec.name]"
                type="number"
                :min="spec.numeric.min"
                :max="spec.numeric.max"
                :step="(spec.numeric.max - spec.numeric.min) > 1 ? 1 : 0.01"
                class="number-input"
              />
            </div>
            
            <!-- Text input -->
            <input
              v-else-if="getArgumentType(spec) === 'text'"
              :id="'arg-' + spec.name"
              v-model="argumentValues[spec.name]"
              type="text"
              :minlength="spec.text.min"
              :maxlength="spec.text.max"
              class="text-input"
            />
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="close">Cancel</button>
        <button class="btn btn-primary" @click="triggerCapability">Trigger</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.no-arguments {
  text-align: center;
  color: #666;
  padding: 1rem 0;
}

.arguments-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.argument-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.argument-field label {
  font-weight: 500;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint {
  font-size: 0.85rem;
  color: #666;
  font-weight: normal;
}

.checkbox-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.numeric-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-input {
  width: 100%;
  height: 0.5rem;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 4px;
  outline: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  background: #42b983;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
}

.slider-input::-webkit-slider-thumb:hover {
  background: #369870;
}

.slider-input::-moz-range-thumb {
  width: 1.25rem;
  height: 1.25rem;
  background: #42b983;
  cursor: pointer;
  border-radius: 50%;
  border: none;
  transition: background 0.2s;
}

.slider-input::-moz-range-thumb:hover {
  background: #369870;
}

.number-input,
.text-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.number-input:focus,
.text-input:focus {
  outline: none;
  border-color: #42b983;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-primary {
  background: #42b983;
  color: white;
}

.btn-primary:hover {
  background: #369870;
}
</style>
