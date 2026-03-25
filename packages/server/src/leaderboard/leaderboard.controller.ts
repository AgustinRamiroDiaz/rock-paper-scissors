import { Controller, Get, Param, Query } from "@nestjs/common";
import { LeaderboardService } from "./leaderboard.service";

@Controller("api/leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Query("limit") limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.leaderboardService.getLeaderboard(parsedLimit);
  }

  @Get(":playerName")
  getPlayerStats(@Param("playerName") playerName: string) {
    return this.leaderboardService.getPlayerStats(playerName);
  }
}
