import Phaser from "phaser";
import { network } from "../network/client";
import { MatchFormat } from "@rps/shared";

interface RoomListing {
  roomId: string;
  metadata: { roomName: string; matchFormat: number };
  clients: number;
  maxClients: number;
}

export class LobbyScene extends Phaser.Scene {
  private roomListContainer: Phaser.GameObjects.Container | null = null;
  private refreshTimer: Phaser.Time.TimerEvent | null = null;
  private createPanel: Phaser.GameObjects.Container | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create() {
    const { width, height } = this.scale;
    const playerName = this.registry.get("playerName") ?? "Anonymous";

    // Header
    this.add
      .text(width / 2, 30, "LOBBY", {
        fontSize: "36px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width - 20, 30, `Player: ${playerName}`, {
        fontSize: "16px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0.5);

    // Room list area
    this.roomListContainer = this.add.container(0, 80);

    // Status text
    this.statusText = this.add
      .text(width / 2, height / 2, "Loading rooms...", {
        fontSize: "18px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Buttons row at bottom
    const btnY = height - 50;

    this.createButton(width / 2 - 200, btnY, "CREATE ROOM", 0xe94560, () => {
      this.showCreatePanel();
    });

    this.createButton(width / 2, btnY, "REFRESH", 0x533483, () => {
      this.refreshRooms();
    });

    this.createButton(width / 2 + 200, btnY, "LEADERBOARD", 0x0f3460, () => {
      this.cleanupTimers();
      this.scene.start("LeaderboardScene", { from: "LobbyScene" });
    });

    // Auto-refresh
    this.refreshRooms();
    this.refreshTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.refreshRooms(),
    });
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ) {
    const bg = this.add
      .rectangle(x, y, 180, 44, color)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setAlpha(0.8));
    bg.on("pointerout", () => bg.setAlpha(1));
    bg.on("pointerdown", onClick);

    return bg;
  }

  private async refreshRooms() {
    try {
      const rooms = (await network.getAvailableRooms()) as RoomListing[];
      this.renderRoomList(rooms);
    } catch (err) {
      if (this.statusText) {
        this.statusText.setText("Failed to fetch rooms");
      }
    }
  }

  private renderRoomList(rooms: RoomListing[]) {
    if (!this.roomListContainer) return;
    this.roomListContainer.removeAll(true);

    const { width } = this.scale;

    if (rooms.length === 0) {
      if (this.statusText) {
        this.statusText.setText("No rooms available. Create one!");
        this.statusText.setVisible(true);
      }
      return;
    }

    if (this.statusText) this.statusText.setVisible(false);

    rooms.forEach((room, index) => {
      const y = index * 60;
      const roomName = room.metadata?.roomName ?? "RPS Game";
      const format = room.metadata?.matchFormat === 5 ? "Bo5" : "Bo3";
      const playerCount = room.clients;
      const isFull = playerCount >= 2;

      // Room row background
      const bg = this.add
        .rectangle(width / 2, y + 20, width - 80, 50, 0x16213e)
        .setInteractive({ useHandCursor: true });

      // Room info
      this.add
        .text(60, y + 20, `${roomName}  [${format}]`, {
          fontSize: "18px",
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(width - 250, y + 20, `${playerCount}/2 players`, {
          fontSize: "16px",
          color: isFull ? "#e94560" : "#53cf8a",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0.5);

      // Join/Spectate button
      const btnLabel = isFull ? "SPECTATE" : "JOIN";
      const btnColor = isFull ? 0x533483 : 0x53cf8a;
      const joinBtn = this.add
        .rectangle(width - 80, y + 20, 100, 36, btnColor)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(width - 80, y + 20, btnLabel, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      joinBtn.on("pointerdown", async () => {
        const playerName = this.registry.get("playerName") ?? "Anonymous";
        try {
          await network.joinRoom(room.roomId, playerName, isFull);
          this.cleanupTimers();
          this.scene.start("GameScene", { spectating: isFull });
        } catch (err) {
          console.error("Failed to join room:", err);
        }
      });

      this.roomListContainer!.add([bg, joinBtn]);
    });
  }

  private showCreatePanel() {
    if (this.createPanel) return;

    const { width, height } = this.scale;
    const panel = this.add.container(0, 0);
    this.createPanel = panel;

    // Overlay
    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setInteractive();

    // Panel background
    const panelBg = this.add.rectangle(
      width / 2,
      height / 2,
      400,
      250,
      0x16213e
    );
    panelBg.setStrokeStyle(2, 0xe94560);

    const title = this.add
      .text(width / 2, height / 2 - 80, "CREATE ROOM", {
        fontSize: "24px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Best of 3 button
    const bo3 = this.add
      .rectangle(width / 2, height / 2 - 20, 300, 44, 0x533483)
      .setInteractive({ useHandCursor: true });
    const bo3Text = this.add
      .text(width / 2, height / 2 - 20, "Best of 3", {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Best of 5 button
    const bo5 = this.add
      .rectangle(width / 2, height / 2 + 35, 300, 44, 0x533483)
      .setInteractive({ useHandCursor: true });
    const bo5Text = this.add
      .text(width / 2, height / 2 + 35, "Best of 5", {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Cancel button
    const cancel = this.add
      .text(width / 2, height / 2 + 90, "Cancel", {
        fontSize: "16px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const createRoom = async (format: MatchFormat) => {
      const playerName = this.registry.get("playerName") ?? "Anonymous";
      try {
        await network.createRoom(playerName, format);
        this.cleanupTimers();
        this.scene.start("GameScene", { spectating: false });
      } catch (err) {
        console.error("Failed to create room:", err);
      }
    };

    bo3.on("pointerover", () => bo3.setFillStyle(0x6b44a0));
    bo3.on("pointerout", () => bo3.setFillStyle(0x533483));
    bo3.on("pointerdown", () => createRoom(MatchFormat.BestOf3));

    bo5.on("pointerover", () => bo5.setFillStyle(0x6b44a0));
    bo5.on("pointerout", () => bo5.setFillStyle(0x533483));
    bo5.on("pointerdown", () => createRoom(MatchFormat.BestOf5));

    cancel.on("pointerdown", () => {
      panel.destroy(true);
      this.createPanel = null;
    });

    panel.add([overlay, panelBg, title, bo3, bo3Text, bo5, bo5Text, cancel]);
  }

  private cleanupTimers() {
    if (this.refreshTimer) {
      this.refreshTimer.destroy();
      this.refreshTimer = null;
    }
  }

  shutdown() {
    this.cleanupTimers();
  }
}
