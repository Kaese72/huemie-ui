<script setup>
import { ref, computed } from 'vue'
import { useViewMode } from './composables/useViewMode.js'
import MobileApp from './mobile/MobileApp.vue'

const locked = ref(false)
const hovered = ref(false)
const expanded = computed(() => locked.value || hovered.value)

const { viewMode, isMobileDevice, toggleViewMode } = useViewMode()
</script>

<template>
  <MobileApp v-if="viewMode === 'mobile'" />

  <div v-else class="app-layout">
    <nav class="sidebar" :class="{ collapsed: !expanded }" @mouseenter="hovered = true" @mouseleave="hovered = false">
      <button class="collapse-btn" :style="{ visibility: expanded ? 'visible' : 'hidden' }" @click="locked = !locked" :title="locked ? 'Unlock menu' : 'Lock menu open'">
        {{ locked ? '🔒' : '🔓' }}
      </button>
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
  height: 100vh;
  min-height: 0;
}
.sidebar {
  width: 200px;
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
}
.sidebar.collapsed {
  width: 48px;
}
.collapse-btn {
  align-self: flex-end;
  margin-right: 8px;
  margin-bottom: 0.5rem;
  background: none;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.15s;
}
.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.15);
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
.sidebar a.router-link-active {
  font-weight: bold;
  color: #42b983;
}
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
