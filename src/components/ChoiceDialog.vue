<script setup>
import { watch, nextTick } from 'vue'

// ChoiceDialog asks one question with a few answers. It emits `choose` with
// the picked option's value, or `close` when dismissed.
const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  // [{ value, label, primary? }]; the primary option is focused on open.
  options: { type: Array, required: true },
})
const emit = defineEmits(['choose', 'close'])

let primaryButton = null

function setButtonRef(option, el) {
  if (option.primary) primaryButton = el
}

watch(() => props.show, (show) => {
  if (show) nextTick(() => primaryButton?.focus())
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" :aria-label="title">
        <h3 class="dialog-title">{{ title }}</h3>
        <p v-if="message" class="hint">{{ message }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost btn-sm" @click="emit('close')">Cancel</button>
          <button
            v-for="option in options"
            :key="option.value"
            :ref="el => setButtonRef(option, el)"
            class="btn btn-sm"
            :class="option.primary ? 'btn-primary' : 'btn-ghost'"
            @click="emit('choose', option.value)"
          >{{ option.label }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
