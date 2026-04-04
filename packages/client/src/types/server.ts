export interface RPSRoomMetadata {
  roomName: string;
  matchFormat: number;
  playerCount?: number;
  spectatorCount?: number;
}

export interface RPSRoomOptions {
  name?: string;
  matchFormat?: number;
  spectate?: boolean;
}
