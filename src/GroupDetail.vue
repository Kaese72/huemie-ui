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
	<div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
	<div v-else-if="group">
		<div class="detail-head">
			<h2 class="detail-title">{{ group.name }}</h2>
		</div>
		<div class="detail-meta">
			<span><strong>ID</strong> <span class="mono">{{ group.id }}</span></span>
			<span><strong>Bridge identifier</strong> <span class="mono">{{ group['bridge-identifier'] }}</span></span>
			<span><strong>Last updated</strong> {{ group.updated || 'Unknown' }}</span>
		</div>

		<div class="tabs">
			<button class="tab" :class="{ active: activeTab === 'state' }" @click="selectTab('state')">State</button>
			<button class="tab" :class="{ active: activeTab === 'history' }" @click="selectTab('history')">Trigger history</button>
		</div>

		<div v-if="activeTab === 'state'">
			<div v-if="group.capabilities && group.capabilities.length">
				<h3 class="section-title">Capabilities</h3>
				<div class="capabilities">
					<button
						v-for="cap in group.capabilities"
						:key="cap.name"
						class="btn btn-ghost btn-sm capability"
						:title="`Updated ${cap.updated || 'Unknown'}`"
						@click="openCapabilityDialog(cap)"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
						{{ cap.name }}
					</button>
				</div>
			</div>
			<p v-else class="empty">No capabilities.</p>
		</div>

		<div v-if="activeTab === 'history'">
			<p v-if="!triggerAudits.length" class="empty">No capability triggers recorded yet.</p>
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
						<td class="muted">{{ audit.timestamp }}</td>
						<td :class="audit.success ? 'text-ok' : 'text-fail'">
							{{ audit.success ? 'Success' : 'Failed' }}
						</td>
						<td><code>{{ audit.arguments }}</code></td>
						<td class="error-text">{{ audit['error-message'] || '' }}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="detail-footer">
			<button class="btn btn-danger btn-sm" @click="forgetGroup">Forget group</button>
		</div>

		<CapabilityDialog
			v-if="selectedCapability"
			:capability="selectedCapability"
			:show="showDialog"
			@close="closeDialog"
			@trigger="triggerCapability"
		/>
	</div>
	<p v-else class="empty">Loading…</p>
</template>

<style scoped>
.muted {
	color: var(--muted);
}
.error-text {
	color: var(--danger-ink);
}
</style>
