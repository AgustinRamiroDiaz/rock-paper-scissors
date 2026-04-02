import { Choice, MatchFormat, RoundResult } from "./constants";

export enum ClientMessage {
  MakeChoice = "make_choice",
  PlayAgain = "play_again",
  ToggleReady = "toggle_ready",
}

export enum ServerMessage {
  RoundResult = "round_result",
  MatchResult = "match_result",
  Error = "error",
  OpponentDisconnected = "opponent_disconnected",
  OpponentReconnected = "opponent_reconnected",
}

export interface MakeChoicePayload {
  choice: Choice;
}

export interface RoundResultPayload {
  round: number;
  player1Choice: Choice;
  player2Choice: Choice;
  result: RoundResult;
}

export interface MatchResultPayload {
  winner: string | null;
  player1Score: number;
  player2Score: number;
}

export interface ErrorPayload {
  message: string;
}

export interface RPSRoomMetadata {
  roomName: string;
  matchFormat: number;
}

export interface RoomCreateOptions {
  name: string;
  matchFormat: MatchFormat;
}

export interface RoomJoinOptions {
  name: string;
  spectate?: boolean;
}

export interface LeaderboardEntry {
  playerName: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}
