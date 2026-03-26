import { Client, Room } from "@colyseus/sdk";
import type { MatchFormat } from "@rps/shared";

export const SERVER_URL = "localhost:2567";

class NetworkManager {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client(`ws://${SERVER_URL}`);
  }

  async getAvailableRooms() {
    const res = await fetch(`http://${SERVER_URL}/matchmake/rps`);
    if (!res.ok) return [];
    return res.json() as Promise<unknown[]>;
  }

  async createRoom(playerName: string, matchFormat: MatchFormat) {
    this.room = await this.client.create("rps", {
      name: playerName,
      matchFormat,
    });
    return this.room;
  }

  async joinRoom(roomId: string, playerName: string, spectate = false) {
    this.room = await this.client.joinById(roomId, {
      name: playerName,
      spectate,
    });
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  disconnect() {
    void this.room?.leave();
    this.room = null;
  }
}

export const network = new NetworkManager();
