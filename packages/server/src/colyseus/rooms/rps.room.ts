import { Room, type Client } from "colyseus";
import { RPSRoomState, PlayerSchema, RoundSchema } from "../schemas/rps.state";
import {
  Choice,
  RoomPhase,
  CHOICE_BEATS,
  REVEAL_DURATION_MS,
  RECONNECT_TIMEOUT_MS,
  ClientMessage,
  ServerMessage,
  RoundResult,
  type MakeChoicePayload,
  type RPSRoomMetadata,
  type RoomJoinOptions,
} from "@rps/shared";
import type { LeaderboardService } from "../../leaderboard/leaderboard.service";

interface RPSRoomTypes {
  state: RPSRoomState;
  metadata: RPSRoomMetadata;
  client: Client;
}

function isChoice(value: string): value is Choice {
  return value === "rock" || value === "paper" || value === "scissors";
}

export class RPSRoom extends Room<RPSRoomTypes> {
  state = new RPSRoomState();
  static leaderboardService: LeaderboardService | undefined;

  private pendingChoices = new Map<string, Choice>();
  private playerSlots: string[] = [];
  private spectators = new Set<string>();
  private playAgainVotes = new Set<string>();

  messages = {
    [ClientMessage.MakeChoice]: (client: Client, payload: MakeChoicePayload) => {
      this.handleMakeChoice(client, payload);
    },
    [ClientMessage.PlayAgain]: (client: Client) => {
      this.handlePlayAgain(client);
    },
    [ClientMessage.ToggleReady]: (client: Client) => {
      this.handleToggleReady(client);
    },
  };

  onCreate(options: { name?: string; matchFormat?: number }) {
    this.state = new RPSRoomState();
    this.state.matchFormat = options.matchFormat ?? 3;
    this.maxClients = 10;

    void this.setMetadata({
      roomName: options.name ?? "RPS Game",
      matchFormat: this.state.matchFormat,
    });
  }

  onJoin(client: Client, options: RoomJoinOptions) {
    if (options.spectate === true || this.playerSlots.length >= 2) {
      this.spectators.add(client.sessionId);
      this.state.spectatorCount++;
      return;
    }

    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.name = options.name;
    this.state.players.set(client.sessionId, player);
    this.playerSlots.push(client.sessionId);

    if (this.playerSlots.length === 1) {
      this.state.player1Id = client.sessionId;
    } else if (this.playerSlots.length === 2) {
      this.state.player2Id = client.sessionId;
      this.startChoosing();
    }
  }

  async onLeave(client: Client, code?: number) {
    const consented = code === 4000;
    if (this.spectators.has(client.sessionId)) {
      this.spectators.delete(client.sessionId);
      this.state.spectatorCount--;
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;

    // Notify opponent
    this.broadcast(ServerMessage.OpponentDisconnected, {}, {
      except: client,
    });

    if (consented) {
      this.handlePermanentLeave(client.sessionId);
      return;
    }

    // Allow reconnection
    try {
      await this.allowReconnection(client, RECONNECT_TIMEOUT_MS / 1000);

      // Reconnected
      player.connected = true;
      this.broadcast(ServerMessage.OpponentReconnected, {}, {
        except: client,
      });
    } catch {
      // Reconnection timed out
      this.handlePermanentLeave(client.sessionId);
    }
  }

  onDispose() {
    // Cleanup
  }

  private handlePermanentLeave(sessionId: string) {
    const phase = this.state.phase as RoomPhase;
    const isActivePlaying =
      phase !== RoomPhase.WaitingForPlayers && phase !== RoomPhase.MatchEnd;

    // Find the remaining player
    const remainingPlayerId = this.playerSlots.find((id) => id !== sessionId);

    if (isActivePlaying && remainingPlayerId !== undefined) {
      // Forfeit: remaining player wins
      this.state.winnerId = remainingPlayerId;
      this.state.phase = RoomPhase.MatchEnd;

      const winner = this.state.players.get(remainingPlayerId);
      const loser = this.state.players.get(sessionId);
      if (winner && loser) {
        RPSRoom.leaderboardService?.recordWin(winner.name);
        RPSRoom.leaderboardService?.recordLoss(loser.name);
      }
    }

    // Clean up
    this.state.players.delete(sessionId);
    this.playerSlots = this.playerSlots.filter((id) => id !== sessionId);
    this.pendingChoices.delete(sessionId);

    if (sessionId === this.state.player1Id) this.state.player1Id = "";
    if (sessionId === this.state.player2Id) this.state.player2Id = "";

    // If no players left (only spectators), reset to waiting
    if (this.playerSlots.length === 0) {
      this.state.phase = RoomPhase.WaitingForPlayers;
    }
  }

  private handleMakeChoice(client: Client, payload: MakeChoicePayload) {
    if ((this.state.phase as RoomPhase) !== RoomPhase.Choosing) return;
    if (this.spectators.has(client.sessionId)) return;
    if (this.pendingChoices.has(client.sessionId)) return;

    if (!isChoice(payload.choice)) {
      client.send(ServerMessage.Error, { message: "Invalid choice" });
      return;
    }
    const choice = payload.choice;

    this.pendingChoices.set(client.sessionId, choice);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.hasChosen = true;
    }

    if (this.pendingChoices.size === 2) {
      this.evaluateRound();
    }
  }

  private handlePlayAgain(client: Client) {
    if ((this.state.phase as RoomPhase) !== RoomPhase.MatchEnd) return;
    if (this.spectators.has(client.sessionId)) return;

    this.playAgainVotes.add(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.ready = true;
    }

    // Both players want to play again
    if (this.playAgainVotes.size === 2) {
      this.resetMatch();
      this.startChoosing();
    }
  }

  private handleToggleReady(client: Client) {
    if (this.spectators.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.ready = !player.ready;
    }
  }

  private startChoosing() {
    this.state.phase = RoomPhase.Choosing;
    this.resetPlayerChoiceState();
  }

  private evaluateRound() {
    this.state.phase = RoomPhase.Revealing;

    const p1Id = this.state.player1Id;
    const p2Id = this.state.player2Id;
    const p1Choice = this.pendingChoices.get(p1Id);
    const p2Choice = this.pendingChoices.get(p2Id);
    if (p1Choice === undefined || p2Choice === undefined) return;

    // Reveal choices in the schema (now visible to clients)
    const p1 = this.state.players.get(p1Id);
    const p2 = this.state.players.get(p2Id);
    if (p1) p1.currentChoice = p1Choice;
    if (p2) p2.currentChoice = p2Choice;

    // Determine result
    let result: RoundResult;
    if (p1Choice === p2Choice) {
      result = RoundResult.Draw;
    } else if (CHOICE_BEATS[p1Choice] === p2Choice) {
      result = RoundResult.Player1;
    } else {
      result = RoundResult.Player2;
    }

    // Update scores
    if (result === RoundResult.Player1 && p1) p1.score++;
    if (result === RoundResult.Player2 && p2) p2.score++;

    // Record the round
    this.state.currentRound++;
    const round = new RoundSchema();
    round.roundNumber = this.state.currentRound;
    round.player1Choice = p1Choice;
    round.player2Choice = p2Choice;
    round.result = result;
    this.state.rounds.push(round);

    // After reveal duration, check for match end
    this.clock.setTimeout(() => {
      this.checkMatchEnd();
    }, REVEAL_DURATION_MS);
  }

  private checkMatchEnd() {
    const winsNeeded = Math.ceil(this.state.matchFormat / 2);
    const p1 = this.state.players.get(this.state.player1Id);
    const p2 = this.state.players.get(this.state.player2Id);

    if (!p1 || !p2) return;

    if (p1.score >= winsNeeded || p2.score >= winsNeeded) {
      const winner = p1.score >= winsNeeded ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;

      this.state.winnerId = winner.sessionId;
      this.state.phase = RoomPhase.MatchEnd;

      this.broadcast(ServerMessage.MatchResult, {
        winner: winner.name,
        player1Score: p1.score,
        player2Score: p2.score,
      });

      // Update leaderboard
      RPSRoom.leaderboardService?.recordWin(winner.name);
      RPSRoom.leaderboardService?.recordLoss(loser.name);
    } else {
      this.pendingChoices.clear();
      this.startChoosing();
    }
  }

  private resetPlayerChoiceState() {
    this.state.players.forEach((player: PlayerSchema) => {
      player.hasChosen = false;
      player.currentChoice = "";
    });
  }

  private resetMatch() {
    this.state.currentRound = 0;
    this.state.winnerId = "";
    this.state.rounds.clear();
    this.pendingChoices.clear();
    this.playAgainVotes.clear();

    this.state.players.forEach((player: PlayerSchema) => {
      player.score = 0;
      player.ready = false;
      player.hasChosen = false;
      player.currentChoice = "";
    });
  }
}
