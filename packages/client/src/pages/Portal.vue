<template>
  <main class="portal">
    <section class="hero">
      <p class="hero-kicker">Realtime multiplayer</p>
      <h1 class="hero-title">Rock Paper Scissors</h1>
      <p class="hero-copy">
        Jump into an open room, host a fresh match, and track the hottest streaks without leaving the lobby.
      </p>
    </section>

    <section class="portal-grid">
      <PortalLobby :player-name="playerName" @update:player-name="playerName = $event" />
      <PortalLeaderboard />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import PortalLobby from "../components/PortalLobby.vue";
import PortalLeaderboard from "../components/PortalLeaderboard.vue";
import { getPlayerName } from "../lib/player-name";

defineOptions({ name: "PortalPage" });

const playerName = ref(getPlayerName());
</script>

<style scoped>
.portal {
  display: flex;
  flex-direction: column;
  gap: 28px;
  width: min(1280px, 100%);
}

.hero {
  position: relative;
  overflow: hidden;
  padding: 34px 36px;
  border: 1px solid rgba(255, 179, 107, 0.16);
  border-radius: 30px;
  background:
    radial-gradient(circle at top left, rgba(255, 179, 107, 0.24), transparent 28%),
    radial-gradient(circle at bottom right, rgba(91, 215, 178, 0.18), transparent 32%),
    linear-gradient(135deg, rgba(14, 27, 52, 0.95), rgba(8, 15, 29, 0.98));
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 240, 255, 0.02) 2px,
    rgba(0, 240, 255, 0.02) 4px
  );
  pointer-events: none;
  border-radius: 30px;
}

.hero-kicker {
  color: var(--neon-amber, #ffd426);
  font-size: 12px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.hero-title {
  margin-top: 10px;
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(32px, 8vw, 78px);
  font-weight: 900;
  line-height: 0.94;
  color: #fff6d6;
  text-shadow: 0 0 40px rgba(255, 214, 122, 0.3);
  letter-spacing: 0.02em;
}

.hero-copy {
  max-width: 620px;
  margin-top: 14px;
  color: rgba(255, 244, 214, 0.74);
  font-size: 16px;
  line-height: 1.6;
}

.portal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
  gap: 24px;
  align-items: stretch;
}

@media (max-width: 980px) {
  .portal-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .portal {
    gap: 20px;
  }

  .hero {
    padding: 24px 20px;
    border-radius: 20px;
  }

  .hero-kicker {
    font-size: 10px;
  }

  .hero-title {
    line-height: 1;
  }

  .hero-copy {
    font-size: 14px;
    line-height: 1.5;
    margin-top: 10px;
  }

  .portal-grid {
    gap: 16px;
  }
}

@media (max-width: 400px) {
  .hero {
    padding: 20px 16px;
  }

  .hero-title {
    font-size: 28px;
  }

  .hero-copy {
    font-size: 13px;
  }
}
</style>
