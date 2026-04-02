import { Client, Room, type RoomAvailable } from "@colyseus/sdk";
import type { MatchFormat } from "@rps/shared";
import type { RPSRoomMetadata } from "@rps/shared";

declare global {
  interface Window {
    __RPS_ROOM_ID?: string;
  }
}

const DEFAULT_BACKEND_HOST = "localhost:2567";

function normalizeHost(value: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed == null || trimmed === "") return DEFAULT_BACKEND_HOST;
  return trimmed.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/+$/, "");
}

function resolveProtocol(secure: "http" | "ws") {
  const protocol = globalThis.location.protocol;
  if (secure === "http") {
    return protocol === "https:" ? "https" : "http";
  }

  return protocol === "https:" ? "wss" : "ws";
}

export const SERVER_HOST = normalizeHost(import.meta.env.VITE_SERVER_HOST);
export const SERVER_HTTP_URL = `${resolveProtocol("http")}://${SERVER_HOST}`;
export const SERVER_WS_URL = `${resolveProtocol("ws")}://${SERVER_HOST}`;

type AvailableRoom = RoomAvailable<RPSRoomMetadata>;

class NetworkManager {
  private client: Client;
  private room: Room | null = null;
  private lobbyRoom: Room | null = null;
  private lobbyConnectPromise: Promise<Room> | null = null;
  private availableRooms: AvailableRoom[] = [];
  private lobbyCount = 0;
  private lobbySubscribers = new Set<(rooms: AvailableRoom[]) => void>();
  private lobbyCountSubscribers = new Set<(count: number) => void>();

  constructor() {
    this.client = new Client(SERVER_WS_URL);
  }

  async connectLobby() {
    if (this.lobbyRoom) return this.lobbyRoom;
    if (this.lobbyConnectPromise) return this.lobbyConnectPromise;

    this.lobbyConnectPromise = (async () => {
      const lobby = await this.client.joinOrCreate("lobby", {
        filter: {
          name: "rps",
        },
      });

      lobby.onMessage("rooms", (rooms: AvailableRoom[]) => {
        this.availableRooms = [...rooms];
        this.notifyLobbySubscribers();
      });

      lobby.onMessage("+", ([roomId, room]: [string, AvailableRoom]) => {
        const index = this.availableRooms.findIndex((entry) => entry.roomId === roomId);
        if (index === -1) {
          this.availableRooms = [...this.availableRooms, room];
        } else {
          this.availableRooms = this.availableRooms.map((entry, entryIndex) => (
            entryIndex === index ? room : entry
          ));
        }
        this.notifyLobbySubscribers();
      });

      lobby.onMessage("-", (roomId: string) => {
        this.availableRooms = this.availableRooms.filter((entry) => entry.roomId !== roomId);
        this.notifyLobbySubscribers();
      });

      lobby.onMessage("lobby_count", (count: number) => {
        this.lobbyCount = count;
        this.notifyLobbyCountSubscribers();
      });

      lobby.onLeave(() => {
        this.lobbyRoom = null;
        this.lobbyConnectPromise = null;
        this.availableRooms = [];
        this.lobbyCount = 0;
        this.notifyLobbySubscribers();
        this.notifyLobbyCountSubscribers();
      });

      this.lobbyRoom = lobby;
      return lobby;
    })();

    try {
      return await this.lobbyConnectPromise;
    } catch (error) {
      this.lobbyConnectPromise = null;
      throw error;
    }
  }

  async getAvailableRooms() {
    await this.connectLobby();
    return this.availableRooms;
  }

  async subscribeAvailableRooms(callback: (rooms: AvailableRoom[]) => void) {
    this.lobbySubscribers.add(callback);
    await this.connectLobby();
    callback(this.availableRooms);

    return () => {
      this.lobbySubscribers.delete(callback);
      if (this.lobbySubscribers.size === 0 && this.lobbyCountSubscribers.size === 0 && this.room == null) {
        void this.leaveLobby();
      }
    };
  }

  async subscribeLobbyCount(callback: (count: number) => void) {
    this.lobbyCountSubscribers.add(callback);
    await this.connectLobby();
    callback(this.lobbyCount);

    return () => {
      this.lobbyCountSubscribers.delete(callback);
      if (this.lobbySubscribers.size === 0 && this.lobbyCountSubscribers.size === 0 && this.room == null) {
        void this.leaveLobby();
      }
    };
  }

  async createRoom(playerName: string, matchFormat: MatchFormat) {
    this.room = await this.client.create("rps", {
      name: playerName,
      matchFormat,
    });
    this.publishCurrentRoomId();
    return this.room;
  }

  async joinRoom(roomId: string, playerName: string, spectate = false) {
    this.room = await this.client.joinById(roomId, {
      name: playerName,
      spectate,
    });
    this.publishCurrentRoomId();
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  private notifyLobbySubscribers() {
    const snapshot = [...this.availableRooms];
    this.lobbySubscribers.forEach((callback) => { callback(snapshot); });
  }

  private notifyLobbyCountSubscribers() {
    const snapshot = this.lobbyCount;
    this.lobbyCountSubscribers.forEach((callback) => { callback(snapshot); });
  }

  private async leaveLobby() {
    const lobby = this.lobbyRoom;
    this.lobbyRoom = null;
    this.lobbyConnectPromise = null;
    this.availableRooms = [];
    this.lobbyCount = 0;
    if (lobby) {
      await lobby.leave();
    }
  }

  disconnect() {
    void this.room?.leave();
    this.room = null;
    this.publishCurrentRoomId();
    if (this.lobbySubscribers.size === 0 && this.lobbyCountSubscribers.size === 0) {
      void this.leaveLobby();
    }
  }

  private publishCurrentRoomId() {
    globalThis.window.__RPS_ROOM_ID = this.room?.roomId;
  }
}

export const network = new NetworkManager();
