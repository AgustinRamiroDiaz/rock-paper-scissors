import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  private inputElement: HTMLInputElement | null = null;

  constructor() {
    super({ key: "BootScene" });
  }

  create() {
    const { width, height } = this.scale;

    // Title
    this.add
      .text(width / 2, height / 3, "Rock Paper Scissors", {
        fontSize: "48px",
        color: "#e94560",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height / 3 + 60, "Multiplayer", {
        fontSize: "24px",
        color: "#16213e",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // Create HTML input for name
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.placeholder = "Enter your name...";
    inputEl.maxLength = 16;
    inputEl.style.cssText = `
      position: absolute;
      font-size: 20px;
      padding: 10px 20px;
      border: 2px solid #e94560;
      border-radius: 8px;
      background: #16213e;
      color: #ffffff;
      text-align: center;
      outline: none;
      font-family: monospace;
      width: 280px;
    `;
    this.inputElement = inputEl;

    const domElement = this.add.dom(width / 2, height / 2 + 20, inputEl);
    domElement.setOrigin(0.5);

    // Continue button
    const btnBg = this.add
      .rectangle(width / 2, height / 2 + 100, 200, 50, 0xe94560)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add
      .text(width / 2, height / 2 + 100, "PLAY", {
        fontSize: "22px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    btnBg.on("pointerover", () => btnBg.setFillStyle(0xff6b81));
    btnBg.on("pointerout", () => btnBg.setFillStyle(0xe94560));

    const submit = () => {
      const name = inputEl.value.trim();
      if (name.length === 0) {
        inputEl.style.borderColor = "#ff0000";
        return;
      }
      this.registry.set("playerName", name);
      this.cleanup();
      this.scene.start("LobbyScene");
    };

    btnBg.on("pointerdown", submit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    // Auto focus
    this.time.delayedCall(100, () => inputEl.focus());
  }

  private cleanup() {
    if (this.inputElement) {
      this.inputElement.remove();
      this.inputElement = null;
    }
  }

  shutdown() {
    this.cleanup();
  }
}
