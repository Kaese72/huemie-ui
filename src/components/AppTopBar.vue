<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { isMobileDevice } from '../composables/useViewMode.js'
import BrandMark from './BrandMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserChip from './UserChip.vue'

// Top bar for the signed-in Appliance UI. Same look as cloud-ui's
// AppTopBar (see DESIGN.md, section 3): the main sections as pill links,
// the less used ones under "More", and theme / account / log out on the right.
defineEmits(['logout', 'mobile-view'])

const route = useRoute()
const { currentUserId } = useAuth()

const links = [
  { to: '/home', label: 'Home' },
  { to: '/devices', label: 'Devices' },
  { to: '/groups', label: 'Groups' },
  { to: '/rules', label: 'Rules' },
  { to: '/ai-control', label: 'AI Control' },
]

const moreLinks = [
  { to: '/adapters', label: 'Adapters' },
  { to: '/users', label: 'Users' },
  { to: '/cloud-connect', label: 'Cloud Connect', cloud: true },
]

// Prefix matching, so e.g. /ai-control/settings (its own top-level route)
// still marks "AI Control" as the current section.
function isActive(to) {
  return route.path === to || route.path.startsWith(to + '/')
}

const moreActive = computed(() => moreLinks.some(link => isActive(link.to)))
const accountLink = computed(() => currentUserId.value != null ? `/users/${currentUserId.value}` : '/users')

const moreOpen = ref(false)
const moreRef = ref(null)

function onDocumentClick(event) {
  if (moreOpen.value && moreRef.value && !moreRef.value.contains(event.target)) moreOpen.value = false
}
function onKeydown(event) {
  if (event.key === 'Escape') moreOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="app-topbar">
    <div class="inner">
      <router-link to="/home" class="brand-link" title="Home">
        <BrandMark />
      </router-link>

      <nav class="links" aria-label="Main">
        <router-link
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          :class="{ active: isActive(link.to) }"
        >{{ link.label }}</router-link>

        <div ref="moreRef" class="more">
          <button
            type="button"
            class="more-btn"
            :class="{ active: moreActive, open: moreOpen }"
            :aria-expanded="moreOpen"
            aria-haspopup="true"
            @click="moreOpen = !moreOpen"
          >
            More
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          <div v-if="moreOpen" class="more-menu" role="menu" @click="moreOpen = false">
            <router-link
              v-for="link in moreLinks"
              :key="link.to"
              :to="link.to"
              role="menuitem"
              :class="{ active: isActive(link.to), cloud: link.cloud }"
            >{{ link.label }}</router-link>
            <template v-if="!isMobileDevice">
              <div class="more-sep" />
              <a href="#" role="menuitem" @click.prevent="$emit('mobile-view')">Mobile view</a>
            </template>
          </div>
        </div>
      </nav>

      <div class="account">
        <ThemeToggle />
        <UserChip :to="accountLink" title="Your account" />
        <button class="logout" title="Log out" aria-label="Log out" @click="$emit('logout')">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 17l5-5-5-5M20 12H9" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 6%, transparent);
}
.inner {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.brand-link {
  text-decoration: none;
}

.links {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
}
.links > a,
.more-btn {
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--muted);
  text-decoration: none;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.2s, background 0.2s;
}
.links > a:hover,
.more-btn:hover {
  color: var(--text);
}
.links > a.active,
.more-btn.active {
  color: var(--text);
  background: color-mix(in srgb, var(--ink) 7%, transparent);
}

.more {
  position: relative;
}
.more-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  cursor: pointer;
}
.more-btn:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}
.more-btn svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.2s;
}
.more-btn.open svg {
  transform: rotate(180deg);
}
.more-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 190px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  box-shadow: 0 16px 40px color-mix(in srgb, var(--shadow-ink) 30%, transparent);
  animation: ui-rise 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.more-menu a {
  padding: 9px 12px;
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
  font-size: 0.93rem;
  transition: background 0.15s;
}
.more-menu a:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.more-menu a.active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  font-weight: 600;
}
.more-menu a.cloud {
  color: var(--cloud-ink);
}
.more-sep {
  height: 1px;
  margin: 6px 4px;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.account {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.logout {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid transparent;
  background: none;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}
.logout:hover {
  color: var(--danger-ink);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--danger) 30%, transparent);
}
.logout:focus-visible {
  outline: 2px solid var(--danger);
  outline-offset: 2px;
}
.logout svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Narrower desktop windows: tighten the pills and drop the user's name. */
@media (max-width: 1060px) {
  .inner {
    gap: 12px;
  }
  .links > a,
  .more-btn {
    padding: 8px 10px;
  }
  .account :deep(.name) {
    display: none;
  }
  .account :deep(.user-chip) {
    padding-right: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .more-menu { animation: none; }
}
</style>
