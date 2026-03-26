<template>
  <div class="leaderboard">
    <div class="header">
      <button class="btn-back" @click="$router.push('/lobby')">&lt; BACK</button>
      <h1 class="title">LEADERBOARD</h1>
    </div>

    <p v-if="loading" class="status">Loading...</p>
    <p v-else-if="entries.length === 0" class="status">No matches played yet</p>

    <table v-else class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>NAME</th>
          <th>WINS</th>
          <th>LOSSES</th>
          <th>DRAWS</th>
          <th>GAMES</th>
          <th>WIN RATE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, i) in entries" :key="entry.playerName" :class="{ top: i < 3 }">
          <td :class="{ rank: i < 3 }">{{ i + 1 }}</td>
          <td>{{ entry.playerName }}</td>
          <td>{{ entry.wins }}</td>
          <td>{{ entry.losses }}</td>
          <td>{{ entry.draws }}</td>
          <td>{{ entry.wins + entry.losses + entry.draws }}</td>
          <td>{{ (entry.winRate * 100).toFixed(0) }}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { LeaderboardEntry } from "@rps/shared";
import { SERVER_HTTP_URL } from "../network/client";
const entries = ref<LeaderboardEntry[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await fetch(`${SERVER_HTTP_URL}/api/leaderboard?limit=15`);
    entries.value = await res.json() as LeaderboardEntry[];
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.leaderboard {
  width: 100%;
  max-width: 800px;
  padding: 24px;
}

.header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
}

.btn-back {
  background: #16213e;
  border: none;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 14px;
  cursor: pointer;
}

.btn-back:hover { opacity: 0.8; }

.title {
  font-size: 36px;
  color: #e94560;
}

.status {
  text-align: center;
  color: #8899aa;
  font-size: 18px;
  margin-top: 80px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-family: monospace;
}

th {
  text-align: left;
  color: #8899aa;
  font-size: 14px;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
}

td {
  padding: 10px 12px;
  font-size: 16px;
}

tr.top {
  background: rgba(233, 69, 96, 0.08);
}

td.rank {
  color: #e94560;
  font-weight: bold;
}
</style>
