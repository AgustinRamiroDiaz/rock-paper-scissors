<template>
  <section class="panel lobby-panel" aria-label="Game lobby">
    <div class="panel-head">
      <div>
        <p class="eyebrow">Matchmaking Hub</p>
        <h2 class="panel-title">Lobby</h2>
        <p class="lobby-presence" aria-live="polite">
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
          aria-label="Player name"
          @blur="commitName"
          @keydown.enter.prevent="commitName"
        />
      </label>
    </div>

    <div class="room-list" role="list" aria-label="Available rooms">
      <p v-if="loading" class="status" aria-live="polite">Loading rooms...</p>

      <div v-else-if="rooms.length === 0" class="empty-state">
        <div class="empty-icons" aria-hidden="true">
          <span class="empty-icon">🪨</span>
          <span class="empty-icon">📄</span>
          <span class="empty-icon">✂️</span>
        </div>
        <p class="empty-title">No battles yet</p>
        <p class="empty-hint">Create a room and start the first match!</p>
      </div>

      <TransitionGroup v-else name="room-list" tag="div" class="room-list-inner">
        <div
          v-for="room in rooms"
          :key="room.roomId"
          class="room-row"
          :data-testid="`room-${room.roomId}`"
          role="listitem"
        >
          <div class="room-copy">
            <span class="room-name">{{ room.metadata?.roomName ?? "RPS Game" }}</span>
            <span class="room-format">{{ room.metadata?.matchFormat === 5 ? "Best of 5" : "Best of 3" }}</span>
            <span class="room-meta">
              <span class="room-id">{{ room.roomId }}</span>
              <span v-if="room.metadata?.createdAt" class="room-age">{{ formatAge(room.metadata.createdAt) }}</span>
            </span>
          </div>

          <span :class="['player-count', isRoomFull(room) ? 'full' : 'open']">
            {{ getPlayerCount(room) }}/2 players
            <template v-if="getSpectatorCount(room) > 0"> · {{ getSpectatorCount(room) }} spectating</template>
          </span>

          <button
            class="row-action"
            :class="isRoomFull(room) ? 'spectate' : 'join'"
            :data-testid="isRoomFull(room) ? 'spectate-btn' : 'join-btn'"
            :aria-label="isRoomFull(room) ? `Spectate room ${room.metadata?.roomName ?? room.roomId}` : `Join room ${room.metadata?.roomName ?? room.roomId}`"
            @click="joinRoom(room.roomId, isRoomFull(room))"
          >
            {{ isRoomFull(room) ? "Spectate" : "Join" }}
          </button>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="showCreatePanel" class="overlay" role="dialog" aria-modal="true" aria-label="Create a new room" @click.self="showCreatePanel = false">
      <div class="create-panel">
        <p class="eyebrow">New Match</p>
        <h3 class="create-title">Choose a format</h3>
        <div class="format-grid" role="radiogroup" aria-label="Match format">
          <button
            :class="['format-button', selectedFormat === MatchFormat.BestOf3 ? 'selected' : '']"
            data-testid="bo3-btn"
            role="radio"
            :aria-checked="selectedFormat === MatchFormat.BestOf3"
            @click="selectedFormat = MatchFormat.BestOf3"
          >
            Best of 3
          </button>
          <button
            :class="['format-button', selectedFormat === MatchFormat.BestOf5 ? 'selected' : '']"
            data-testid="bo5-btn"
            role="radio"
            :aria-checked="selectedFormat === MatchFormat.BestOf5"
            @click="selectedFormat = MatchFormat.BestOf5"
          >
            Best of 5
          </button>
        </div>

        <label class="bot-toggle-label">
          <input v-model="allowBots" type="checkbox" class="bot-toggle-checkbox" data-testid="allow-bots-checkbox" />
          <span class="bot-toggle-text">Allow bots to join this room</span>
        </label>

        <div class="actions-row">
          <button class="primary-button" data-testid="confirm-create-btn" @click="confirmCreateRoom">Create Room</button>
          <button class="ghost-button" @click="cancelCreate">Cancel</button>
        </div>
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
  metadata?: {
    roomName: string;
    matchFormat: number;
    playerCount?: number;
    spectatorCount?: number;
    createdAt?: number;
  };
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
const selectedFormat = ref(MatchFormat.BestOf3);
const allowBots = ref(true);
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



function cancelCreate() {
   showCreatePanel.value = false;
   selectedFormat.value = MatchFormat.BestOf3;
   allowBots.value = true;
}

async function confirmCreateRoom() {
   showCreatePanel.value = false;

  try {
    const nextName = setPlayerName(nameDraft.value);
    emit("update:playerName", nextName);
    await network.createRoom(nextName, selectedFormat.value, allowBots.value);
    void router.push("/game");
  } catch (err) {
    console.error("Failed to create room:", err);
} finally {
     selectedFormat.value = MatchFormat.BestOf3;
     allowBots.value = true;
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

function getPlayerCount(room: RoomInfo): number {
  if (typeof room.metadata?.playerCount === "number") {
    return room.metadata.playerCount;
  }

  return Math.min(room.clients, 2);
}

function getSpectatorCount(room: RoomInfo): number {
  if (typeof room.metadata?.spectatorCount === "number") {
    return room.metadata.spectatorCount;
  }

  return Math.max(room.clients - getPlayerCount(room), 0);
}

function isRoomFull(room: RoomInfo): boolean {
  return getPlayerCount(room) >= 2;
}

function formatAge(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
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
  color: var(--neon-amber, #ffd426);
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.panel-title {
  margin-top: 8px;
  font-family: 'Orbitron', sans-serif;
  font-size: 34px;
  color: #fff6d6;
  font-weight: 700;
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

.player-input:focus-visible {
  text-decoration: underline;
  text-decoration-color: var(--neon-cyan, #00f0ff);
  text-underline-offset: 4px;
}

/* ── Room list ─────────────────────────────────── */
.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 320px;
}

.room-list-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.status {
  margin: auto 0;
  color: rgba(255, 240, 194, 0.62);
  font-size: 16px;
}

/* ── Room list transitions ─────────────────────── */
.room-list-enter-active {
  animation: room-in 0.3s ease-out;
}
.room-list-leave-active {
  animation: room-out 0.25s ease-in;
  position: absolute;
  width: 100%;
}
.room-list-move {
  transition: transform 0.3s ease;
}

@keyframes room-in {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes room-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(12px); }
}

/* ── Empty state ───────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: auto 0;
  padding: 32px 16px;
}

.empty-icons {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.4;
  animation: empty-bob 3s ease-in-out infinite;
}

.empty-icon:nth-child(2) { animation-delay: 0.4s; }
.empty-icon:nth-child(3) { animation-delay: 0.8s; }

@keyframes empty-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 240, 194, 0.8);
}

.empty-hint {
  font-size: 14px;
  color: rgba(255, 240, 194, 0.45);
}

/* ── Room row ──────────────────────────────────── */
.room-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.035);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.room-row:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.055);
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

.room-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.room-id {
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.04em;
}

.room-age {
  font-size: 11px;
  color: rgba(255, 240, 194, 0.35);
}

.player-count {
  min-width: 86px;
  text-align: right;
  font-size: 13px;
}

.player-count.open {
  color: var(--neon-green, #00ff88);
}

.player-count.full {
  color: var(--neon-pink, #ff2d6a);
}

/* ── Buttons ───────────────────────────────────── */
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

.row-action:focus-visible,
.primary-button:focus-visible,
.secondary-button:focus-visible,
.format-button:focus-visible,
.ghost-button:focus-visible {
  outline: 2px solid var(--neon-cyan, #00f0ff);
  outline-offset: 2px;
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

/* ── Create dialog overlay ─────────────────────── */
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
  animation: overlay-in 0.2s ease-out;
  z-index: 10;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
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
  animation: panel-in 0.25s ease-out;
}

@keyframes panel-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.create-title {
  font-family: 'Orbitron', sans-serif;
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
   border: 2px solid transparent;
   transition: all 0.2s ease;
}

.format-button.selected {
   border-color: #ffb36b;
   background: rgba(255, 179, 107, 0.1);
   color: #ffb36b;
}

.bot-toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(248, 206, 85, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

.bot-toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #ffb36b;
}

.bot-toggle-text {
  color: rgba(255, 240, 194, 0.85);
  font-size: 13px;
}

.actions-row {
  display: flex;
  gap: 10px;
}

.actions-row .primary-button {
  flex: 1;
}

.ghost-button {
  padding: 10px 14px;
  background: transparent;
  color: rgba(255, 240, 194, 0.72);
  font-size: 13px;
}

/* ── Mobile ────────────────────────────────────── */
@media (max-width: 640px) {
  .panel {
    padding: 20px;
    border-radius: 20px;
  }

  .panel-head {
    flex-direction: column;
    gap: 16px;
  }

  .panel-title {
    font-size: 26px;
  }

  .player-chip {
    width: 100%;
    justify-content: space-between;
  }

  .player-input {
    width: 100%;
    flex: 1;
    font-size: 15px;
  }

  .room-list {
    min-height: 280px;
    gap: 8px;
  }

  .room-row {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 14px 16px;
  }

  .room-copy {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .room-name {
    font-size: 16px;
  }

  .room-format {
    font-size: 12px;
  }

  .player-count {
    text-align: left;
    font-size: 12px;
    min-width: unset;
  }

  .row-action {
    width: 100%;
    text-align: center;
    padding: 12px;
  }

  .actions {
    flex-direction: column;
    gap: 10px;
  }

  .primary-button,
  .secondary-button {
    padding: 14px 16px;
    font-size: 14px;
    text-align: center;
  }

  .format-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .create-panel {
    padding: 20px;
  }

  .create-title {
    font-size: 20px;
  }

  .format-button {
    padding: 16px;
    font-size: 15px;
  }

  .bot-toggle-label {
    padding: 10px 12px;
  }

  .bot-toggle-checkbox {
    width: 16px;
    height: 16px;
  }

  .bot-toggle-text {
    font-size: 12px;
  }

  .actions-row {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 400px) {
  .panel {
    padding: 16px;
    border-radius: 16px;
  }

  .panel-title {
    font-size: 22px;
  }

  .room-name {
    font-size: 14px;
  }

  .eyebrow {
    font-size: 10px;
  }
}
</style>
