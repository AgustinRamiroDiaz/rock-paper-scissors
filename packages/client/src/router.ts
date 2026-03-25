import { createRouter, createWebHistory } from "vue-router";
import NameEntry from "./pages/NameEntry.vue";
import Lobby from "./pages/Lobby.vue";
import Game from "./pages/Game.vue";
import Leaderboard from "./pages/Leaderboard.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: NameEntry },
    { path: "/lobby", component: Lobby },
    { path: "/game", component: Game },
    { path: "/leaderboard", component: Leaderboard },
  ],
});
