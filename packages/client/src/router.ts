import { createRouter, createWebHistory } from "vue-router";
import Portal from "./pages/Portal.vue";
import Game from "./pages/Game.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Portal },
    { path: "/lobby", redirect: "/" },
    { path: "/game", component: Game },
    { path: "/leaderboard", redirect: "/" },
  ],
});
