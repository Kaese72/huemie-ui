<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useViewMode } from './composables/useViewMode.js'

const hovered = ref(false)

const { viewMode, isMobileDevice } = useViewMode()
const router = useRouter()
const route = useRoute()

const isPublicRoute = computed(() => route.meta.public === true)

// The AI Control sub-menu opens itself when entering any of its views, but
// can still be collapsed by hand afterwards.
const isAiControlRoute = computed(() => route.path.startsWith('/ai-control'))
const isAiChatRoute = computed(() => isAiControlRoute.value && !route.path.startsWith('/ai-control/settings'))
const aiControlOpen = ref(false)
watch(isAiControlRoute, (active) => { if (active) aiControlOpen.value = true }, { immediate: true })

function toggleViewMode() {
  if (viewMode.value === 'desktop') {
    router.push({ name: 'MobileHome' })
  } else {
    router.push({ name: 'Home' })
  }
}
</script>

<template>
  <!-- Public routes (login, setup) render full-page without the app shell -->
  <router-view v-if="isPublicRoute || viewMode === 'mobile'" />

  <div v-else class="app-layout">
    <nav class="sidebar" :class="{ collapsed: !hovered }" @mouseenter="hovered = true" @mouseleave="hovered = false">
      <ul>
        <li>
          <router-link to="/home">
            <span class="nav-icon">🏠</span>
            <span class="nav-label">Home</span>
          </router-link>
        </li>
        <li>
          <router-link to="/devices">
            <span class="nav-icon">💡</span>
            <span class="nav-label">Devices</span>
          </router-link>
        </li>
        <li>
          <router-link to="/groups">
            <span class="nav-icon">👥</span>
            <span class="nav-label">Groups</span>
          </router-link>
        </li>
        <li>
          <router-link to="/adapters">
            <span class="nav-icon">🔌</span>
            <span class="nav-label">Adapters</span>
          </router-link>
        </li>
        <li>
          <router-link to="/rules">
            <span class="nav-icon">⚙️</span>
            <span class="nav-label">Rules</span>
          </router-link>
        </li>
        <li>
          <router-link to="/users">
            <span class="nav-icon">👤</span>
            <span class="nav-label">Users</span>
          </router-link>
        </li>
        <li>
          <div class="nav-parent">
            <router-link to="/ai-control">
              <span class="nav-icon">🤖</span>
              <span class="nav-label">AI Control</span>
            </router-link>
            <button
              class="nav-toggle"
              type="button"
              :aria-expanded="aiControlOpen"
              :title="aiControlOpen ? 'Collapse AI Control' : 'Expand AI Control'"
              @click="aiControlOpen = !aiControlOpen"
            >
              <span class="nav-arrow" :class="{ open: aiControlOpen }">▸</span>
            </button>
          </div>
          <ul v-if="aiControlOpen" class="sub-menu">
            <li>
              <router-link to="/ai-control" custom v-slot="{ href, navigate }">
                <a :href="href" :class="{ active: isAiChatRoute }" @click="navigate">
                  <span class="nav-icon">💬</span>
                  <span class="nav-label">Chat</span>
                </a>
              </router-link>
            </li>
            <li>
              <router-link to="/ai-control/settings">
                <span class="nav-icon">🔑</span>
                <span class="nav-label">Settings</span>
              </router-link>
            </li>
          </ul>
        </li>
        <li>
          <router-link to="/cloud-connect">
            <span class="nav-icon">☁️</span>
            <span class="nav-label">Cloud Connect</span>
          </router-link>
        </li>
        <li v-if="!isMobileDevice">
          <a @click.prevent="toggleViewMode" href="#" :title="'Switch to mobile view'">
            <span class="nav-icon">📱</span>
            <span class="nav-label">Mobile view</span>
          </a>
        </li>
      </ul>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  position: relative;
  height: 100vh;
  min-height: 0;
}
.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  width: 48px;
  background: #222e3a;
  color: #fff;
  padding: 1.5rem 0 1.5rem 0;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  flex-shrink: 0;
  transition: width 0.25s ease;
  overflow: hidden;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}
.sidebar:not(.collapsed) {
  width: 200px;
}
.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.sidebar li {
  margin: 0.5rem 0;
}
.sidebar a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  color: #fff;
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s;
}
.sidebar a.router-link-active,
.sidebar a.active {
  font-weight: bold;
  color: #42b983;
}
.nav-parent {
  display: flex;
  align-items: center;
}
.nav-parent a {
  flex: 1;
}
.nav-toggle {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1;
  transition: opacity 0.15s ease;
}
.nav-toggle:hover { color: #42b983; }
.sidebar.collapsed .nav-toggle { opacity: 0; }
.nav-arrow {
  display: inline-block;
  transition: transform 0.15s ease;
}
.nav-arrow.open { transform: rotate(90deg); }
.sub-menu li { margin: 0; }
.sub-menu a { font-size: 0.95rem; }
.sidebar:not(.collapsed) .sub-menu a { padding-left: 1.75rem; }
.nav-icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}
.nav-label {
  font-size: 1.1rem;
  opacity: 1;
  transition: opacity 0.15s ease;
}
.sidebar.collapsed .nav-label {
  opacity: 0;
}
.main-content {
  flex: 1;
  margin-left: 48px;
  padding: 1.5rem;
  background: #f7f9fa;
  overflow-y: hidden;
  min-height: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
</style>
<style>
body, html, #app {
  margin: 0;
}
</style>
