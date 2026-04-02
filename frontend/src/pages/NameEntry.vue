<template>
  <div class="name-entry">
    <h1 class="title">Rock Paper Scissors</h1>
    <p class="subtitle">Multiplayer</p>
    <form class="form" @submit.prevent="submit">
      <input
        ref="inputRef"
        v-model="name"
        type="text"
        placeholder="Enter your name..."
        maxlength="16"
        class="input"
        :class="{ error: showError }"
        data-testid="name-input"
      />
      <button type="submit" class="btn btn-primary" data-testid="play-btn">PLAY</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const name = ref("");
const showError = ref(false);
const inputRef = ref<HTMLInputElement>();

onMounted(() => {
  inputRef.value?.focus();
});

function submit() {
  const trimmed = name.value.trim();
  if (!trimmed) {
    showError.value = true;
    return;
  }
  showError.value = false;
  sessionStorage.setItem("playerName", trimmed);
  void router.push("/lobby");
}
</script>

<style scoped>
.name-entry {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
}

.title {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(28px, 8vw, 48px);
  font-weight: 900;
  color: var(--neon-pink, #ff2d6a);
  text-shadow: 0 0 20px rgba(255, 45, 106, 0.5);
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.subtitle {
  font-size: clamp(16px, 4vw, 24px);
  color: var(--neon-cyan, #00f0ff);
  text-transform: uppercase;
  letter-spacing: 0.3em;
  margin-bottom: 40px;
  opacity: 0.8;
}

.form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}

.input {
  font-size: 18px;
  padding: 14px 20px;
  border: 2px solid var(--neon-pink, #ff2d6a);
  border-radius: 12px;
  background: rgba(22, 33, 62, 0.9);
  color: #ffffff;
  text-align: center;
  outline: none;
  font-family: 'IBM Plex Mono', monospace;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input.error {
  border-color: #ff0000;
  animation: shake 0.4s ease;
}

.input:focus {
  border-color: var(--neon-cyan, #00f0ff);
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.3);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.btn {
  padding: 14px 48px;
  border: none;
  border-radius: 12px;
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.btn-primary {
  background: linear-gradient(135deg, var(--neon-pink, #ff2d6a), #ff6b81);
  color: #ffffff;
  box-shadow: 0 4px 20px rgba(255, 45, 106, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 28px rgba(255, 45, 106, 0.6);
}

.btn-primary:active {
  transform: translateY(0);
}

@media (max-width: 480px) {
  .title {
    margin-bottom: 2px;
  }

  .subtitle {
    margin-bottom: 32px;
  }

  .input {
    font-size: 16px;
    padding: 12px 16px;
  }

  .btn {
    padding: 12px 36px;
    font-size: 14px;
    width: 100%;
  }
}
</style>
