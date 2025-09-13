<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useRouter, useRoute } from 'vue-router'

const groups = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()
const knownAttributes = ['name'] // Adjust as needed

onMounted(async () => {
  try {
    const response = await axios.get('/device-store/v0/groups')
    groups.value = response.data
  } catch (err) {
    error.value = err
  }
})

function onRowClick(group) {
  if (selectedId.value == group.id) {
    router.push({ name: 'Groups' })
  } else {
    router.push({ name: 'GroupDetail', params: { id: group.id } })
  }
}

const selectedId = computed(() => route.params.id)
</script>

<template>
  <div class="group-split-layout">
    <div class="group-table" :class="{ 'half': selectedId }">
      <h1>Groups</h1>
      <div v-if="error">Error: {{ error.message }}</div>
      <div class="table-wrapper">
        <div class="table-header">
          <div class="table-cell id-cell">ID</div>
          <div v-for="attr in knownAttributes" :key="attr" class="table-cell attr-cell">{{ attr }}</div>
        </div>
        <div v-for="group in groups" :key="group.id" @click="onRowClick(group)" :class="['table-row', { selected: group.id === selectedId }]">
          <div class="table-cell id-cell" :title="group.id">{{ group.id }}</div>
          <div v-for="attr in knownAttributes" :key="group.id + '-' + attr" class="table-cell attr-cell" :title="group[attr]">
            {{ group[attr] }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="selectedId" class="group-detail-half">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.group-split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.group-table {
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
.group-table.half {
  flex: 1;
  max-width: 50%;
}
.group-detail-half {
  flex: 1;
  max-width: 50%;
  border-left: 1px solid #ddd;
  padding-left: 2rem;
  background: #fff;
  overflow-y: auto;
}
.table-wrapper {
  width: 100%;
  height: 100%;
  flex: 1 1 0;
  overflow-x: auto;
  overflow-y: hidden;
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
  width: 180px;
  padding: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}
.id-cell {
  min-width: 80px;
  max-width: 80px;
  width: 80px;
  font-weight: bold;
}
.attr-cell {
  text-transform: capitalize;
}
</style>
