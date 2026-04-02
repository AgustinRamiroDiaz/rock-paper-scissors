<template>
  <div class="app">
    <router-view />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

:root {
  color-scheme: dark;
  --page-bg: #07101f;
  --page-bg-soft: #112443;
  --text-main: #f7f2dd;
  --neon-pink: #ff2d6a;
  --neon-cyan: #00f0ff;
  --neon-amber: #ffd426;
  --neon-green: #00ff88;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  min-height: 100%;
}

body {
  background:
    radial-gradient(circle at top left, rgba(255, 179, 107, 0.16), transparent 28%),
    radial-gradient(circle at bottom right, rgba(91, 215, 178, 0.14), transparent 24%),
    linear-gradient(180deg, var(--page-bg-soft), var(--page-bg));
  color: var(--text-main);
  font-family: "IBM Plex Mono", "Courier New", monospace;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app {
  display: flex;
  width: 100%;
  min-height: 100vh;
  padding: 32px;
}

@media (max-width: 640px) {
  .app {
    padding: 12px;
    align-items: flex-start;
  }
}

@media (max-width: 400px) {
  .app {
    padding: 8px;
  }
}
</style>
