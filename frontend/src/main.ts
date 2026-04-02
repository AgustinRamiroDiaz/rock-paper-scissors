import { createApp } from "vue";
import { router } from "./router";
import App from "./App.vue";
import { ensurePlayerName } from "./lib/player-name";

ensurePlayerName();

const app = createApp(App);
app.use(router);
app.mount("#app");
