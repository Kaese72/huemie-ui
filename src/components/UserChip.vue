<script setup>
import { computed } from 'vue'
import { useCurrentUser } from '../composables/useCurrentUser.js'

// Avatar (initials) + name, linking somewhere account-related.
defineProps({
  to: { type: String, required: true },
  title: { type: String, default: '' },
  arrow: { type: Boolean, default: false },
})

const { user } = useCurrentUser()

const displayName = computed(() => {
  if (!user.value) return ''
  return [user.value.name, user.value.surname].filter(Boolean).join(' ') || user.value.username || ''
})

const initials = computed(() => {
  const parts = displayName.value.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join('') || '•'
})
</script>

<template>
  <router-link :to="to" class="user-chip" :title="title">
    <span class="avatar">{{ initials }}</span>
    <span class="name">{{ displayName || 'Your account' }}</span>
    <span v-if="arrow" class="arrow" aria-hidden="true">→</span>
  </router-link>
</template>

<style scoped>
.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px 4px 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  transition: background 0.2s, border-color 0.2s;
}
.user-chip:hover,
.user-chip.router-link-active {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  border-color: color-mix(in srgb, var(--green) 60%, transparent);
}
.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--warm), var(--green));
  color: var(--on-warm);
  font-weight: 700;
  font-size: 0.8rem;
}
.name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrow {
  color: var(--green-ink);
  transition: transform 0.2s;
}
.user-chip:hover .arrow {
  transform: translateX(3px);
}

@media (max-width: 640px) {
  .name {
    max-width: 90px;
  }
}
</style>
