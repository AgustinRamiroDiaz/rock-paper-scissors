import Phaser from "phaser";
import type { LeaderboardEntry } from "@rps/shared";

export class LeaderboardScene extends Phaser.Scene {
  private fromScene = "LobbyScene";

  constructor() {
    super({ key: "LeaderboardScene" });
  }

  init(data: { from?: string }) {
    this.fromScene = data.from ?? "LobbyScene";
  }

  async create() {
    const { width, height } = this.scale;

    // Header
    this.add
      .text(width / 2, 30, "LEADERBOARD", {
        fontSize: "36px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Back button
    const backBg = this.add
      .rectangle(70, 30, 100, 36, 0x16213e)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(70, 30, "< BACK", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    backBg.on("pointerdown", () => {
      this.scene.start(this.fromScene);
    });

    // Table header
    const headerY = 80;
    const cols = [40, 180, 380, 480, 570, 660, 800];
    const headers = ["#", "NAME", "WINS", "LOSSES", "DRAWS", "GAMES", "WIN RATE"];
    headers.forEach((header, i) => {
      this.add.text(cols[i], headerY, header, {
        fontSize: "14px",
        color: "#8899aa",
        fontFamily: "monospace",
        fontStyle: "bold",
      });
    });

    // Separator line
    this.add
      .rectangle(width / 2, headerY + 25, width - 60, 1, 0x333333);

    // Loading text
    const loadingText = this.add
      .text(width / 2, height / 2, "Loading...", {
        fontSize: "18px",
        color: "#8899aa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    try {
      const response = await fetch("/api/leaderboard?limit=15");
      const entries = await response.json() as LeaderboardEntry[];
      loadingText.destroy();

      if (entries.length === 0) {
        this.add
          .text(width / 2, height / 2, "No matches played yet", {
            fontSize: "18px",
            color: "#8899aa",
            fontFamily: "monospace",
          })
          .setOrigin(0.5);
        return;
      }

      entries.forEach((entry, index) => {
        const y = headerY + 45 + index * 32;
        const total = entry.wins + entry.losses + entry.draws;
        const winRateStr = `${(entry.winRate * 100).toFixed(0)}%`;
        const rankColor = index < 3 ? "#e94560" : "#ffffff";

        const values = [
          `${index + 1}`,
          entry.playerName,
          `${entry.wins}`,
          `${entry.losses}`,
          `${entry.draws}`,
          `${total}`,
          winRateStr,
        ];

        values.forEach((val, i) => {
          this.add.text(cols[i], y, val, {
            fontSize: "16px",
            color: i === 0 ? rankColor : "#ffffff",
            fontFamily: "monospace",
          });
        });

        // Row highlight for top 3
        if (index < 3) {
          this.add
            .rectangle(width / 2, y + 8, width - 60, 28, 0xe94560, 0.08);
        }
      });
    } catch {
      loadingText.setText("Failed to load leaderboard");
    }
  }
}
