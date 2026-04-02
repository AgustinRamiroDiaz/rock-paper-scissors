<template>
  <div class="lobby">
    <div class="header">
      <h1 class="title">LOBBY</h1>
      <span class="player-name">Player: {{ playerName }}</span>
    </div>

    <div class="room-list">
      <p v-if="loading" class="status">Loading rooms...</p>
      <p v-else-if="rooms.length === 0" class="status">No rooms available. Create one!</p>

      <div v-for="room in rooms" :key="room.roomId" class="room-row" :data-testid="`room-${room.roomId}`">
        <span class="room-info">
          {{ room.metadata?.roomName ?? "RPS Game" }}
          [{{ room.metadata?.matchFormat === 5 ? "Bo5" : "Bo3" }}]
        </span>
        <span :class="['player-count', room.clients >= 2 ? 'full' : 'open']">
          {{ room.clients }}/2 players
        </span>
        <button
          class="btn btn-small"
          :class="room.clients >= 2 ? 'btn-spectate' : 'btn-join'"
          :data-testid="room.clients >= 2 ? 'spectate-btn' : 'join-btn'"
          @click="joinRoom(room.roomId, room.clients >= 2)"
        >
          {{ room.clients >= 2 ? "SPECTATE" : "JOIN" }}
        </button>
      </div>
    </div>

    <!-- Create room modal -->
    <div v-if="showCreatePanel" class="overlay" @click.self="showCreatePanel = false">
      <div class="panel">
        <h2 class="panel-title">CREATE ROOM</h2>
        <button class="btn btn-format" data-testid="bo3-btn" @click="createRoom(3)">Best of 3</button>
        <button class="btn btn-format" data-testid="bo5-btn" @click="createRoom(5)">Best of 5</button>
        <button class="btn-link" @click="showCreatePanel = false">Cancel</button>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" data-testid="create-room-btn" @click="showCreatePanel = true">CREATE ROOM</button>
      <button class="btn btn-secondary" @click="void refreshRooms()">REFRESH</button>
      <button class="btn btn-dark" @click="$router.push('/leaderboard')">LEADERBOARD</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { network } from "../network/client";
import type { MatchFormat } from "@rps/shared";

defineOptions({ name: "LobbyPage" });

interface RoomInfo {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: { roomName: string; matchFormat: number };
}

const router = useRouter();
const playerName = sessionStorage.getItem("playerName") ?? "Anonymous";
const rooms = ref<RoomInfo[]>([]);
const loading = ref(true);
const showCreatePanel = ref(false);
let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void refreshRooms();
  refreshInterval = setInterval(() => void refreshRooms(), 3000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

async function refreshRooms() {
  try {
    rooms.value = (await network.getAvailableRooms()) as RoomInfo[];
  } catch {
    // silently fail
  } finally {
    loading.value = false;
  }
}

async function createRoom(format: number) {
  showCreatePanel.value = false;
  try {
    await network.createRoom(playerName, format as MatchFormat);
    void router.push("/game");
  } catch (err) {
    console.error("Failed to create room:", err);
  }
}

async function joinRoom(roomId: string, spectate: boolean) {
  try {
    await network.joinRoom(roomId, playerName, spectate);
    void router.push({ path: "/game", query: { spectating: spectate ? "1" : "" } });
  } catch (err) {
    console.error("Failed to join room:", err);
  }
}
</script>

<style scoped>
.lobby {
  width: 100%;
  max-width: 800px;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.title {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(28px, 8vw, 36px);
  color: var(--neon-pink, #ff2d6a);
  text-shadow: 0 0 20px rgba(255, 45, 106, 0.4);
  letter-spacing: 0.05em;
}

.player-name {
  font-size: 14px;
  color: #8899aa;
}

.room-list {
  min-height: 300px;
  margin-bottom: 24px;
}

.status {
  text-align: center;
  color: #8899aa;
  font-size: 18px;
  margin-top: 100px;
}

.room-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #16213e;
  border-radius: 8px;
  margin-bottom: 8px;
}

.room-info {
  flex: 1;
  font-size: 18px;
}

.player-count {
  font-size: 14px;
}

.player-count.open { color: var(--neon-green, #00ff88); }
.player-count.full { color: var(--neon-pink, #ff2d6a); }

.actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover { opacity: 0.8; }

.btn-primary { background: var(--neon-pink, #ff2d6a); color: #fff; }
.btn-secondary { background: #533483; color: #fff; }
.btn-dark { background: #0f3460; color: #fff; }
.btn-join { background: var(--neon-green, #00ff88); color: #000; }
.btn-spectate { background: #533483; color: #fff; }
.btn-small { padding: 6px 16px; font-size: 13px; }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  padding: 16px;
}

.panel {
  background: #16213e;
  border: 2px solid var(--neon-pink, #ff2d6a);
  border-radius: 12px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 90vw;
}

.panel-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 24px;
  color: var(--neon-pink, #ff2d6a);
  margin-bottom: 8px;
}

.btn-format {
  width: 100%;
  padding: 12px;
  background: #533483;
  color: #fff;
  font-size: 18px;
}

.btn-format:hover { background: #6b44a0; }

.btn-link {
  background: none;
  border: none;
  color: #8899aa;
  font-family: monospace;
  font-size: 14px;
  cursor: pointer;
  margin-top: 4px;
}

/* Mobile styles */
@media (max-width: 640px) {
  .lobby {
    padding: 16px 12px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 20px;
  }

  .title {
    font-size: 26px;
  }

  .player-name {
    font-size: 12px;
  }

  .room-list {
    min-height: 250px;
    margin-bottom: 20px;
  }

  .room-row {
    flex-wrap: wrap;
    padding: 14px 12px;
    gap: 12px;
  }

  .room-info {
    font-size: 15px;
    width: 100%;
    flex-basis: 100%;
  }

  .player-count {
    font-size: 13px;
  }

  .room-row .btn-small {
    flex: 1;
    text-align: center;
  }

  .actions {
    flex-wrap: wrap;
    gap: 10px;
  }

  .actions .btn {
    flex: 1 1 calc(50% - 5px);
    min-width: 100px;
    padding: 12px 16px;
    font-size: 13px;
    text-align: center;
  }

  .panel {
    padding: 24px 20px;
    min-width: unset;
    width: 100%;
  }

  .panel-title {
    font-size: 20px;
  }

  .btn-format {
    padding: 14px;
    font-size: 16px;
  }
}

@media (max-width: 400px) {
  .room-info {
    font-size: 14px;
  }

  .actions .btn {
    font-size: 12px;
    padding: 10px 12px;
  }
}
</style>
