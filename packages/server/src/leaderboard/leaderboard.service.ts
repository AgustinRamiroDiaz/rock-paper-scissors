import { Injectable } from "@nestjs/common";
import type { LeaderboardEntry } from "@rps/shared";

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
}

@Injectable()
export class LeaderboardService {
  private entries = new Map<string, PlayerStats>();

  recordWin(playerName: string): void {
    const stats = this.getOrCreate(playerName);
    stats.wins++;
  }

  recordLoss(playerName: string): void {
    const stats = this.getOrCreate(playerName);
    stats.losses++;
  }

  recordDraw(playerName: string): void {
    const stats = this.getOrCreate(playerName);
    stats.draws++;
  }

  getLeaderboard(limit = 20): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    for (const [playerName, stats] of this.entries) {
      const total = stats.wins + stats.losses + stats.draws;
      entries.push({
        playerName,
        ...stats,
        winRate: total > 0 ? stats.wins / total : 0,
      });
    }

    return entries
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
      .slice(0, limit);
  }

  getPlayerStats(playerName: string): LeaderboardEntry | null {
    const stats = this.entries.get(playerName);
    if (!stats) return null;

    const total = stats.wins + stats.losses + stats.draws;
    return {
      playerName,
      ...stats,
      winRate: total > 0 ? stats.wins / total : 0,
    };
  }

  private getOrCreate(playerName: string): PlayerStats {
    if (!this.entries.has(playerName)) {
      this.entries.set(playerName, { wins: 0, losses: 0, draws: 0 });
    }
    return this.entries.get(playerName)!;
  }
}
