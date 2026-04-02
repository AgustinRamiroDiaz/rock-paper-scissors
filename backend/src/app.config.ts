import { defineRoom, defineServer } from "colyseus";
import { RPSLobbyRoom } from "./colyseus/rooms/rps-lobby.room";
import { RPSRoom } from "./colyseus/rooms/rps.room";

export const server = defineServer({
  rooms: {
    lobby: defineRoom(RPSLobbyRoom),
    rps: defineRoom(RPSRoom),
  },
});
