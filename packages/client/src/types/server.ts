export interface RPSRoomMetadata {
  roomName: string;
  matchFormat: number;
  playerCount: number;
  spectatorCount: number;
  createdAt: number;
  allowBots: boolean;
  creatorJoined: boolean;
}

export interface RPSRoomOptions {
  name?: string;
  matchFormat?: number;
  spectate?: boolean;
}
