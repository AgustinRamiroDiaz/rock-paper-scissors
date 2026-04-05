<template>
  <div class="game" role="main" aria-label="Rock Paper Scissors game">
    <!-- Top bar -->
    <div class="top-bar">
      <div class="player-info left">
        <span class="player-name p1">{{ p1Name }}</span>
        <span :class="['score', { 'score-bump': p1ScoreBumped }]" :aria-label="`Player 1 score: ${p1Score}`">
          Score: {{ p1Score }}
        </span>
      </div>
      <div class="round-info">
        {{ currentRound > 0 ? `Round ${currentRound} / Bo${matchFormat}` : `Bo${matchFormat}` }}
      </div>
      <div class="player-info right">
        <span class="player-name p2">{{ p2Name }}</span>
        <span :class="['score', { 'score-bump': p2ScoreBumped }]" :aria-label="`Player 2 score: ${p2Score}`">
          Score: {{ p2Score }}
        </span>
      </div>
    </div>

    <!-- Banner -->
    <div v-if="banner" class="banner" role="status" aria-live="polite">{{ banner }}</div>

    <!-- Main area -->
    <div class="main-area" :data-testid="`phase-${phase}`">

      <!-- Waiting -->
      <Transition name="phase-fade" mode="out-in">
        <div v-if="phase === 'waiting'" key="waiting" class="phase-waiting">
          <div class="waiting-pulse" aria-hidden="true"></div>
          <p class="phase-text">Waiting for opponent...</p>
        </div>

        <!-- Choosing -->
        <div v-else-if="phase === 'choosing'" key="choosing" class="choosing-area">
          <p class="phase-text" aria-live="polite">
            {{ spectating ? "Players are choosing..." : hasChosen ? "Locked in! Waiting for opponent..." : "Choose your weapon!" }}
          </p>

          <!-- Spectator prediction (cosmetic) -->
          <div v-if="spectating" class="spectator-predict">
            <p class="predict-label">Who do you think will win?</p>
            <div class="predict-buttons">
              <button
                :class="['predict-btn', 'p1-predict', { selected: prediction === 'p1' }]"
                @click="prediction = 'p1'"
              >{{ p1Name }}</button>
              <button
                :class="['predict-btn', 'p2-predict', { selected: prediction === 'p2' }]"
                @click="prediction = 'p2'"
              >{{ p2Name }}</button>
            </div>
          </div>

          <div v-if="!spectating" class="choices">
            <button
              v-for="(c, i) in choices"
              :key="c.value"
              :class="['choice-btn', c.class, {
                dimmed: hasChosen && chosenValue !== c.value,
                chosen: hasChosen && chosenValue === c.value,
              }]"
              :disabled="hasChosen"
              :data-testid="`choice-${c.value}`"
              :style="{ animationDelay: `${i * 80}ms` }"
              :aria-label="`Choose ${c.label}`"
              :aria-pressed="chosenValue === c.value"
              @click="makeChoice(c.value)"
            >
              <span class="choice-icon" aria-hidden="true">{{ c.icon }}</span>
              <span class="choice-label">{{ c.label }}</span>
            </button>
          </div>
        </div>

        <!-- Revealing -->
        <div v-else-if="phase === 'revealing'" key="revealing" class="reveal-area">
          <div :class="['reveal-side', revealWinnerSide === 'p1' ? 'winner' : revealWinnerSide === 'p2' ? 'loser' : '']">
            <span class="reveal-name">{{ p1Name }}</span>
            <div class="reveal-card">
              <span class="reveal-icon">{{ choiceIcon(p1Choice) }}</span>
            </div>
            <span class="reveal-label">{{ p1Choice.toUpperCase() }}</span>
          </div>
          <span class="vs" aria-hidden="true">VS</span>
          <div :class="['reveal-side', revealWinnerSide === 'p2' ? 'winner' : revealWinnerSide === 'p1' ? 'loser' : '']">
            <span class="reveal-name">{{ p2Name }}</span>
            <div class="reveal-card">
              <span class="reveal-icon">{{ choiceIcon(p2Choice) }}</span>
            </div>
            <span class="reveal-label">{{ p2Choice.toUpperCase() }}</span>
          </div>
          <p :class="['round-result', roundResultClass]" role="status" aria-live="assertive">
            {{ roundResultText }}
          </p>
        </div>

        <!-- Match end -->
        <div v-else-if="phase === 'match_end'" key="match_end" class="match-end" data-testid="match-end">
          <div v-if="matchResultClass === 'win'" class="victory-burst" aria-hidden="true">
            <span v-for="n in 12" :key="n" class="burst-ray" :style="{ '--ray-angle': `${n * 30}deg` }"></span>
          </div>
          <h2 :class="['match-result', matchResultClass]" data-testid="match-result" role="status" aria-live="assertive">
            {{ matchResultText }}
          </h2>
          <p class="final-score" data-testid="final-score">{{ p1Name }} {{ p1Score }} - {{ p2Score }} {{ p2Name }}</p>

          <div class="match-stats">
            <span class="stat">{{ currentRound }} rounds played</span>
          </div>

          <div v-if="!spectating" class="match-actions">
            <button class="btn btn-lobby" @click="leave">BACK TO LOBBY</button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <button class="btn btn-danger btn-small" @click="leave" aria-label="Leave game">LEAVE</button>
      <span v-if="spectating" class="spectating-label">SPECTATING</span>
      <span v-if="spectatorCount > 0" class="spectator-count">
        <span aria-hidden="true">👁</span> {{ spectatorCount }} watching
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { Callbacks } from "@colyseus/sdk";
import { network } from "../network/client";
import { Choice, RoomPhase, ClientMessage, ServerMessage } from "@rps/shared";

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
const lastRoundResult = ref<RoundOutcome>("");
const matchCloseCountdown = ref<number | null>(null);
const prediction = ref<"p1" | "p2" | null>(null);
const p1ScoreBumped = ref(false);
const p2ScoreBumped = ref(false);
let matchCloseInterval: number | null = null;

const choices = [
  { value: Choice.Rock, label: "ROCK", icon: "🪨", class: "choice-rock" },
  { value: Choice.Paper, label: "PAPER", icon: "📄", class: "choice-paper" },
  { value: Choice.Scissors, label: "SCISSORS", icon: "✂️", class: "choice-scissors" },
];

function choiceIcon(val: Choice | "") {
  return choices.find((c) => c.value === val)?.icon ?? "?";
}

// Score bump animation triggers
watch(p1Score, () => {
  p1ScoreBumped.value = true;
  setTimeout(() => { p1ScoreBumped.value = false; }, 400);
});
watch(p2Score, () => {
  p2ScoreBumped.value = true;
  setTimeout(() => { p2ScoreBumped.value = false; }, 400);
});

const room = network.getRoom();
const myId = room?.sessionId ?? "";
const getRoomState = () => room?.state as RoomStateView | undefined;

const revealWinnerSide = computed(() => {
  if (lastRoundResult.value === "draw") return "";
  return lastRoundResult.value === "player1" ? "p1" : "p2";
});

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
    $.onAdd("players" as never, (player: unknown) => {
      const state = getRoomState();
      if (state == null) return;
      updatePlayers(state);
      const typedPlayer = player as PlayerView;
      cleanups.push(
        $.listen(typedPlayer as never, "score" as never, () => { updatePlayers(state); }),
        $.listen(typedPlayer as never, "hasChosen" as never, () => { /* opponent status */ }),
        $.listen(typedPlayer as never, "currentChoice" as never, () => { updatePlayers(state); }),
        $.listen(typedPlayer as never, "connected" as never, () => { /* reconnect status */ }),
      );
    }),
  );

  cleanups.push(
    $.onRemove("players" as never, () => { syncFromState(); }),
  );

  // Watch rounds for result display
  cleanups.push(
    $.onAdd("rounds" as never, (round: unknown) => {
      const typedRound = round as { result: RoundOutcome };
      lastRoundResult.value = typedRound.result;
    }),
  );

  room.onMessage("opponent_disconnected", () => {
    banner.value = "Opponent disconnected - waiting for reconnection...";
  });
  room.onMessage("opponent_reconnected", () => {
    banner.value = "";
  });
  room.onMessage(ServerMessage.MatchClosing, (payload: { seconds?: number }) => {
    const seconds = payload.seconds ?? 10;
    matchCloseCountdown.value = seconds;
    banner.value = `Match finished. Returning to lobby in ${seconds}s...`;

    if (matchCloseInterval != null) {
      window.clearInterval(matchCloseInterval);
      matchCloseInterval = null;
    }

    matchCloseInterval = window.setInterval(() => {
      const current = matchCloseCountdown.value;
      if (current == null || current <= 1) {
        banner.value = "Match finished. Returning to lobby...";
        matchCloseCountdown.value = 0;
        if (matchCloseInterval != null) {
          window.clearInterval(matchCloseInterval);
          matchCloseInterval = null;
        }
        return;
      }

      const next = current - 1;
      matchCloseCountdown.value = next;
      banner.value = `Match finished. Returning to lobby in ${next}s...`;
    }, 1000);
  });
  room.onLeave(() => {
    network.disconnect();
    void router.push("/");
  });

  syncFromState();
  const syncInterval = window.setInterval(syncFromState, 100);
  cleanups.push(() => { window.clearInterval(syncInterval); });
});

onUnmounted(() => {
  cleanups.forEach((fn) => { fn(); });
  if (matchCloseInterval != null) {
    window.clearInterval(matchCloseInterval);
    matchCloseInterval = null;
  }
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
/* ── Phase transitions ─────────────────────────── */
.phase-fade-enter-active {
  animation: phase-in 0.35s ease-out;
}
.phase-fade-leave-active {
  animation: phase-out 0.2s ease-in;
}

@keyframes phase-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes phase-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-8px) scale(0.98); }
}

/* ── Waiting pulse ─────────────────────────────── */
.phase-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.waiting-pulse {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--neon-amber, #ffd426) 0%, transparent 70%);
  animation: pulse-ring 2s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(0.8); opacity: 0.4; }
  50%      { transform: scale(1.2); opacity: 0.8; }
}

/* ── Score bump ────────────────────────────────── */
.score-bump {
  animation: bump 0.4s ease-out;
}

@keyframes bump {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); color: var(--neon-green, #00ff88); }
  100% { transform: scale(1); }
}

/* ── Game layout ───────────────────────────────── */
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
  background: #16213e;
  border-radius: 0 0 12px 12px;
  padding: 12px 24px;
}

.player-info { display: flex; flex-direction: column; gap: 2px; }
.player-info.right { text-align: right; }
.player-name { font-weight: bold; font-size: 18px; }
.player-name.p1 { color: var(--neon-pink, #ff2d6a); }
.player-name.p2 { color: var(--neon-cyan, #00f0ff); }
.score { font-size: 14px; color: #ccc; display: inline-block; }
.round-info { font-size: 20px; font-weight: bold; }

.banner {
  text-align: center;
  background: rgba(255, 212, 38, 0.1);
  border: 1px solid rgba(255, 212, 38, 0.2);
  color: var(--neon-amber, #ffd426);
  padding: 8px 16px;
  margin-top: 8px;
  border-radius: 8px;
  animation: phase-in 0.3s ease-out;
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
  text-align: center;
}

/* ── Spectator prediction ──────────────────────── */
.spectator-predict {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 20px 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.predict-label {
  font-size: 13px;
  color: rgba(255, 240, 194, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.predict-buttons {
  display: flex;
  gap: 12px;
}

.predict-btn {
  padding: 8px 20px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc;
  font-family: "IBM Plex Mono", "Courier New", monospace;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.predict-btn.p1-predict.selected {
  border-color: var(--neon-pink, #ff2d6a);
  color: var(--neon-pink, #ff2d6a);
  background: rgba(255, 45, 106, 0.1);
  box-shadow: 0 0 16px rgba(255, 45, 106, 0.2);
}

.predict-btn.p2-predict.selected {
  border-color: var(--neon-cyan, #00f0ff);
  color: var(--neon-cyan, #00f0ff);
  background: rgba(0, 240, 255, 0.1);
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.2);
}

.predict-btn:not(.selected):hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

/* ── Choice buttons ────────────────────────────── */
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
  transition: all 0.25s ease;
  animation: choice-enter 0.35s ease-out both;
}

@keyframes choice-enter {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.choice-btn:disabled { cursor: default; }
.choice-btn.dimmed {
  opacity: 0.15;
  transform: scale(0.9);
  filter: grayscale(0.6);
}
.choice-btn.chosen {
  border-color: #fff;
  animation: chosen-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 24px rgba(255, 255, 255, 0.2);
}

@keyframes chosen-pulse {
  0%, 100% { box-shadow: 0 0 24px rgba(255, 255, 255, 0.15); }
  50%      { box-shadow: 0 0 40px rgba(255, 255, 255, 0.35); }
}

.choice-rock { background: #e94560; }
.choice-paper { background: #533483; }
.choice-scissors { background: #0f3460; }
.choice-btn:not(:disabled):hover { border-color: #fff; transform: scale(1.08); }
.choice-icon { font-size: 48px; }
.choice-label { font-size: 14px; }

/* ── Reveal ────────────────────────────────────── */
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
  animation: reveal-slide-in 0.4s ease-out both;
  transition: all 0.4s ease;
}

.reveal-side:first-child { animation-name: reveal-slide-left; }
.reveal-side:last-of-type { animation-name: reveal-slide-right; }

@keyframes reveal-slide-left {
  from { opacity: 0; transform: translateX(-40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes reveal-slide-right {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}

.reveal-side.winner {
  transform: scale(1.1);
}
.reveal-side.winner .reveal-card {
  box-shadow: 0 0 32px rgba(0, 255, 136, 0.3);
  border-color: var(--neon-green, #00ff88);
}

.reveal-side.loser {
  opacity: 0.55;
  transform: scale(0.92);
}

.reveal-card {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  animation: card-flip 0.5s ease-out;
  transition: all 0.4s ease;
}

@keyframes card-flip {
  0%   { transform: rotateY(90deg); opacity: 0; }
  50%  { transform: rotateY(-5deg); opacity: 1; }
  100% { transform: rotateY(0); }
}

.reveal-name { font-size: 16px; color: #8899aa; }
.reveal-icon { font-size: 48px; }
.reveal-label { font-size: 18px; font-weight: bold; }
.vs {
  font-size: 48px;
  font-weight: bold;
  color: #fff;
  animation: vs-pop 0.3s ease-out 0.2s both;
}

@keyframes vs-pop {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}

.round-result {
  font-size: 28px;
  font-weight: bold;
  margin-top: 16px;
  animation: result-appear 0.4s ease-out 0.3s both;
}

@keyframes result-appear {
  from { opacity: 0; transform: translateY(10px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.round-result.win {
  color: var(--neon-green, #00ff88);
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
}
.round-result.lose {
  color: var(--neon-pink, #ff2d6a);
  text-shadow: 0 0 20px rgba(255, 45, 106, 0.4);
}
.round-result.draw {
  color: var(--neon-amber, #ffd426);
  text-shadow: 0 0 20px rgba(255, 212, 38, 0.3);
}

/* ── Match end ─────────────────────────────────── */
.match-end {
  text-align: center;
  position: relative;
}

.victory-burst {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
  pointer-events: none;
}

.burst-ray {
  position: absolute;
  width: 3px;
  height: 120px;
  background: linear-gradient(to top, transparent, var(--neon-green, #00ff88));
  transform-origin: bottom center;
  transform: rotate(var(--ray-angle));
  opacity: 0;
  animation: ray-burst 1.2s ease-out forwards;
}

@keyframes ray-burst {
  0%   { opacity: 0.8; height: 0; }
  50%  { opacity: 0.6; height: 120px; }
  100% { opacity: 0; height: 180px; }
}

.match-result {
  font-size: 48px;
  margin-bottom: 16px;
  font-family: 'Orbitron', sans-serif;
  font-weight: 900;
  animation: match-result-in 0.6s ease-out;
}

@keyframes match-result-in {
  0%   { opacity: 0; transform: scale(0.5); filter: blur(8px); }
  60%  { opacity: 1; transform: scale(1.08); filter: blur(0); }
  100% { transform: scale(1); }
}

.match-result.win {
  color: var(--neon-green, #00ff88);
  text-shadow: 0 0 30px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.2);
}
.match-result.lose {
  color: var(--neon-pink, #ff2d6a);
  text-shadow: 0 0 30px rgba(255, 45, 106, 0.5);
  animation-name: match-defeat-in;
}

@keyframes match-defeat-in {
  0%   { opacity: 0; transform: translateY(-20px); filter: blur(4px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

.final-score {
  font-size: 24px;
  margin-bottom: 12px;
  animation: phase-in 0.4s ease-out 0.2s both;
}

.match-stats {
  margin-bottom: 24px;
  animation: phase-in 0.4s ease-out 0.3s both;
}

.stat {
  font-size: 14px;
  color: rgba(255, 240, 194, 0.5);
}

.match-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  animation: phase-in 0.4s ease-out 0.4s both;
}

.btn-lobby {
  background: linear-gradient(135deg, #0f3460, #16213e);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 700;
}

.btn-lobby:hover {
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

/* ── Bottom bar ────────────────────────────────── */
.bottom-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.spectating-label { color: var(--neon-amber, #ffd426); font-weight: bold; margin-left: auto; }
.spectator-count { color: #8899aa; margin-left: auto; }

/* ── Buttons ───────────────────────────────────── */
.btn {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover { opacity: 0.8; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn:focus-visible {
  outline: 2px solid var(--neon-cyan, #00f0ff);
  outline-offset: 2px;
}
.btn-green { background: var(--neon-green, #00ff88); color: #000; }
.btn-dark { background: #0f3460; color: #fff; }
.btn-danger { background: var(--neon-pink, #ff2d6a); color: #fff; }
.btn-small { padding: 6px 16px; font-size: 13px; }

/* ── Mobile ────────────────────────────────────── */
@media (max-width: 640px) {
  .game { padding: 0 12px; }

  .top-bar {
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 0 0 8px 8px;
  }

  .player-info { flex: 1; min-width: 100px; }
  .player-info.right { text-align: right; }
  .player-name { font-size: 14px; }
  .score { font-size: 12px; }

  .round-info {
    font-size: 16px;
    order: -1;
    width: 100%;
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 4px;
  }

  .main-area { padding: 24px 0; gap: 16px; }
  .phase-text { font-size: 18px; padding: 0 12px; }

  .choices {
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .choice-btn {
    padding: 16px 20px;
    flex: 1 1 calc(33% - 8px);
    max-width: 140px;
    min-width: 90px;
  }

  .choice-icon { font-size: 36px; }
  .choice-label { font-size: 11px; }

  .reveal-area {
    flex-direction: column;
    gap: 24px;
    width: 100%;
  }

  .reveal-side {
    width: 100%;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .reveal-card {
    width: 80px;
    height: 80px;
  }

  .reveal-icon { font-size: 40px; }
  .vs { font-size: 28px; padding: 8px 0; }
  .round-result { font-size: 20px; }
  .match-result { font-size: 32px; }
  .final-score { font-size: 18px; }

  .match-actions {
    flex-direction: column;
    width: 100%;
  }

  .match-actions .btn { width: 100%; }

  .bottom-bar {
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
  }

  .spectating-label,
  .spectator-count {
    margin-left: 0;
    width: 100%;
    text-align: center;
    font-size: 12px;
  }
}

@media (max-width: 400px) {
  .choice-btn { padding: 12px 14px; }
  .choice-icon { font-size: 28px; }
  .choice-label { font-size: 10px; }
  .match-result { font-size: 26px; }
}
</style>
