<!-- The Humi logo: the wordmark with a house roof over its H.
     Wrap it in whatever link the context needs. -->
<script setup>
import HumiH from './HumiH.vue'
</script>

<template>
  <span class="brand" role="img" aria-label="Humi">
    <HumiH /><span aria-hidden="true">umi</span>
  </span>
</template>

<style scoped>
.brand {
  --humi-ls: -0.03em;
  display: inline-flex;
  align-items: baseline;
  padding-top: 0.3em;
  color: var(--text);
  font-weight: 800;
  font-size: 1.5rem;
  line-height: 1;
  letter-spacing: -0.03em;
}
/* A slightly heavier roof at this small size, to match the 800-weight H. */
.brand :deep(.roof svg) {
  stroke-width: 0.16em;
}
</style>
