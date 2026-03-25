/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison -- Colyseus state is untyped on client */
/* eslint-disable @typescript-eslint/restrict-template-expressions -- Colyseus state is untyped on client */
/* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime-mutable state */
/* eslint-disable @typescript-eslint/no-explicit-any -- Colyseus state is untyped on client */
import Phaser from "phaser";
import { network } from "../network/client";
import {
  Choice,
  RoomPhase,
  ClientMessage,
  ServerMessage,
} from "@rps/shared";
import { type Room, Callbacks } from "@colyseus/sdk";

const CHOICE_SHAPES: Record<Choice, { label: string; color: number; shape: string }> = {
  [Choice.Rock]: { label: "ROCK", color: 0xe94560, shape: "circle" },
  [Choice.Paper]: { label: "PAPER", color: 0x533483, shape: "rect" },
  [Choice.Scissors]: { label: "SCISSORS", color: 0x0f3460, shape: "triangle" },
};

export class GameScene extends Phaser.Scene {
  private room: Room | null = null;
  private spectating = false;

  // UI elements
  private phaseText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private p1NameText!: Phaser.GameObjects.Text;
  private p2NameText!: Phaser.GameObjects.Text;
  private p1ScoreText!: Phaser.GameObjects.Text;
  private p2ScoreText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private spectatorText!: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  private resultText!: Phaser.GameObjects.Text;
  private p1ChoiceDisplay!: Phaser.GameObjects.Container;
  private p2ChoiceDisplay!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private matchEndContainer!: Phaser.GameObjects.Container;
  private hasChosen = false;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data: { spectating?: boolean }) {
    this.spectating = data.spectating ?? false;
    this.hasChosen = false;
  }

  create() {
    this.room = network.getRoom();
    if (!this.room) {
      this.scene.start("LobbyScene");
      return;
    }

    this.createUI();
    this.setupListeners();
  }

  private createUI() {
    const { width, height } = this.scale;

    // Top bar background
    this.add.rectangle(width / 2, 30, width, 60, 0x16213e);

    // Player 1 info (left)
    this.p1NameText = this.add
      .text(20, 18, "Waiting...", {
        fontSize: "18px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);

    this.p1ScoreText = this.add
      .text(20, 38, "Score: 0", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);

    // Round counter (center)
    this.roundText = this.add
      .text(width / 2, 30, "Round 0", {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Player 2 info (right)
    this.p2NameText = this.add
      .text(width - 20, 18, "Waiting...", {
        fontSize: "18px",
        color: "#533483",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(1, 0);

    this.p2ScoreText = this.add
      .text(width - 20, 38, "Score: 0", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0);

    // Phase / status text
    this.phaseText = this.add
      .text(width / 2, height / 2 - 80, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Countdown text (large, centered)
    this.countdownText = this.add
      .text(width / 2, height / 2, "", {
        fontSize: "96px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    // Result text
    this.resultText = this.add
      .text(width / 2, height / 2, "", {
        fontSize: "32px",
        color: "#53cf8a",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    // Choice displays for reveal phase
    this.p1ChoiceDisplay = this.add.container(width / 4, height / 2).setVisible(false);
    this.p2ChoiceDisplay = this.add.container((3 * width) / 4, height / 2).setVisible(false);

    // Banner text (for disconnection messages)
    this.bannerText = this.add
      .text(width / 2, 80, "", {
        fontSize: "16px",
        color: "#ffcc00",
        fontFamily: "monospace",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    // Match end container
    this.matchEndContainer = this.add.container(0, 0).setVisible(false);

    // Bottom bar
    this.add.rectangle(width / 2, height - 25, width, 50, 0x16213e);

    // Spectator count
    this.spectatorText = this.add
      .text(width - 20, height - 25, "", {
        fontSize: "14px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0.5);

    // Leave button
    const leaveBg = this.add
      .rectangle(70, height - 25, 120, 36, 0xe94560)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(70, height - 25, "LEAVE", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    leaveBg.on("pointerdown", () => {
      network.disconnect();
      this.scene.start("LobbyScene");
    });

    if (this.spectating) {
      this.add
        .text(width / 2, height - 25, "SPECTATING", {
          fontSize: "14px",
          color: "#ffcc00",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);
    }

    // Create choice buttons (hidden initially)
    this.createChoiceButtons();
  }

  private createChoiceButtons() {
    const { width, height } = this.scale;
    const choices = [Choice.Rock, Choice.Paper, Choice.Scissors];
    const startX = width / 2 - 200;
    const y = height / 2 + 40;

    choices.forEach((choice, index) => {
      const x = startX + index * 200;
      const config = CHOICE_SHAPES[choice];
      const container = this.add.container(x, y);

      // Shape
      let shape: Phaser.GameObjects.Shape;
      if (config.shape === "circle") {
        shape = this.add.circle(0, 0, 45, config.color);
      } else if (config.shape === "rect") {
        shape = this.add.rectangle(0, 0, 90, 90, config.color);
      } else {
        shape = this.add.triangle(0, 0, 45, 0, 90, 90, 0, 90, config.color);
        shape.setOrigin(0.5);
      }

      shape.setInteractive({ useHandCursor: true });

      const label = this.add
        .text(0, 65, config.label, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);

      shape.on("pointerover", () => shape.setAlpha(0.8));
      shape.on("pointerout", () => shape.setAlpha(1));
      shape.on("pointerdown", () => {
        if (this.hasChosen || this.spectating) return;
        this.hasChosen = true;
        this.room?.send(ClientMessage.MakeChoice, { choice });

        // Visual feedback
        this.choiceButtons.forEach((btn) => btn.setAlpha(0.3));
        container.setAlpha(1);

        this.phaseText.setText("Locked in! Waiting for opponent...");
      });

      container.add([shape, label]);
      container.setVisible(false);
      this.choiceButtons.push(container);
    });
  }

  private setupListeners() {
    if (!this.room) return;
    const room = this.room;
    const state = room.state as Record<string, unknown>;
    const $ = Callbacks.get(room);

    // Watch phase changes
    $.listen("phase" as never, (newPhase: string) => {
      this.onPhaseChange(newPhase);
    });

    // Watch countdown
    $.listen("countdownRemaining" as never, (value: number) => {
      if (state.phase === RoomPhase.Countdown) {
        this.countdownText.setText(value.toString());
        this.countdownText.setVisible(true);

        // Scale animation
        this.countdownText.setScale(1.5);
        this.tweens.add({
          targets: this.countdownText,
          scale: 1,
          duration: 400,
          ease: "Back.easeOut",
        });
      }
    });

    // Watch player changes
    $.onAdd("players" as never, (player: Record<string, unknown>, _sessionId: string) => {
      this.updatePlayerDisplay(state);

      $.listen(player as never, "score" as never, () => { this.updatePlayerDisplay(state); });
      $.listen(player as never, "hasChosen" as never, () => { this.updateOpponentStatus(state); });
      $.listen(player as never, "connected" as never, () => { this.updateConnectionStatus(state); });
    });

    $.onRemove("players" as never, () => {
      this.updatePlayerDisplay(state);
    });

    // Watch spectator count
    $.listen("spectatorCount" as never, (count: number) => {
      this.spectatorText.setText(count > 0 ? `Spectators: ${count}` : "");
    });

    // Server messages
    room.onMessage(ServerMessage.OpponentDisconnected, () => {
      this.bannerText.setText("Opponent disconnected - waiting for reconnection...");
      this.bannerText.setVisible(true);
    });

    room.onMessage(ServerMessage.OpponentReconnected, () => {
      this.bannerText.setVisible(false);
    });

    room.onMessage(ServerMessage.Error, (data: { message: string }) => {
      console.warn("Server error:", data.message);
    });

    // Trigger initial state
    this.onPhaseChange(state.phase as string);
    this.updatePlayerDisplay(state);
  }

  private onPhaseChange(phase: string) {
    const state = this.room?.state as Record<string, unknown> | undefined;

    // Hide everything first
    this.countdownText.setVisible(false);
    this.resultText.setVisible(false);
    this.p1ChoiceDisplay.setVisible(false);
    this.p2ChoiceDisplay.setVisible(false);
    this.matchEndContainer.setVisible(false);
    this.choiceButtons.forEach((btn) => {
      btn.setVisible(false);
      btn.setAlpha(1);
    });

    switch (phase) {
      case RoomPhase.WaitingForPlayers:
        this.phaseText.setText("Waiting for opponent...");
        break;

      case RoomPhase.Countdown:
        this.phaseText.setText("Get ready!");
        this.hasChosen = false;
        break;

      case RoomPhase.Choosing:
        this.phaseText.setText("Choose your weapon!");
        this.hasChosen = false;
        if (!this.spectating) {
          this.choiceButtons.forEach((btn) => btn.setVisible(true));
        } else {
          this.phaseText.setText("Players are choosing...");
        }
        break;

      case RoomPhase.Revealing:
        this.phaseText.setText("");
        this.showReveal(state);
        break;

      case RoomPhase.RoundEnd:
        this.showRoundResult(state);
        break;

      case RoomPhase.MatchEnd:
        this.showMatchEnd(state);
        break;
    }

    if (state) {
      this.roundText.setText(
        state.currentRound > 0
          ? `Round ${state.currentRound} / Bo${state.matchFormat}`
          : `Bo${state.matchFormat}`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updatePlayerDisplay(state: any) {
    const p1 = state.players.get(state.player1Id);
    const p2 = state.players.get(state.player2Id);

    this.p1NameText.setText(p1 ? p1.name : "Waiting...");
    this.p1ScoreText.setText(p1 ? `Score: ${p1.score}` : "Score: 0");
    this.p2NameText.setText(p2 ? p2.name : "Waiting...");
    this.p2ScoreText.setText(p2 ? `Score: ${p2.score}` : "Score: 0");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Colyseus untyped state
  private updateOpponentStatus(state: any) {
    if (state.phase !== RoomPhase.Choosing) return;

    const myId = this.room?.sessionId;
    let opponentHasChosen = false;

    state.players.forEach((player: any, playerId: string) => {
      if (playerId !== myId && player.hasChosen) {
        opponentHasChosen = true;
      }
    });

    if (opponentHasChosen && this.hasChosen) {
      this.phaseText.setText("Both locked in! Revealing...");
    } else if (opponentHasChosen && !this.hasChosen) {
      this.phaseText.setText("Opponent is ready! Make your choice!");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateConnectionStatus(state: any) {
    let allConnected = true;
    state.players.forEach((player: any) => {
      if (!player.connected) allConnected = false;
    });

    if (allConnected) {
      this.bannerText.setVisible(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private showReveal(state: any) {
    const { height } = this.scale;
    const p1 = state.players.get(state.player1Id);
    const p2 = state.players.get(state.player2Id);

    if (!p1 || !p2) return;

    // Show P1 choice
    this.renderChoice(this.p1ChoiceDisplay, p1.currentChoice as Choice, p1.name);
    this.p1ChoiceDisplay.setVisible(true);
    this.p1ChoiceDisplay.setScale(0);
    this.tweens.add({
      targets: this.p1ChoiceDisplay,
      scale: 1,
      duration: 500,
      ease: "Back.easeOut",
    });

    // Show P2 choice with slight delay
    this.time.delayedCall(300, () => {
      this.renderChoice(this.p2ChoiceDisplay, p2.currentChoice as Choice, p2.name);
      this.p2ChoiceDisplay.setVisible(true);
      this.p2ChoiceDisplay.setScale(0);
      this.tweens.add({
        targets: this.p2ChoiceDisplay,
        scale: 1,
        duration: 500,
        ease: "Back.easeOut",
      });
    });

    // "VS" text
    this.phaseText.setText("VS");
    this.phaseText.setFontSize(48);
    this.phaseText.setY(height / 2);
  }

  private renderChoice(container: Phaser.GameObjects.Container, choice: Choice, name: string) {
    container.removeAll(true);
    const config = CHOICE_SHAPES[choice];

    let shape: Phaser.GameObjects.Shape;
    if (config.shape === "circle") {
      shape = this.add.circle(0, 0, 55, config.color);
    } else if (config.shape === "rect") {
      shape = this.add.rectangle(0, 0, 110, 110, config.color);
    } else {
      shape = this.add.triangle(0, 0, 55, 0, 110, 110, 0, 110, config.color);
      shape.setOrigin(0.5);
    }

    const label = this.add
      .text(0, 80, config.label, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const nameLabel = this.add
      .text(0, -80, name, {
        fontSize: "16px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    container.add([shape, label, nameLabel]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private showRoundResult(state: any) {
    const { height } = this.scale;
    const rounds = state.rounds;
    if (rounds.length === 0) return;

    const lastRound = rounds[rounds.length - 1];
    const myId = this.room?.sessionId;

    let resultMsg: string;
    let color: string;

    if (lastRound.result === "draw") {
      resultMsg = "DRAW!";
      color = "#ffcc00";
    } else {
      const winnerId =
        lastRound.result === "player1" ? state.player1Id : state.player2Id;

      if (this.spectating) {
        const winner = state.players.get(winnerId);
        resultMsg = `${winner?.name ?? "Unknown"} wins the round!`;
        color = "#53cf8a";
      } else if (winnerId === myId) {
        resultMsg = "YOU WIN THIS ROUND!";
        color = "#53cf8a";
      } else {
        resultMsg = "YOU LOSE THIS ROUND";
        color = "#e94560";
      }
    }

    // Keep reveal visible
    this.p1ChoiceDisplay.setVisible(true);
    this.p2ChoiceDisplay.setVisible(true);

    this.resultText.setText(resultMsg);
    this.resultText.setColor(color);
    this.resultText.setY(height / 2 + 140);
    this.resultText.setVisible(true);
    this.resultText.setScale(0);
    this.tweens.add({
      targets: this.resultText,
      scale: 1,
      duration: 400,
      ease: "Back.easeOut",
    });

    this.phaseText.setText("VS");
    this.phaseText.setFontSize(48);
    this.phaseText.setY(height / 2);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private showMatchEnd(state: any) {
    const { width, height } = this.scale;
    this.matchEndContainer.removeAll(true);

    const winnerId = state.winnerId;
    const winner = state.players.get(winnerId);
    const p1 = state.players.get(state.player1Id);
    const p2 = state.players.get(state.player2Id);
    const myId = this.room?.sessionId;

    // Result text
    let titleMsg: string;
    let titleColor: string;

    if (this.spectating) {
      titleMsg = `${winner?.name ?? "Unknown"} WINS!`;
      titleColor = "#53cf8a";
    } else if (winnerId === myId) {
      titleMsg = "VICTORY!";
      titleColor = "#53cf8a";
    } else {
      titleMsg = "DEFEAT";
      titleColor = "#e94560";
    }

    const title = this.add
      .text(width / 2, height / 2 - 80, titleMsg, {
        fontSize: "48px",
        color: titleColor,
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const score = this.add
      .text(
        width / 2,
        height / 2 - 20,
        `${p1?.name ?? "P1"} ${p1?.score ?? 0} - ${p2?.score ?? 0} ${p2?.name ?? "P2"}`,
        {
          fontSize: "24px",
          color: "#ffffff",
          fontFamily: "monospace",
        }
      )
      .setOrigin(0.5);

    this.matchEndContainer.add([title, score]);

    if (!this.spectating) {
      // Play Again button
      const playAgainBg = this.add
        .rectangle(width / 2 - 110, height / 2 + 60, 180, 44, 0x53cf8a)
        .setInteractive({ useHandCursor: true });
      const playAgainText = this.add
        .text(width / 2 - 110, height / 2 + 60, "PLAY AGAIN", {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      playAgainBg.on("pointerdown", () => {
        this.room?.send(ClientMessage.PlayAgain);
        playAgainText.setText("WAITING...");
        playAgainBg.setFillStyle(0x888888);
        playAgainBg.disableInteractive();
      });

      // Back to Lobby button
      const lobbyBg = this.add
        .rectangle(width / 2 + 110, height / 2 + 60, 180, 44, 0x0f3460)
        .setInteractive({ useHandCursor: true });
      const lobbyText = this.add
        .text(width / 2 + 110, height / 2 + 60, "LOBBY", {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      lobbyBg.on("pointerdown", () => {
        network.disconnect();
        this.scene.start("LobbyScene");
      });

      this.matchEndContainer.add([playAgainBg, playAgainText, lobbyBg, lobbyText]);
    }

    this.matchEndContainer.setVisible(true);
    this.phaseText.setText("");
  }

  shutdown() {
    // Room cleanup happens via network.disconnect() or when leaving
  }
}
