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
  <!-- Teleported so the backdrop covers the whole app, top bar included,
       even when opened from inside a detail pane. -->
  <Teleport to="body">
    <div v-if="show" class="dialog-backdrop" @click.self="close">
      <div class="dialog capability-dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <h3 class="dialog-title">{{ capability.name }}</h3>
          <button class="icon-btn" title="Close" aria-label="Close" @click="close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div class="dialog-body">
          <p v-if="!hasArguments" class="hint">This capability has no arguments.</p>

          <div v-else class="arguments-form">
            <div
              v-for="spec in capability['argument-specs']"
              :key="spec.name"
              class="field"
            >
              <label :for="'arg-' + spec.name">
                {{ spec.name }}
                <span v-if="getArgumentType(spec) === 'numeric' && spec.numeric" class="range-hint">
                  {{ spec.numeric.min }} – {{ spec.numeric.max }}
                </span>
                <span v-if="getArgumentType(spec) === 'text' && spec.text && (spec.text.min || spec.text.max)" class="range-hint">
                  length {{ spec.text.min ?? 0 }} – {{ spec.text.max ?? '∞' }}
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
                  class="input input-sm number-input"
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
                class="input"
              />
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="close">Cancel</button>
          <button class="btn btn-primary" @click="triggerCapability">Send</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.capability-dialog {
  width: 460px;
  max-height: 85vh;
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
  overflow-wrap: anywhere;
}
.dialog-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.arguments-form .field label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.range-hint {
  font-weight: 400;
  color: var(--faint);
  font-size: 0.8rem;
}
.checkbox-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}
.numeric-input-group {
  display: flex;
  align-items: center;
  gap: 14px;
}
.number-input {
  width: 96px;
  flex-shrink: 0;
}

/* The slider sends a value to a device, so its thumb is warm (outbound). */
.slider-input {
  flex: 1;
  min-width: 0;
  height: 6px;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background: var(--track);
  border-radius: 999px;
  outline: none;
}
.slider-input:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 30%, transparent);
}
.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--warm);
  border: 3px solid var(--surface);
  box-shadow: 0 0 10px color-mix(in srgb, var(--warm) 60%, transparent);
  cursor: pointer;
  border-radius: 50%;
}
.slider-input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--warm);
  border: 3px solid var(--surface);
  box-shadow: 0 0 10px color-mix(in srgb, var(--warm) 60%, transparent);
  cursor: pointer;
  border-radius: 50%;
}
</style>
