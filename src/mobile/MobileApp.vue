<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMobileTitle } from '../composables/useMobileTitle.js'
import BrandMark from '../components/BrandMark.vue'
import ThemeToggle from '../components/ThemeToggle.vue'

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
      <div class="side">
        <button v-if="canGoBack" class="icon-btn back-btn" aria-label="Back" title="Back" @click="goBack">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
        <BrandMark v-else class="mobile-brand" />
      </div>
      <h1 v-if="canGoBack" class="mobile-title">{{ title }}</h1>
      <div class="side side-right">
        <ThemeToggle />
      </div>
    </header>
    <div class="mobile-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
/* DESIGN.md (this repo), section 7 "Mobile view": a remote control. */
.mobile-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--bg);
}
.mobile-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 6%, transparent);
}
.side {
  display: flex;
  align-items: center;
  min-width: 44px;
}
.side-right {
  justify-content: flex-end;
}
.back-btn {
  width: 44px;
  height: 44px;
  margin-left: -6px;
}
.back-btn svg {
  width: 22px;
  height: 22px;
}
.mobile-title {
  position: absolute;
  left: 72px;
  right: 72px;
  margin: 0;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
