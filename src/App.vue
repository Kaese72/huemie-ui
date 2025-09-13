<script setup>
</script>

<template>
  <div class="app-layout">
    <nav class="sidebar">
      <ul>
        <li>
          <router-link to="/home">Home</router-link>
        </li>
        <li>
          <router-link to="/devices">Devices</router-link>
        </li>
        <li>
          <router-link to="/groups">Groups</router-link>
        </li>
      </ul>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  min-height: 0;
}
.sidebar {
  width: 200px;
  background: #222e3a;
  color: #fff;
  padding: 1.5rem 0 1.5rem 0;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  flex-shrink: 0;
}
.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.sidebar li {
  margin: 1rem 0;
  text-align: center;
}
.sidebar a {
  color: #fff;
  text-decoration: none;
  font-size: 1.2rem;
  transition: color 0.2s;
}
.sidebar a.router-link-active {
  font-weight: bold;
  color: #42b983;
}
.main-content {
  width: calc(100% - 200px);
  padding: 1.5rem 1.5rem 1.5rem 1.5rem;
  background: #f7f9fa;
  overflow-y: hidden;
  min-height: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
</style>
<style>
body, html, #app {
  margin: 0;
}
</style>