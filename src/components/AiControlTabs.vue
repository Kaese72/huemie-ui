<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Chat / Settings tabs at the top of the AI Control pages (they replace the
// old sidebar sub-menu - see DESIGN.md, section 3).
const route = useRoute()
const onSettings = computed(() => route.path.startsWith('/ai-control/settings'))
</script>

<template>
  <nav class="tabs ai-tabs" aria-label="AI Control">
    <router-link to="/ai-control" class="tab" :class="{ active: !onSettings }">Chat</router-link>
    <router-link to="/ai-control/settings" class="tab" :class="{ active: onSettings }">Settings</router-link>
  </nav>
</template>

<style scoped>
.ai-tabs {
  margin: 0;
}
</style>
