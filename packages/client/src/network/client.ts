import { Client, Room } from "@colyseus/sdk";
import type { MatchFormat } from "@rps/shared";

class NetworkManager {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    this.client = new Client(`${protocol}://${window.location.host}`);
  }

  async getAvailableRooms() {
    const protocol = window.location.protocol;
    const res = await fetch(`${protocol}//${window.location.host}/matchmake/rps`);
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
