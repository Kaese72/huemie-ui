<script setup>
import { onMounted } from 'vue'
import { useMobileTitle } from '../composables/useMobileTitle.js'

const { title } = useMobileTitle()
onMounted(() => { title.value = 'Huemie' })
</script>

<template>
  <button class="category-card" @click="$router.push({ name: 'MobileGroups' })">
    <span class="category-icon">👥</span>
    <span class="category-label">Groups</span>
  </button>
  <button class="category-card" @click="$router.push({ name: 'MobileDevices' })">
    <span class="category-icon">💡</span>
    <span class="category-label">Devices</span>
  </button>
</template>

<style scoped>
.category-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 1.75rem 1.5rem;
  background: #fff;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.15s;
}

.category-card:active {
  background: #e6f7ff;
}

.category-icon {
  font-size: 2rem;
}

.category-label {
  font-size: 1.4rem;
  font-weight: 700;
  color: #222e3a;
}
</style>
