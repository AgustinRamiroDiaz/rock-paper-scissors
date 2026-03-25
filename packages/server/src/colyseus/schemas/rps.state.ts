import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("number") score: number = 0;
  @type("boolean") ready: boolean = false;
  @type("boolean") hasChosen: boolean = false;
  @type("boolean") connected: boolean = true;
  @type("string") currentChoice: string = "";
}

export class RoundSchema extends Schema {
  @type("number") roundNumber: number = 0;
  @type("string") player1Choice: string = "";
  @type("string") player2Choice: string = "";
  @type("string") result: string = "";
}

export class RPSRoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([RoundSchema]) rounds = new ArraySchema<RoundSchema>();
  @type("string") phase: string = "waiting";
  @type("number") matchFormat: number = 3;
  @type("number") currentRound: number = 0;
  @type("string") player1Id: string = "";
  @type("string") player2Id: string = "";
  @type("string") winnerId: string = "";
  @type("number") spectatorCount: number = 0;
}
