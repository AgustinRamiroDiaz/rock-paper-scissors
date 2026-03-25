<template>
  <div class="app">
    <router-view />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0f0f23;
  color: #ffffff;
  font-family: monospace;
  min-height: 100vh;
}

.app {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
</style>
