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
}

.title {
  font-size: 48px;
  color: #e94560;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 24px;
  color: #16213e;
  margin-bottom: 48px;
}

.form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.input {
  font-size: 20px;
  padding: 10px 20px;
  border: 2px solid #e94560;
  border-radius: 8px;
  background: #16213e;
  color: #ffffff;
  text-align: center;
  outline: none;
  font-family: monospace;
  width: 280px;
}

.input.error {
  border-color: #ff0000;
}

.input:focus {
  border-color: #ff6b81;
}

.btn {
  padding: 12px 40px;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #e94560;
  color: #ffffff;
}

.btn-primary:hover {
  background: #ff6b81;
}
</style>
