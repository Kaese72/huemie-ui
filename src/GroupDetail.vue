<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import CapabilityDialog from './components/CapabilityDialog.vue'

const route = useRoute()
const router = useRouter()
const group = ref(null)
const error = ref(null)
const showDialog = ref(false)
const selectedCapability = ref(null)
const triggerAudits = ref([])
const activeTab = computed(() => route.params.tab)

async function fetchGroup() {
	group.value = null;
	error.value = null;
	try {
		const response = await axios.get(`/device-store/v0/groups/${route.params.id}`)
		group.value = response.data
		triggerAudits.value = []
	} catch (err) {
		error.value = err
	}
}

onMounted(fetchGroup)
watch(() => route.params.id, fetchGroup)
watch(activeTab, (tab) => {
	if (tab === 'history' && triggerAudits.value.length === 0) refreshAudits()
})

function selectTab(tab) {
	router.push({ name: 'GroupDetail', params: { id: route.params.id, tab } })
}

function openCapabilityDialog(capability) {
	selectedCapability.value = capability
	showDialog.value = true
}

function closeDialog() {
	showDialog.value = false
	selectedCapability.value = null
}

async function forgetGroup() {
	if (!group.value) return
	const accepted = window.confirm(`Forget group ${group.value.id}?`)
	if (!accepted) return
	try {
		await axios.delete(`/device-store/v0/groups/${group.value.id}`)
		window.dispatchEvent(new CustomEvent('group-forgotten', { detail: { id: group.value.id } }))
		await router.push({ name: 'Groups' })
	} catch (err) {
		error.value = err
	}
}

async function refreshAudits() {
	if (!route.params.id) return
	try {
		const response = await axios.get(`/device-store/v0/groups/${route.params.id}/capability-trigger-audits`)
		triggerAudits.value = response.data || []
	} catch (err) {
		console.error('Error fetching trigger audits:', err)
	}
}

function triggerCapability(argumentValues) {
	if (!group.value || !selectedCapability.value) return
	axios.post(
		`/device-store/v0/groups/${group.value.id}/capabilities/${selectedCapability.value.name}`,
		argumentValues
	)
		.then(() => {
			closeDialog()
			if (activeTab.value === 'history') refreshAudits()
		})
		.catch(err => {
			console.error('Error triggering capability:', err)
			if (activeTab.value === 'history') refreshAudits()
		})
}
</script>

<template>
	<div v-if="error">Error: {{ error.message }}</div>
	<div v-else-if="group">
		<h2>Group Details: {{ group.id }}</h2>
		<div class="group-meta">
			<strong>Name:</strong> {{ group.name }}<br>
			<strong>Bridge identifier:</strong> {{ group['bridge-identifier'] }}<br>
			<strong>Last updated:</strong> {{ group.updated || 'Unknown' }}
		</div>

		<div class="tabs">
			<button class="tab" :class="{ active: activeTab === 'state' }" @click="selectTab('state')">State</button>
			<button class="tab" :class="{ active: activeTab === 'history' }" @click="selectTab('history')">Trigger History</button>
		</div>

		<div v-if="activeTab === 'state'">
			<div v-if="group.capabilities && group.capabilities.length">
				<h3>Capabilities</h3>
				<table class="data-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Updated</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="cap in group.capabilities" :key="cap.name">
							<td>{{ cap.name }}</td>
							<td>{{ cap.updated || 'Unknown' }}</td>
							<td>
								<button class="trigger-button" @click="openCapabilityDialog(cap)">
									Trigger {{ cap.name }}
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<div v-if="activeTab === 'history'">
			<div v-if="!triggerAudits.length" class="empty-state">No capability triggers recorded yet.</div>
			<table v-else class="data-table">
				<thead>
					<tr>
						<th>Capability</th>
						<th>Time</th>
						<th>Result</th>
						<th>Arguments</th>
						<th>Error</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="audit in triggerAudits" :key="audit.id">
						<td>{{ audit.name }}</td>
						<td>{{ audit.timestamp }}</td>
						<td :class="audit.success ? 'audit-success' : 'audit-failure'">
							{{ audit.success ? 'Success' : 'Failed' }}
						</td>
						<td><code>{{ audit.arguments }}</code></td>
						<td>{{ audit['error-message'] || '' }}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="forget-section">
			<button class="forget-button" @click="forgetGroup">Forget group</button>
		</div>

		<CapabilityDialog
			v-if="selectedCapability"
			:capability="selectedCapability"
			:show="showDialog"
			@close="closeDialog"
			@trigger="triggerCapability"
		/>
	</div>
	<div v-else>Loading...</div>
</template>

<style scoped>
.group-meta {
	margin-bottom: 1rem;
}
.tabs {
	display: flex;
	gap: 0.25rem;
	margin-bottom: 1rem;
	border-bottom: 2px solid #ddd;
}
.tab {
	padding: 0.5rem 1rem;
	border: none;
	background: none;
	cursor: pointer;
	font-size: 1rem;
	border-bottom: 2px solid transparent;
	margin-bottom: -2px;
}
.tab.active {
	border-bottom-color: #42b983;
	color: #42b983;
	font-weight: bold;
}
.data-table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 1rem;
}
.data-table th,
.data-table td {
	border: 1px solid #ddd;
	padding: 0.5rem;
	text-align: left;
}
.data-table th {
	background: #f5f5f5;
}
.trigger-button {
	padding: 0.5rem 1rem;
	background: #42b983;
	color: #fff;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background 0.2s;
}
.trigger-button:hover {
	background: #369870;
}
.forget-section {
	margin-top: 1rem;
}
.forget-button {
	padding: 0.5rem 1rem;
	background: #42b983;
	color: #fff;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	transition: background 0.2s;
}
.forget-button:hover {
	background: #369870;
}
.audit-success {
	color: #2a9d5c;
	font-weight: bold;
}
.audit-failure {
	color: #c0392b;
	font-weight: bold;
}
.empty-state {
	color: #888;
	font-style: italic;
	margin-bottom: 1rem;
}
</style>
