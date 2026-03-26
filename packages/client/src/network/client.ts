import { Client, Room, type RoomAvailable } from "@colyseus/sdk";
import type { MatchFormat } from "@rps/shared";

export const SERVER_URL = "localhost:2567";

type RoomMetadata = { roomName: string; matchFormat: number };
type AvailableRoom = RoomAvailable<RoomMetadata>;
type LobbyRoom = Room<{
  messages: {
    rooms: AvailableRoom[];
    "+": [roomId: string, room: AvailableRoom];
    "-": string;
    lobby_count: number;
  };
}>;

class NetworkManager {
  private client: Client;
  private room: Room | null = null;
  private lobbyRoom: LobbyRoom | null = null;
  private lobbyConnectPromise: Promise<LobbyRoom> | null = null;
  private availableRooms: AvailableRoom[] = [];
  private lobbyCount = 0;
  private lobbySubscribers = new Set<(rooms: AvailableRoom[]) => void>();
  private lobbyCountSubscribers = new Set<(count: number) => void>();

  constructor() {
    this.client = new Client(`ws://${SERVER_URL}`);
  }

  async connectLobby() {
    if (this.lobbyRoom) return this.lobbyRoom;
    if (this.lobbyConnectPromise) return this.lobbyConnectPromise;

    this.lobbyConnectPromise = (async () => {
      const lobby = await this.client.joinOrCreate("lobby", {
        filter: {
          name: "rps",
        },
      }) as LobbyRoom;

      lobby.onMessage("rooms", (rooms) => {
        this.availableRooms = [...rooms];
        this.notifyLobbySubscribers();
      });

      lobby.onMessage("+", ([roomId, room]) => {
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

      lobby.onMessage("-", (roomId) => {
        this.availableRooms = this.availableRooms.filter((entry) => entry.roomId !== roomId);
        this.notifyLobbySubscribers();
      });

      lobby.onMessage("lobby_count", (count) => {
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
      if (this.lobbySubscribers.size === 0 && this.lobbyCountSubscribers.size === 0) {
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
      if (this.lobbySubscribers.size === 0 && this.lobbyCountSubscribers.size === 0) {
        void this.leaveLobby();
      }
    };
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
  }
}

export const network = new NetworkManager();
