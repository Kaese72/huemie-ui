<template>
  <div class="not-found-container">
    <h1>404 - Page Not Found</h1>
    <p>The page you are looking for does not exist.</p>
    <router-link to="/home">Go to Home</router-link>
  </div>
</template>

<script setup>
// No script needed
</script>

<style scoped>
.not-found-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
}
.not-found-container a {
  margin-top: 1rem;
  color: #42b983;
  text-decoration: underline;
}
</style>
