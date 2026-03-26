<template>
  <div class="game">
    <!-- Top bar -->
    <div class="top-bar">
      <div class="player-info left">
        <span class="player-name p1">{{ p1Name }}</span>
        <span class="score">Score: {{ p1Score }}</span>
      </div>
      <div class="round-info">
        {{ currentRound > 0 ? `Round ${currentRound} / Bo${matchFormat}` : `Bo${matchFormat}` }}
      </div>
      <div class="player-info right">
        <span class="player-name p2">{{ p2Name }}</span>
        <span class="score">Score: {{ p2Score }}</span>
      </div>
    </div>

    <!-- Banner -->
    <div v-if="banner" class="banner">{{ banner }}</div>

    <!-- Main area -->
    <div class="main-area" :data-testid="`phase-${phase}`">
      <!-- Waiting -->
      <p v-if="phase === 'waiting'" class="phase-text">Waiting for opponent...</p>

      <!-- Choosing -->
      <div v-else-if="phase === 'choosing'" class="choosing-area">
        <p class="phase-text">
          {{ spectating ? "Players are choosing..." : hasChosen ? "Locked in! Waiting for opponent..." : "Choose your weapon!" }}
        </p>
        <div v-if="!spectating" class="choices">
          <button
            v-for="c in choices"
            :key="c.value"
            class="choice-btn"
            :class="[c.class, { dimmed: hasChosen && chosenValue !== c.value }]"
            :disabled="hasChosen"
            :data-testid="`choice-${c.value}`"
            @click="makeChoice(c.value)"
          >
            <span class="choice-icon">{{ c.icon }}</span>
            <span class="choice-label">{{ c.label }}</span>
          </button>
        </div>
      </div>

      <!-- Revealing -->
      <div v-else-if="phase === 'revealing'" class="reveal-area">
        <div class="reveal-side">
          <span class="reveal-name">{{ p1Name }}</span>
          <span class="reveal-icon">{{ choiceIcon(p1Choice) }}</span>
          <span class="reveal-label">{{ p1Choice.toUpperCase() }}</span>
        </div>
        <span class="vs">VS</span>
        <div class="reveal-side">
          <span class="reveal-name">{{ p2Name }}</span>
          <span class="reveal-icon">{{ choiceIcon(p2Choice) }}</span>
          <span class="reveal-label">{{ p2Choice.toUpperCase() }}</span>
        </div>
        <p class="round-result" :class="roundResultClass">
          {{ roundResultText }}
        </p>
      </div>

      <!-- Match end -->
      <div v-else-if="phase === 'match_end'" class="match-end" data-testid="match-end">
        <h2 :class="['match-result', matchResultClass]" data-testid="match-result">{{ matchResultText }}</h2>
        <p class="final-score" data-testid="final-score">{{ p1Name }} {{ p1Score }} - {{ p2Score }} {{ p2Name }}</p>
        <div v-if="!spectating" class="match-actions">
          <button class="btn btn-green" :disabled="playAgainSent" @click="playAgain">
            {{ playAgainSent ? "WAITING..." : "PLAY AGAIN" }}
          </button>
          <button class="btn btn-dark" @click="leave">LOBBY</button>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <button class="btn btn-danger btn-small" @click="leave">LEAVE</button>
      <span v-if="spectating" class="spectating-label">SPECTATING</span>
      <span v-if="spectatorCount > 0" class="spectator-count">Spectators: {{ spectatorCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Callbacks } from "@colyseus/sdk";
import { network } from "../network/client";
import { Choice, RoomPhase, ClientMessage } from "@rps/shared";

defineOptions({ name: "GamePage" });

type RoundOutcome = "player1" | "player2" | "draw" | "";
interface PlayerView {
  name: string;
  score: number;
  currentChoice: Choice | "";
}
interface RoomStateView {
  phase: RoomPhase;
  matchFormat: number;
  currentRound: number;
  player1Id: string;
  player2Id: string;
  winnerId: string;
  players?: Map<string, PlayerView>;
  rounds: { result: RoundOutcome }[];
}

const router = useRouter();
const route = useRoute();
const spectating = route.query.spectating === "1";

const phase = ref(RoomPhase.WaitingForPlayers as RoomPhase);
const currentRound = ref(0);
const matchFormat = ref(3);
const p1Name = ref("Waiting...");
const p2Name = ref("Waiting...");
const p1Score = ref(0);
const p2Score = ref(0);
const p1Choice = ref<Choice | "">("");
const p2Choice = ref<Choice | "">("");
const spectatorCount = ref(0);
const winnerId = ref("");
const banner = ref("");
const hasChosen = ref(false);
const chosenValue = ref<Choice | "">("");
const playAgainSent = ref(false);
const lastRoundResult = ref<RoundOutcome>("");

const choices = [
  { value: Choice.Rock, label: "ROCK", icon: "🪨", class: "choice-rock" },
  { value: Choice.Paper, label: "PAPER", icon: "📄", class: "choice-paper" },
  { value: Choice.Scissors, label: "SCISSORS", icon: "✂️", class: "choice-scissors" },
];

function choiceIcon(val: Choice | "") {
  return choices.find((c) => c.value === val)?.icon ?? "?";
}

const room = network.getRoom();
const myId = room?.sessionId ?? "";
const getRoomState = () => room?.state as RoomStateView | undefined;

const roundResultText = computed(() => {
  if (lastRoundResult.value === "draw") return "DRAW!";
  const roomState = getRoomState();
  const roundWinnerId = lastRoundResult.value === "player1"
    ? roomState?.player1Id
    : roomState?.player2Id;
  if (spectating) return `${roundWinnerId === roomState?.player1Id ? p1Name.value : p2Name.value} wins the round!`;
  return roundWinnerId === myId ? "YOU WIN THIS ROUND!" : "YOU LOSE THIS ROUND";
});

const roundResultClass = computed(() => {
  if (lastRoundResult.value === "draw") return "draw";
  const roomState = getRoomState();
  const roundWinnerId = lastRoundResult.value === "player1"
    ? roomState?.player1Id
    : roomState?.player2Id;
  return roundWinnerId === myId ? "win" : "lose";
});

const matchResultText = computed(() => {
  const roomState = getRoomState();
  if (spectating) return `${winnerId.value === roomState?.player1Id ? p1Name.value : p2Name.value} WINS!`;
  return winnerId.value === myId ? "VICTORY!" : "DEFEAT";
});

const matchResultClass = computed(() => {
  if (spectating) return "win";
  return winnerId.value === myId ? "win" : "lose";
});

function makeChoice(choice: Choice) {
  if (hasChosen.value || spectating) return;
  hasChosen.value = true;
  chosenValue.value = choice;
  room?.send(ClientMessage.MakeChoice, { choice });
}

function playAgain() {
  playAgainSent.value = true;
  room?.send(ClientMessage.PlayAgain);
}

function leave() {
  network.disconnect();
  void router.push("/");
}

// Cleanup deregistration functions
const cleanups: (() => void)[] = [];

onMounted(() => {
  if (room == null) {
    void router.push("/");
    return;
  }

  const $ = Callbacks.get(room);
  const syncFromState = () => {
    const state = getRoomState();
    if (state == null) return;
    phase.value = state.phase;
    matchFormat.value = state.matchFormat;
    currentRound.value = state.currentRound;
    winnerId.value = state.winnerId;
    updatePlayers(state);
  };

  // Sync initial state
  syncFromState();

  cleanups.push(
    $.listen("phase" as never, (val: RoomPhase) => {
      phase.value = val;
      if (val === RoomPhase.Choosing) {
        hasChosen.value = false;
        chosenValue.value = "";
        playAgainSent.value = false;
      }
    }),
    $.listen("currentRound" as never, (val: number) => { currentRound.value = val; }),
    $.listen("matchFormat" as never, (val: number) => { matchFormat.value = val; }),
    $.listen("spectatorCount" as never, (val: number) => { spectatorCount.value = val; }),
    $.listen("winnerId" as never, (val: string) => { winnerId.value = val; }),
    $.listen("player1Id" as never, () => { syncFromState(); }),
    $.listen("player2Id" as never, () => { syncFromState(); }),
  );

  cleanups.push(
    $.onAdd("players" as never, (player: PlayerView) => {
      const state = getRoomState();
      if (state == null) return;
      updatePlayers(state);
      cleanups.push(
        $.listen(player as never, "score" as never, () => { updatePlayers(state); }),
        $.listen(player as never, "hasChosen" as never, () => { /* opponent status */ }),
        $.listen(player as never, "currentChoice" as never, () => { updatePlayers(state); }),
        $.listen(player as never, "connected" as never, () => { /* reconnect status */ }),
      );
    }),
  );

  cleanups.push(
    $.onRemove("players" as never, () => { syncFromState(); }),
  );

  // Watch rounds for result display
  cleanups.push(
    $.onAdd("rounds" as never, (round: { result: RoundOutcome }) => {
      lastRoundResult.value = round.result;
    }),
  );

  room.onMessage("opponent_disconnected", () => {
    banner.value = "Opponent disconnected - waiting for reconnection...";
  });
  room.onMessage("opponent_reconnected", () => {
    banner.value = "";
  });

  syncFromState();
  const syncInterval = window.setInterval(syncFromState, 100);
  cleanups.push(() => { window.clearInterval(syncInterval); });
});

onUnmounted(() => {
  cleanups.forEach((fn) => { fn(); });
});

function updatePlayers(state: RoomStateView) {
  const players = state.players;
  if (players == null) {
    p1Name.value = "Waiting...";
    p1Score.value = 0;
    p1Choice.value = "";
    p2Name.value = "Waiting...";
    p2Score.value = 0;
    p2Choice.value = "";
    return;
  }
  const p1Id = state.player1Id;
  const p2Id = state.player2Id;
  const p1 = players.get(p1Id);
  const p2 = players.get(p2Id);
  p1Name.value = p1 !== undefined ? p1.name : "Waiting...";
  p1Score.value = p1 !== undefined ? p1.score : 0;
  p1Choice.value = p1 !== undefined ? p1.currentChoice : "";
  p2Name.value = p2 !== undefined ? p2.name : "Waiting...";
  p2Score.value = p2 !== undefined ? p2.score : 0;
  p2Choice.value = p2 !== undefined ? p2.currentChoice : "";
}
</script>

<style scoped>
.game {
  width: 100%;
  max-width: 960px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 24px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  background: #16213e;
  border-radius: 0 0 12px 12px;
  padding: 12px 24px;
}

.player-info { display: flex; flex-direction: column; gap: 2px; }
.player-info.right { text-align: right; }
.player-name { font-weight: bold; font-size: 18px; }
.player-name.p1 { color: #e94560; }
.player-name.p2 { color: #533483; }
.score { font-size: 14px; color: #ccc; }
.round-info { font-size: 20px; font-weight: bold; }

.banner {
  text-align: center;
  background: #333;
  color: #ffcc00;
  padding: 8px;
  margin-top: 8px;
  border-radius: 8px;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
  padding: 32px 0;
}

.phase-text {
  font-size: 24px;
  color: #ccc;
}

.choices {
  display: flex;
  gap: 32px;
  margin-top: 16px;
}

.choice-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  border: 3px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  font-family: monospace;
  font-weight: bold;
  font-size: 14px;
  color: #fff;
  transition: all 0.2s;
}

.choice-btn:disabled { cursor: default; }
.choice-btn.dimmed { opacity: 0.3; }
.choice-rock { background: #e94560; }
.choice-paper { background: #533483; }
.choice-scissors { background: #0f3460; }
.choice-btn:not(:disabled):hover { border-color: #fff; transform: scale(1.05); }
.choice-icon { font-size: 48px; }
.choice-label { font-size: 14px; }

.reveal-area {
  display: flex;
  align-items: center;
  gap: 48px;
  text-align: center;
}

.reveal-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.reveal-name { font-size: 16px; color: #8899aa; }
.reveal-icon { font-size: 64px; }
.reveal-label { font-size: 18px; font-weight: bold; }
.vs { font-size: 48px; font-weight: bold; color: #fff; }

.round-result {
  font-size: 28px;
  font-weight: bold;
  margin-top: 16px;
}

.round-result.win { color: #53cf8a; }
.round-result.lose { color: #e94560; }
.round-result.draw { color: #ffcc00; }

.match-end { text-align: center; }

.match-result {
  font-size: 48px;
  margin-bottom: 16px;
}

.match-result.win { color: #53cf8a; }
.match-result.lose { color: #e94560; }

.final-score {
  font-size: 24px;
  margin-bottom: 24px;
}

.match-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.bottom-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.spectating-label { color: #ffcc00; font-weight: bold; margin-left: auto; }
.spectator-count { color: #8899aa; margin-left: auto; }

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
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-green { background: #53cf8a; color: #fff; }
.btn-dark { background: #0f3460; color: #fff; }
.btn-danger { background: #e94560; color: #fff; }
.btn-small { padding: 6px 16px; font-size: 13px; }
</style>
