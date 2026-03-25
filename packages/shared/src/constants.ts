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
  Countdown = "countdown",
  Choosing = "choosing",
  Revealing = "revealing",
  RoundEnd = "round_end",
  MatchEnd = "match_end",
}

export const CHOICE_BEATS: Record<Choice, Choice> = {
  [Choice.Rock]: Choice.Scissors,
  [Choice.Paper]: Choice.Rock,
  [Choice.Scissors]: Choice.Paper,
};

export const COUNTDOWN_SECONDS = 3;
export const REVEAL_DURATION_MS = 2000;
export const ROUND_END_DURATION_MS = 2500;
export const RECONNECT_TIMEOUT_MS = 30000;
