<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useMobileTitle } from '../composables/useMobileTitle.js'

const groups = ref([])
const error = ref(null)
const { title } = useMobileTitle()

onMounted(async () => {
  title.value = 'Groups'
  try {
    const response = await axios.get('/device-store/v0/groups')
    groups.value = response.data
  } catch (err) {
    error.value = err
  }
})
</script>

<template>
  <div v-if="error" class="error">Error: {{ error.message }}</div>
  <div v-else-if="groups.length === 0" class="empty">No groups found.</div>
  <button
    v-for="group in groups"
    :key="group.id"
    class="item-card"
    @click="$router.push({ name: 'MobileGroupDetail', params: { id: group.id } })"
  >
    <span class="item-name">{{ group.name }}</span>
    <span class="item-sub">{{ group.capabilities.length }} capabilities</span>
  </button>
</template>

<style scoped>
.item-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 1.25rem 1.5rem;
  background: #fff;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.item-card:active { background: #e6f7ff; }

.item-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #222e3a;
}

.item-sub {
  font-size: 0.875rem;
  color: #888;
  margin-top: 0.25rem;
}

.empty { color: #888; text-align: center; margin-top: 2rem; }
.error { color: #c0392b; }
</style>
