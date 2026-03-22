<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMobileTitle } from '../composables/useMobileTitle.js'

const route = useRoute()
const router = useRouter()
const { title } = useMobileTitle()

const canGoBack = computed(() => route.name !== 'MobileHome')

function goBack() {
  switch (route.name) {
    case 'MobileGroups':
    case 'MobileDevices':
      router.push({ name: 'MobileHome' })
      break
    case 'MobileGroupDetail':
      router.push({ name: 'MobileGroups' })
      break
    case 'MobileDeviceDetail':
      router.push({ name: 'MobileDevices' })
      break
  }
}
</script>

<template>
  <div class="mobile-app">
    <header class="mobile-header">
      <button v-if="canGoBack" class="back-btn" @click="goBack">&#8592;</button>
      <h1 class="mobile-title">{{ title }}</h1>
    </header>
    <div class="mobile-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.mobile-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f9fa;
}

.mobile-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #222e3a;
  color: #fff;
  padding: 1rem 1.25rem;
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

.mobile-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: bold;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
