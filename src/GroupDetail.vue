<script setup>
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'

const route = useRoute()
const group = ref(null)
const error = ref(null)

async function fetchGroup() {
	group.value = null;
	error.value = null;
	try {
		const response = await axios.get(`/device-store/v0/groups/${route.params.id}`)
		group.value = response.data
	} catch (err) {
		error.value = err
	}
}

onMounted(fetchGroup)
watch(() => route.params.id, fetchGroup)

function triggerCapability(capability) {
	axios.post(`/device-store/v0/groups/${route.params.id}/capabilities/${capability}`)
		.then(response => {
			// Optionally show a success message
			console.log('Capability triggered successfully:', response.data);
		})
		.catch(error => {
			// Optionally show an error message
			console.error('Error triggering capability:', error);
		});
}
</script>


<template>
	<div v-if="error">Error: {{ error.message }}</div>
	<div v-else-if="group">
		<h2>Group Details</h2>
		<div><strong>ID:</strong> {{ group.id }}</div>
		<div><strong>Name:</strong> {{ group.name }}</div>
		<div><strong>Description:</strong> {{ group.description }}</div>
		<div><strong>Type:</strong> {{ group.type }}</div>
				<div v-if="group.capabilities && group.capabilities.length">
					<h3>Capabilities</h3>
					<div class="capabilities-list">
						<button v-for="cap in group.capabilities" :key="cap.name" @click="triggerCapability(cap.name)">
							Trigger {{ cap.name }}
						</button>
					</div>
				</div>
	</div>
	<div v-else>Loading...</div>
	</template>
<style scoped>
	.capabilities-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.capabilities-list button {
		padding: 0.5rem 1rem;
		background: #42b983;
		color: #fff;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}
	.capabilities-list button:hover {
		background: #369870;
	}
ul {
	list-style: none;
	padding: 0;
}
li {
	margin-bottom: 0.5rem;
}
</style>
