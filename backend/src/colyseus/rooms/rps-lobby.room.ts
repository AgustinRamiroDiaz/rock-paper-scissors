import { LobbyRoom, type Client, type Room } from "colyseus";
import type { IRoomCache } from "@colyseus/core";
import type { RPSRoomMetadata } from "@rps/shared";

interface LobbyClientMessages {
  rooms: IRoomCache<RPSRoomMetadata>[];
  "+": [roomId: string, room: IRoomCache<RPSRoomMetadata>];
  "-": string;
  lobby_count: number;
}

interface LobbyClientOptions {
  filter?: {
    name?: string;
    metadata?: Partial<RPSRoomMetadata>;
  };
}

type TypedLobbyRoom = Room<{
  client: Client<{ messages: LobbyClientMessages }>;
}>;

export class RPSLobbyRoom extends LobbyRoom<RPSRoomMetadata> implements TypedLobbyRoom {
  onJoin(client: Client<{ messages: LobbyClientMessages }>, options: LobbyClientOptions) {
    super.onJoin(client, options);
    this.broadcastLobbyCount();
  }

  onLeave(client: Client<{ messages: LobbyClientMessages }>) {
    super.onLeave(client);
    this.broadcastLobbyCount();
  }

  private broadcastLobbyCount() {
    this.broadcast("lobby_count", this.clients.length);
  }
}
