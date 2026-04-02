<template>
  <section class="panel leaderboard-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Rankings</p>
        <h2 class="panel-title">Leaderboard</h2>
      </div>

      <button class="refresh-button" @click="void loadEntries()">Refresh</button>
    </div>

    <p v-if="loading" class="status">Loading standings...</p>
    <p v-else-if="entries.length === 0" class="status">No matches played yet.</p>

    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>W</th>
            <th>L</th>
            <th>D</th>
            <th>Games</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in entries" :key="entry.playerName" :class="{ top: index < 3 }">
            <td class="rank">{{ index + 1 }}</td>
            <td class="player-cell">{{ entry.playerName }}</td>
            <td>{{ entry.wins }}</td>
            <td>{{ entry.losses }}</td>
            <td>{{ entry.draws }}</td>
            <td>{{ entry.wins + entry.losses + entry.draws }}</td>
            <td>{{ (entry.winRate * 100).toFixed(0) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import type { LeaderboardEntry } from "@rps/shared";
import { SERVER_HTTP_URL } from "../network/client";

const entries = ref<LeaderboardEntry[]>([]);
const loading = ref(true);
let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void loadEntries();
  refreshInterval = setInterval(() => void loadEntries(), 5000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

async function loadEntries() {
  try {
    const response = await fetch(`${SERVER_HTTP_URL}/api/leaderboard?limit=15`);
    if (!response.ok) {
      entries.value = [];
      return;
    }

    entries.value = await response.json() as LeaderboardEntry[];
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  padding: 28px;
  border: 1px solid rgba(244, 196, 48, 0.18);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(10, 22, 43, 0.95), rgba(7, 14, 29, 0.98)),
    radial-gradient(circle at top left, rgba(91, 215, 178, 0.18), transparent 38%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.eyebrow {
  color: rgba(132, 247, 195, 0.72);
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.panel-title {
  margin-top: 8px;
  font-size: 34px;
  color: #e9fff7;
}

.refresh-button {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.07);
  color: #e9fff7;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}

.refresh-button:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.12);
}

.status {
  margin: auto 0;
  color: rgba(233, 255, 247, 0.68);
  font-size: 16px;
}

.table-wrap {
  overflow: auto;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 14px 16px;
  text-align: left;
}

thead {
  background: rgba(255, 255, 255, 0.04);
}

th {
  color: rgba(233, 255, 247, 0.62);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

tbody tr {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

tbody tr.top {
  background: rgba(132, 247, 195, 0.08);
}

td {
  color: #f5fffb;
  font-size: 15px;
}

.rank {
  width: 64px;
  color: #84f7c3;
  font-weight: 700;
}

.player-cell {
  font-weight: 700;
}

@media (max-width: 640px) {
  .panel {
    padding: 22px;
  }

  .panel-head {
    flex-direction: column;
  }
}
</style>
