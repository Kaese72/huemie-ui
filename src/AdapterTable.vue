<script setup>

import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'

const adapters = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  try {
    const response = await axios.get('/adapter-attendant/v1/adapters')
    adapters.value = response.data || []
  } catch (err) {
    error.value = err
  }
})

function onRowClick(adapterId) {
  if (selectedId.value === String(adapterId)) {
    // If already selected, close detail view
    router.push({ name: 'Adapters' });
  } else {
    router.push({ name: 'AdapterDetail', params: { id: adapterId } });
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="adapter-split-layout">
    <div class="adapter-table" :class="{ 'half': selectedId }">
      <h1>Adapters</h1>
      <div v-if="error">Error: {{ error.message }}</div>
      <div class="table-wrapper">
        <div class="table-header">
          <div class="table-cell id-cell">ID</div>
          <div class="table-cell name-cell">Name</div>
          <div class="table-cell">Image</div>
          <div class="table-cell">Tag</div>
          <div class="table-cell">Synced</div>
        </div>
        <div v-for="adapter in adapters" :key="adapter.id" @click="onRowClick(adapter.id)" :class="['table-row', { selected: String(adapter.id) === selectedId }]">
          <div class="table-cell id-cell" :title="String(adapter.id)">{{ adapter.id }}</div>
          <div class="table-cell name-cell" :title="adapter.name">{{ adapter.name }}</div>
          <div class="table-cell" :title="adapter.imageName">{{ adapter.imageName }}</div>
          <div class="table-cell" :title="adapter.imageTag">{{ adapter.imageTag }}</div>
          <div class="table-cell" :title="adapter.synced || 'Not synced'">{{ adapter.synced || 'Not synced' }}</div>
        </div>
      </div>
    </div>
    <div v-if="selectedId" class="adapter-detail-half">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.adapter-split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.adapter-table {
  flex: 1 1 0;
  min-width: 0;
  transition: flex 0.3s;
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.adapter-table.half {
  flex: 1;
  max-width: 50%;
}
.adapter-detail-half {
  flex: 1;
  max-width: 50%;
  border-left: 1px solid #ddd;
  padding-left: 2rem;
  background: #fff;
  overflow-y: auto;
}
/* Table-like flex layout */
.table-wrapper {
  width: 100%;
  height: 100%;
  flex: 1 1 0;
  overflow-x: auto;
  overflow-y: auto;
  box-sizing: border-box;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: max-content;
  box-sizing: border-box;
}
.table-header {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  position: sticky;
  top: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
}
.table-row {
  cursor: pointer;
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
}
.table-row.selected {
  background: #e6f7ff;
}
.table-cell {
  min-width: 240px;
  max-width: 240px;
  width: 240px;
  padding: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}
.name-cell {
  min-width: 300px;
  max-width: 300px;
  width: 300px;
  font-weight: bold;
}
.id-cell {
  min-width: 80px;
  max-width: 80px;
  width: 80px;
  font-weight: bold;
}
</style>
