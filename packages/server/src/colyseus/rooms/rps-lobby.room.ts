import { LobbyRoom, type Client } from "colyseus";

export class RPSLobbyRoom extends LobbyRoom {
  onJoin(client: Client, options: { filter?: { name?: string; metadata?: unknown } }) {
    super.onJoin(client, options);
    this.broadcastLobbyCount();
  }

  onLeave(client: Client) {
    super.onLeave(client);
    this.broadcastLobbyCount();
  }

  private broadcastLobbyCount() {
    this.broadcast("lobby_count", this.clients.length);
  }
}
