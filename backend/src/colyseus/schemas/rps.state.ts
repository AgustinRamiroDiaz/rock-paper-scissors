import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("number") score = 0;
  @type("boolean") ready = false;
  @type("boolean") hasChosen = false;
  @type("boolean") connected = true;
  @type("string") currentChoice = "";
}

export class RoundSchema extends Schema {
  @type("number") roundNumber = 0;
  @type("string") player1Choice = "";
  @type("string") player2Choice = "";
  @type("string") result = "";
}

export class RPSRoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([RoundSchema]) rounds = new ArraySchema<RoundSchema>();
  @type("string") phase = "waiting";
  @type("number") matchFormat = 3;
  @type("number") currentRound = 0;
  @type("string") player1Id = "";
  @type("string") player2Id = "";
  @type("string") winnerId = "";
  @type("number") spectatorCount = 0;
}
