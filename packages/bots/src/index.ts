import { Client, Room, type RoomAvailable } from "@colyseus/sdk";
import { Callbacks } from "@colyseus/sdk";
import { Choice, RoomPhase, type MatchFormat, type RPSRoomMetadata, ClientMessage, MatchFormat as MF } from "@rps/shared";

const DEFAULT_SERVER_URL = "localhost:2567";
const CHOICES: Choice[] = [Choice.Rock, Choice.Paper, Choice.Scissors];

export interface PlayStrategy {
  readonly name: string;
  choose(): Choice;
}

export class RandomChoiceStrategy implements PlayStrategy {
  readonly name = "random";

  choose(): Choice {
    const index = Math.floor(Math.random() * CHOICES.length);
    return CHOICES[index] ?? Choice.Rock;
  }
}

export abstract class BaseBot {
  protected client: Client;
  protected room: Room | null = null;
  protected lobbyRoom: Room | null = null;
  protected playerName: string;
  private readonly strategy: PlayStrategy;
  private isJoining = false;
  private isSettingUpHandlers = false;
  private knownRooms = new Map<string, RoomAvailable<RPSRoomMetadata>>();

  constructor(playerName: string, strategy: PlayStrategy, serverUrl = DEFAULT_SERVER_URL) {
    this.client = new Client(`ws://${serverUrl}`);
    this.playerName = playerName;
    this.strategy = strategy;
  }

  protected log(message: string, ...details: unknown[]): void {
    // Prefix with player name to make multi-bot logs readable.
    console.log(`[${this.playerName}] ${message}`, ...details);
  }

  protected getChoice(): Choice {
    return this.strategy.choose();
  }

  protected canCreateRoom(): boolean {
    return true;
  }

  protected canJoinExistingRooms(): boolean {
    return !this.canCreateRoom();
  }

  async run() {
    this.log(`starting bot (strategy=${this.strategy.name})`);
    await this.connectLobby();
    await this.findAndJoinOrCreateRoom();
  }

  protected async connectLobby() {
    this.lobbyRoom = await this.client.joinOrCreate("lobby", {
      filter: { name: "rps" },
    });
    this.log("connected to lobby");

    this.lobbyRoom.onMessage("rooms", (rooms: RoomAvailable<RPSRoomMetadata>[]) => {
      this.log(`lobby rooms snapshot: ${rooms.length}`);
      this.knownRooms.clear();
      for (const room of rooms) {
        this.knownRooms.set(room.roomId, room);
      }
      void this.handleRoomsUpdate(rooms);
    });

    this.lobbyRoom.onMessage("+", ([roomId, room]: [string, RoomAvailable<RPSRoomMetadata>]) => {
      this.log("lobby room added event");
      this.knownRooms.set(roomId, room);
      void this.handleRoomAdded(room);
    });

    this.lobbyRoom.onMessage("-", (roomId: string) => {
      this.log(`lobby room removed: ${roomId}`);
      this.knownRooms.delete(roomId);
      void this.handleRoomRemoved(roomId);
    });

    this.lobbyRoom.onLeave((code: number) => {
      this.log(`lobby connection lost (code=${code}), exiting`);
      process.exit(1);
    });
  }

  protected async handleRoomsUpdate(rooms: RoomAvailable<RPSRoomMetadata>[]) {
    if (this.room != null || !this.canJoinExistingRooms()) {
      return;
    }

    const availableRoom = this.findEmptyRoom(rooms);
    if (availableRoom) {
      this.log(`found joinable room, joining: ${availableRoom.roomId}`);
      await this.joinRoom(availableRoom.roomId);
    } else {
      this.log("no joinable rooms found (yet)");
    }
  }

  protected async handleRoomAdded(room: RoomAvailable<RPSRoomMetadata>) {
    if (this.room == null && this.canJoinExistingRooms() && this.isRoomJoinable(room)) {
      this.log(`room added and joinable, joining: ${room.roomId} (playerCount: ${room.metadata?.playerCount ?? 0})`);
      // Add small random delay to reduce race conditions
      const delay = Math.floor(Math.random() * 300);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.joinRoom(room.roomId);
    }
  }

  protected async handleRoomRemoved(_roomId: string) {
    // Could handle reconnection logic here if needed
  }

  protected isRoomJoinable(room: RoomAvailable<RPSRoomMetadata>): boolean {
    const isLocked = Boolean((room as { locked?: boolean }).locked);
    const playerCount = room.metadata?.playerCount ?? 0;
    const allowBots = room.metadata?.allowBots ?? true;
    const creatorJoined = room.metadata?.creatorJoined ?? true;

    return !isLocked && playerCount < 2 && allowBots && creatorJoined;
  }

  protected findEmptyRoom(rooms: RoomAvailable<RPSRoomMetadata>[]): RoomAvailable<RPSRoomMetadata> | undefined {
    return rooms.find((r) => this.isRoomJoinable(r));
  }

  protected async findAndJoinOrCreateRoom() {
    if (this.room != null || this.isJoining) {
      return;
    }

    if (this.canJoinExistingRooms()) {
      const joinableRooms = this.getAvailableRooms()
        .filter((r) => this.isRoomJoinable(r))
        .sort((a, b) => {
          // Prefer rooms with 1 player (waiting for opponent) over rooms with 0 players.
          const aCount = a.metadata?.playerCount ?? 0;
          const bCount = b.metadata?.playerCount ?? 0;
          return bCount - aCount;
        });

      for (const emptyRoom of joinableRooms) {
        this.log(`matchmaking trying room: ${emptyRoom.roomId} (playerCount: ${emptyRoom.metadata?.playerCount ?? 0})`);
        // Add small random delay to reduce race conditions
        const delay = Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, delay));

        const joined = await this.joinRoom(emptyRoom.roomId);
        if (joined) {
          return;
        }
        this.log(`matchmaking: room ${emptyRoom.roomId} join failed, trying next`);
      }
    }

    if (this.canCreateRoom()) {
      this.log("matchmaking found no rooms; creating one");
      await this.createRoom();
    } else {
      this.log("matchmaking found no rooms; will retry");
      // Retry after a delay — lobby events should also trigger joining
      setTimeout(() => {
        if (this.room == null && !this.isJoining) {
          void this.findAndJoinOrCreateRoom();
        }
      }, 2000);
    }
  }

  protected getAvailableRooms(): RoomAvailable<RPSRoomMetadata>[] {
    return Array.from(this.knownRooms.values());
  }

  protected async createRoom(matchFormat: MatchFormat = MF.BestOf3): Promise<boolean> {
    if (this.isJoining || this.room != null) {
      this.log(`createRoom skipped (isJoining=${this.isJoining}, hasRoom=${this.room != null})`);
      return false;
    }

    this.isJoining = true;
    try {
      this.log(`creating room (matchFormat=${matchFormat})`);
      this.room = await this.client.create("rps", {
        name: this.playerName,
        matchFormat,
      });
      this.log("room created");
      this.setupRoomHandlers();
      return true;
    } catch (err) {
      this.log(`failed to create room:`, err);
      this.room = null;
      return false;
    } finally {
      this.isJoining = false;
    }
  }

  protected async joinRoom(roomId: string): Promise<boolean> {
    if (this.isJoining || this.room != null) {
      this.log(`joinRoom skipped (isJoining=${this.isJoining}, hasRoom=${this.room != null})`);
      return false;
    }

    this.isJoining = true;
    try {
      this.log(`joining room: ${roomId}`);
      this.room = await this.client.joinById(roomId, {
        name: this.playerName,
      });
      this.log("joined room");
      this.setupRoomHandlers();
      return true;
    } catch (err) {
      this.log(`failed to join room ${roomId}:`, err);
      this.room = null;
      return false;
    } finally {
      this.isJoining = false;
    }
  }

  protected setupRoomHandlers() {
    const room = this.room;
    if (!room || this.isSettingUpHandlers) return;

    this.isSettingUpHandlers = true;

    room.onMessage(ClientMessage.MakeChoice, (payload: unknown) => {
      this.log("server acknowledged choice", payload);
    });

    room.onMessage("round_result", (payload: unknown) => {
      this.log("round_result received", payload);
    });

    room.onMessage("match_result", (payload: unknown) => {
      this.log("match_result received", payload);
    });

    room.onLeave((code: number) => {
      this.log(`left room (code=${code})`);
      // Only clean up if this is still the active room
      if (this.room === room) {
        this.room = null;
      }
      this.isSettingUpHandlers = false;
      // Add delay before rejoin to let room metadata update
      setTimeout(() => {
        if (this.room == null) {
          void this.findAndJoinOrCreateRoom();
        }
      }, 1000);
    });

    const $ = Callbacks.get(room);
    $.listen("phase", (val: unknown) => {
      if (val === RoomPhase.Choosing) {
        const choice = this.getChoice();
        this.log("phase=Choosing; sending choice", choice);
        room.send(ClientMessage.MakeChoice, { choice });
      }
    });
  }
}

export class RandomJoiner extends BaseBot {
  constructor(playerName: string, serverUrl = DEFAULT_SERVER_URL) {
    super(playerName, new RandomChoiceStrategy(), serverUrl);
  }

  protected canCreateRoom(): boolean {
    return false;
  }
}

export class RandomCreator extends BaseBot {
  constructor(playerName: string, serverUrl = DEFAULT_SERVER_URL) {
    super(playerName, new RandomChoiceStrategy(), serverUrl);
  }

  async findAndJoinOrCreateRoom() {
    this.log("creator starting matchmaking (random)");
    await this.createRoom(MF.BestOf3);
  }
}
