export enum Choice {
  Rock = "rock",
  Paper = "paper",
  Scissors = "scissors",
}

export enum RoundResult {
  Player1 = "player1",
  Player2 = "player2",
  Draw = "draw",
}

export enum MatchFormat {
  BestOf3 = 3,
  BestOf5 = 5,
}

export enum RoomPhase {
  WaitingForPlayers = "waiting",
  Choosing = "choosing",
  Revealing = "revealing",
  MatchEnd = "match_end",
}

export const CHOICE_BEATS: Record<Choice, Choice> = {
  [Choice.Rock]: Choice.Scissors,
  [Choice.Paper]: Choice.Rock,
  [Choice.Scissors]: Choice.Paper,
};

export const REVEAL_DURATION_MS = 2000;
export const RECONNECT_TIMEOUT_MS = 30000;
export const MATCHMAKING_TIMEOUT_MS = 5 * 60 * 1000;
