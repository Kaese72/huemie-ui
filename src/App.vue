<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useViewMode } from './composables/useViewMode.js'
import { useAuth } from './composables/useAuth.js'
import AppTopBar from './components/AppTopBar.vue'
import BrandMark from './components/BrandMark.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const { logout } = useAuth()

const { viewMode } = useViewMode()
const router = useRouter()
const route = useRoute()

// Three layouts (DESIGN.md, section 3): public auth pages get a slim header
// around a centred card, the mobile view brings its own bar (MobileApp.vue),
// and everything else gets the app top bar.
const layout = computed(() => {
  if (route.meta.public === true) return 'auth'
  if (viewMode.value === 'mobile') return 'mobile'
  return 'app'
})

async function handleLogout() {
  await logout()
  router.push({ name: 'Login' })
}

function switchToMobileView() {
  router.push({ name: 'MobileHome' })
}
</script>

<template>
  <div v-if="layout === 'auth'" class="auth-layout">
    <header class="auth-header">
      <BrandMark />
      <ThemeToggle />
    </header>
    <main class="auth-main">
      <router-view />
    </main>
  </div>

  <router-view v-else-if="layout === 'mobile'" />

  <div v-else class="app-layout">
    <AppTopBar @logout="handleLogout" @mobile-view="switchToMobileView" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 70% 45% at 50% 100%, color-mix(in srgb, var(--warm) 10%, transparent), transparent 70%),
    var(--bg);
}
.auth-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 64px;
}

/* The app fills exactly one viewport: list pages size their tables from the
   space left below the top bar, so the page itself never scrolls. */
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.main-content {
  flex: 1;
  min-height: 0;
  padding: 24px;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
</style>
