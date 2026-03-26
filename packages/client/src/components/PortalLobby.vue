<template>
  <section class="panel lobby-panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Matchmaking Hub</p>
        <h2 class="panel-title">Lobby</h2>
        <p class="lobby-presence">
          {{ lobbyCount }} {{ lobbyCount === 1 ? "person" : "people" }} browsing the lobby
        </p>
      </div>

      <label class="player-chip">
        <span class="player-label">Player:</span>
        <input
          v-model="nameDraft"
          type="text"
          maxlength="16"
          class="player-input"
          data-testid="name-input"
          @blur="commitName"
          @keydown.enter.prevent="commitName"
        />
      </label>
    </div>

    <div class="room-list">
      <p v-if="loading" class="status">Loading rooms...</p>
      <p v-else-if="rooms.length === 0" class="status">No rooms available. Create one.</p>

      <div
        v-for="room in rooms"
        :key="room.roomId"
        class="room-row"
        :data-testid="`room-${room.roomId}`"
      >
        <div class="room-copy">
          <span class="room-name">{{ room.metadata?.roomName ?? "RPS Game" }}</span>
          <span class="room-format">{{ room.metadata?.matchFormat === 5 ? "Best of 5" : "Best of 3" }}</span>
        </div>

        <span :class="['player-count', room.clients >= 2 ? 'full' : 'open']">
          {{ room.clients }}/2 players
        </span>

        <button
          class="row-action"
          :class="room.clients >= 2 ? 'spectate' : 'join'"
          :data-testid="room.clients >= 2 ? 'spectate-btn' : 'join-btn'"
          @click="joinRoom(room.roomId, room.clients >= 2)"
        >
          {{ room.clients >= 2 ? "Spectate" : "Join" }}
        </button>
      </div>
    </div>

    <div v-if="showCreatePanel" class="overlay" @click.self="showCreatePanel = false">
      <div class="create-panel">
        <p class="eyebrow">New Match</p>
        <h3 class="create-title">Choose a format</h3>
        <div class="format-grid">
          <button class="format-button" data-testid="bo3-btn" @click="createRoom(MatchFormat.BestOf3)">
            Best of 3
          </button>
          <button class="format-button" data-testid="bo5-btn" @click="createRoom(MatchFormat.BestOf5)">
            Best of 5
          </button>
        </div>
        <button class="ghost-button" @click="showCreatePanel = false">Cancel</button>
      </div>
    </div>

    <div class="actions">
      <button class="primary-button" data-testid="create-room-btn" @click="showCreatePanel = true">
        Create Room
      </button>
      <button class="secondary-button" @click="void refreshRooms()">Refresh</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { MatchFormat } from "@rps/shared";
import { network } from "../network/client";
import { setPlayerName } from "../lib/player-name";

interface RoomInfo {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: { roomName: string; matchFormat: number };
}

const props = defineProps<{
  playerName: string;
}>();

const emit = defineEmits<{
  "update:playerName": [value: string];
}>();

const router = useRouter();
const rooms = ref<RoomInfo[]>([]);
const lobbyCount = ref(0);
const loading = ref(true);
const showCreatePanel = ref(false);
const nameDraft = ref(props.playerName);
let unsubscribeRooms: (() => void) | null = null;
let unsubscribeLobbyCount: (() => void) | null = null;

watch(() => props.playerName, (value) => {
  if (value !== nameDraft.value) {
    nameDraft.value = value;
  }
});

onMounted(() => {
  void subscribeToRooms();
  void subscribeToLobbyCount();
});

onUnmounted(() => {
  unsubscribeRooms?.();
  unsubscribeLobbyCount?.();
});

function commitName() {
  const next = setPlayerName(nameDraft.value);
  nameDraft.value = next;
  emit("update:playerName", next);
}

async function refreshRooms() {
  try {
    rooms.value = (await network.getAvailableRooms()) as RoomInfo[];
  } catch {
    rooms.value = [];
  } finally {
    loading.value = false;
  }
}

async function subscribeToRooms() {
  loading.value = true;
  try {
    unsubscribeRooms = await network.subscribeAvailableRooms((nextRooms) => {
      rooms.value = nextRooms as RoomInfo[];
      loading.value = false;
    });
  } catch {
    rooms.value = [];
    loading.value = false;
  }
}

async function subscribeToLobbyCount() {
  try {
    unsubscribeLobbyCount = await network.subscribeLobbyCount((count) => {
      lobbyCount.value = count;
    });
  } catch {
    lobbyCount.value = 0;
  }
}

async function createRoom(matchFormat: MatchFormat) {
  showCreatePanel.value = false;

  try {
    const nextName = setPlayerName(nameDraft.value);
    emit("update:playerName", nextName);
    await network.createRoom(nextName, matchFormat);
    void router.push("/game");
  } catch (err) {
    console.error("Failed to create room:", err);
  }
}

async function joinRoom(roomId: string, spectate: boolean) {
  try {
    const nextName = setPlayerName(nameDraft.value);
    emit("update:playerName", nextName);
    await network.joinRoom(roomId, nextName, spectate);
    void router.push({ path: "/game", query: { spectating: spectate ? "1" : undefined } });
  } catch (err) {
    console.error("Failed to join room:", err);
  }
}
</script>

<style scoped>
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 100%;
  padding: 28px;
  border: 1px solid rgba(244, 196, 48, 0.18);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(15, 28, 52, 0.94), rgba(7, 14, 29, 0.98)),
    radial-gradient(circle at top right, rgba(255, 122, 89, 0.2), transparent 42%);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.eyebrow {
  color: rgba(248, 206, 85, 0.72);
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.panel-title {
  margin-top: 8px;
  font-size: 34px;
  color: #fff6d6;
}

.lobby-presence {
  margin-top: 10px;
  color: rgba(255, 240, 194, 0.7);
  font-size: 13px;
}

.player-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 1px solid rgba(248, 206, 85, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}

.player-label {
  color: rgba(255, 240, 194, 0.72);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.player-input {
  width: 150px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 16px;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  outline: none;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 320px;
}

.status {
  margin: auto 0;
  color: rgba(255, 240, 194, 0.62);
  font-size: 16px;
}

.room-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.035);
}

.room-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-name {
  color: #fff8e1;
  font-size: 18px;
}

.room-format {
  color: rgba(255, 240, 194, 0.58);
  font-size: 13px;
}

.player-count {
  min-width: 86px;
  text-align: right;
  font-size: 13px;
}

.player-count.open {
  color: #84f7c3;
}

.player-count.full {
  color: #ff9a80;
}

.row-action,
.primary-button,
.secondary-button,
.format-button,
.ghost-button {
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  transition: transform 0.18s ease, opacity 0.18s ease, background 0.18s ease;
}

.row-action:hover,
.primary-button:hover,
.secondary-button:hover,
.format-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.row-action {
  padding: 10px 16px;
  color: #05111e;
  font-size: 13px;
  font-weight: 700;
}

.row-action.join {
  background: linear-gradient(135deg, #9cffcb, #5bd7b2);
}

.row-action.spectate {
  background: linear-gradient(135deg, #ffe18f, #f4c430);
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.primary-button,
.secondary-button {
  flex: 1;
  padding: 14px 18px;
  color: #08111f;
  font-size: 15px;
  font-weight: 700;
}

.primary-button {
  background: linear-gradient(135deg, #ffb36b, #ff7a59);
}

.secondary-button {
  background: linear-gradient(135deg, #f4c430, #ffe18f);
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border-radius: 28px;
  background: rgba(3, 7, 16, 0.7);
  backdrop-filter: blur(4px);
}

.create-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(100%, 340px);
  padding: 24px;
  border: 1px solid rgba(248, 206, 85, 0.24);
  border-radius: 24px;
  background: rgba(10, 21, 41, 0.96);
}

.create-title {
  color: #fff8e1;
  font-size: 24px;
}

.format-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.format-button {
  padding: 14px;
  background: rgba(255, 255, 255, 0.07);
  color: #fff6d6;
  font-size: 14px;
}

.ghost-button {
  padding: 10px 14px;
  background: transparent;
  color: rgba(255, 240, 194, 0.72);
  font-size: 13px;
}

@media (max-width: 640px) {
  .panel {
    padding: 22px;
  }

  .panel-head {
    flex-direction: column;
  }

  .player-chip {
    width: 100%;
  }

  .player-input {
    width: 100%;
  }

  .room-row {
    grid-template-columns: 1fr;
  }

  .player-count {
    text-align: left;
  }

  .actions {
    flex-direction: column;
  }

  .format-grid {
    grid-template-columns: 1fr;
  }
}
</style>
