<script setup>
// A button that may be unavailable for a reason worth explaining (e.g. the
// session didn't begin with a local login). With a `reason`, the button is
// disabled and the reason shows as its tooltip. The tooltip sits on a
// wrapper, since browsers don't reliably show a disabled button's own
// title. `disabled` covers the ordinary cases (busy, form incomplete) that
// need no explanation.
defineOptions({ inheritAttrs: false })

defineProps({
  reason: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <span
    class="gated"
    :class="{ blocked: !!reason }"
    :title="reason || undefined"
    :tabindex="reason ? 0 : undefined"
  >
    <button v-bind="$attrs" :disabled="disabled || !!reason" :aria-disabled="!!reason || undefined">
      <slot />
    </button>
  </span>
</template>

<style scoped>
.gated {
  display: inline-flex;
}
/* Let hover reach the wrapper, which carries the tooltip. */
.gated.blocked > button {
  pointer-events: none;
}
.gated.blocked {
  cursor: not-allowed;
}
</style>
