import { db } from "./db";
import { games, teams, leagues, players, matches, visitors, feedback, matchStats, brackets, standings } from "@shared/schema";
import type {
  Game,
  InsertGame,
  Team,
  InsertTeam,
  League,
  InsertLeague,
  Player,
  InsertPlayer,
  Match,
  InsertMatch,
  MatchWithRelations,
  Visitor,
  InsertVisitor,
  Feedback,
  InsertFeedback,
  MatchStats,
  InsertMatchStats,
  Bracket,
  InsertBracket,
  Standing,
  InsertStanding,
} from "@shared/schema";
import { eq, sql, gte, and, or, desc } from "drizzle-orm";

type MatchFilters = {
  date?: string;
  gameId?: number;
  teamId?: number;
};

export interface IStorage {
  getGames(): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: number, game: Partial<InsertGame>): Promise<Game>;
  deleteGame(id: number): Promise<void>;

  getTeams(): Promise<Team[]>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: number): Promise<void>;

  getLeagues(): Promise<League[]>;
  createLeague(league: InsertLeague): Promise<League>;
  updateLeague(id: number, league: Partial<InsertLeague>): Promise<League>;
  deleteLeague(id: number): Promise<void>;

  getPlayers(): Promise<Player[]>;
  getPlayersByTeam(teamId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, player: Partial<InsertPlayer>): Promise<Player>;
  deletePlayer(id: number): Promise<void>;

  getMatchStats(matchId: number): Promise<MatchStats[]>;
  createMatchStats(stats: InsertMatchStats): Promise<MatchStats>;
  updateMatchStats(id: number, stats: Partial<InsertMatchStats>): Promise<MatchStats>;
  deleteMatchStats(id: number): Promise<void>;

  getH2H(team1Id: number, team2Id: number): Promise<{ team1Wins: number; team2Wins: number; draws: number; matches: MatchWithRelations[] }>;

  // Brackets
  getBrackets(matchId: number): Promise<Bracket[]>;
  saveBrackets(matchId: number, data: InsertBracket[]): Promise<Bracket[]>;
  deleteBrackets(matchId: number): Promise<void>;

  // Standings
  getStandings(matchId: number): Promise<Standing[]>;
  saveStandings(matchId: number, data: InsertStanding[]): Promise<Standing[]>;
  deleteStandings(matchId: number): Promise<void>;

  getMatches(filters?: MatchFilters): Promise<MatchWithRelations[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, data: Partial<InsertMatch>): Promise<Match>;
  deleteMatch(id: number): Promise<void>;
  clearAllMatches(): Promise<void>;

  clearAll(): Promise<void>;

  upsertVisitor(data: InsertVisitor): Promise<Visitor>;
  getVisitors(): Promise<Visitor[]>;

  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedback(): Promise<(Feedback & { visitor: Visitor | null })[]>;

  getAdminStats(): Promise<{
    totalVisitors: number;
    visitorsToday: number;
    visitorsThisWeek: number;
    mobilePercent: number;
    desktopPercent: number;
    liveMatches: number;
    totalMatches: number;
    totalTeams: number;
    totalLeagues: number;
    avgRating: number | null;
    totalFeedback: number;
  }>;

  getVisitsChart(): Promise<{ date: string; count: number }[]>;
}

export class DatabaseStorage implements IStorage {
  async getGames(): Promise<Game[]> {
    return await db.select().from(games);
  }
  
  async createGame(game: InsertGame): Promise<Game> {
    const [created] = await db.insert(games).values(game).returning();
    return created;
  }

  async updateGame(id: number, game: Partial<InsertGame>): Promise<Game> {
    const [updated] = await db.update(games).set(game).where(eq(games.id, id)).returning();
    return updated;
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async createTeam(team: InsertTeam): Promise<Team> {
    const payload: InsertTeam = {
      ...team,
      imageUrl: team.imageUrl || team.logoUrl,
    };
    const [created] = await db.insert(teams).values(payload).returning();
    return created;
  }

  async updateTeam(id: number, team: Partial<InsertTeam>): Promise<Team> {
    const payload: Partial<InsertTeam> = {
      ...team,
      ...(team.logoUrl && team.imageUrl === undefined ? { imageUrl: team.logoUrl } : {}),
    };
    const [updated] = await db.update(teams).set(payload).where(eq(teams.id, id)).returning();
    return updated;
  }

  async getLeagues(): Promise<League[]> {
    return await db.select().from(leagues);
  }

  async createLeague(league: InsertLeague): Promise<League> {
    const [created] = await db.insert(leagues).values(league).returning();
    return created;
  }

  async updateLeague(id: number, league: Partial<InsertLeague>): Promise<League> {
    const [updated] = await db.update(leagues).set(league).where(eq(leagues.id, id)).returning();
    return updated;
  }

  async getPlayers(): Promise<Player[]> {
    return await db.select().from(players);
  }

  async getPlayersByTeam(teamId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.teamId, teamId));
  }
  
  async createPlayer(player: InsertPlayer): Promise<Player> {
    const [created] = await db.insert(players).values(player).returning();
    return created;
  }

  async updatePlayer(id: number, player: Partial<InsertPlayer>): Promise<Player> {
    const [updated] = await db.update(players).set(player).where(eq(players.id, id)).returning();
    return updated;
  }

  async deletePlayer(id: number): Promise<void> {
    await db.delete(players).where(eq(players.id, id));
  }

  async getMatchStats(matchId: number): Promise<MatchStats[]> {
    return await db.select().from(matchStats).where(eq(matchStats.matchId, matchId));
  }

  async createMatchStats(stats: InsertMatchStats): Promise<MatchStats> {
    const [created] = await db.insert(matchStats).values(stats).returning();
    return created;
  }

  async updateMatchStats(id: number, stats: Partial<InsertMatchStats>): Promise<MatchStats> {
    const [updated] = await db.update(matchStats).set(stats).where(eq(matchStats.id, id)).returning();
    return updated;
  }

  async deleteMatchStats(id: number): Promise<void> {
    await db.delete(matchStats).where(eq(matchStats.id, id));
  }

  async getH2H(team1Id: number, team2Id: number): Promise<{ team1Wins: number; team2Wins: number; draws: number; matches: MatchWithRelations[] }> {
    const h2hMatches = await db.query.matches.findMany({
      where: and(
        eq(matches.status, "finished"),
        or(
          and(eq(matches.team1Id, team1Id), eq(matches.team2Id, team2Id)),
          and(eq(matches.team1Id, team2Id), eq(matches.team2Id, team1Id))
        )
      ),
      with: {
        game: true,
        team1: true,
        team2: true,
      },
      orderBy: (matches, { desc }) => [desc(matches.startTime)],
    });

    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;

    for (const m of h2hMatches) {
      const score1 = m.score1 ?? 0;
      const score2 = m.score2 ?? 0;
      
      if (score1 === score2) {
        draws++;
      } else if (m.team1Id === team1Id) {
        if (score1 > score2) team1Wins++;
        else team2Wins++;
      } else {
        if (score2 > score1) team1Wins++;
        else team2Wins++;
      }
    }

    return { team1Wins, team2Wins, draws, matches: h2hMatches as MatchWithRelations[] };
  }

  async getMatches(filters: MatchFilters = {}): Promise<MatchWithRelations[]> {
    const { date: dateStr, gameId, teamId } = filters;

    let conditions: any[] = [];
    
    if (dateStr) {
      conditions.push(sql`DATE(${matches.startTime}) = ${dateStr}`);
    }
    
    if (typeof gameId === "number" && Number.isFinite(gameId)) {
      conditions.push(eq(matches.gameId, gameId));
    }
    
    if (typeof teamId === "number" && Number.isFinite(teamId)) {
      conditions.push(or(eq(matches.team1Id, teamId), eq(matches.team2Id, teamId)));
    }

    const allMatches = await db.query.matches.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        game: true,
        team1: true,
        team2: true,
      },
      orderBy: (matches, { asc }) => [asc(matches.startTime)],
    });

    return allMatches as MatchWithRelations[];
  }
  
  async createMatch(match: InsertMatch): Promise<Match> {
    const [created] = await db.insert(matches).values(match).returning();
    return created;
  }

  async updateMatch(id: number, data: Partial<InsertMatch>): Promise<Match> {
    const [updated] = await db.update(matches).set(data).where(eq(matches.id, id)).returning();
    return updated;
  }

  async deleteMatch(id: number): Promise<void> {
    await db.delete(matches).where(eq(matches.id, id));
  }

  async clearAllMatches(): Promise<void> {
    await db.delete(matches);
  }

  // Brackets
  async getBrackets(matchId: number): Promise<Bracket[]> {
    return db.select().from(brackets).where(eq(brackets.matchId, matchId)).orderBy(brackets.round, brackets.position);
  }

  async saveBrackets(matchId: number, data: InsertBracket[]): Promise<Bracket[]> {
    // Delete existing brackets for this match
    await db.delete(brackets).where(eq(brackets.matchId, matchId));
    
    if (data.length === 0) return [];
    
    // Insert new brackets
    const toInsert = data.map(b => ({ ...b, matchId }));
    return db.insert(brackets).values(toInsert).returning();
  }

  async deleteBrackets(matchId: number): Promise<void> {
    await db.delete(brackets).where(eq(brackets.matchId, matchId));
  }

  // Standings
  async getStandings(matchId: number): Promise<Standing[]> {
    return db.select().from(standings).where(eq(standings.matchId, matchId)).orderBy(standings.position);
  }

  async saveStandings(matchId: number, data: InsertStanding[]): Promise<Standing[]> {
    // Delete existing standings for this match
    await db.delete(standings).where(eq(standings.matchId, matchId));
    
    if (data.length === 0) return [];
    
    // Insert new standings
    const toInsert = data.map(s => ({ ...s, matchId }));
    return db.insert(standings).values(toInsert).returning();
  }

  async deleteStandings(matchId: number): Promise<void> {
    await db.delete(standings).where(eq(standings.matchId, matchId));
  }

  async deleteGame(id: number): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  async deleteTeam(id: number): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async deleteLeague(id: number): Promise<void> {
    await db.delete(leagues).where(eq(leagues.id, id));
  }

  async clearAll(): Promise<void> {
    await db.delete(matches);
    await db.delete(players);
    await db.delete(teams);
    await db.delete(leagues);
    await db.delete(games);
  }

  async upsertVisitor(data: InsertVisitor): Promise<Visitor> {
    const existing = await db
      .select()
      .from(visitors)
      .where(eq(visitors.emailOrPhone, data.emailOrPhone))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(visitors)
        .set({
          lastVisit: new Date(),
          visitCount: sql`${visitors.visitCount} + 1`,
        })
        .where(eq(visitors.emailOrPhone, data.emailOrPhone))
        .returning();
      return updated;
    }

    const [created] = await db.insert(visitors).values(data).returning();
    return created;
  }

  async getVisitors(): Promise<Visitor[]> {
    return await db.select().from(visitors);
  }

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [created] = await db.insert(feedback).values(data).returning();
    return created;
  }

  async getFeedback(): Promise<(Feedback & { visitor: Visitor | null })[]> {
    const rows = await db.query.feedback.findMany({
      with: { visitor: true },
      orderBy: (fb, { desc }) => [desc(fb.createdAt)],
    });
    return rows as (Feedback & { visitor: Visitor | null })[];
  }

  async getAdminStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const [allVisitors, allFeedback, allMatches, allTeams, allLeagues] = await Promise.all([
      db.select().from(visitors),
      db.select().from(feedback),
      db.select().from(matches),
      db.select().from(teams),
      db.select().from(leagues),
    ]);

    const visitorsToday = allVisitors.filter(
      (v) => new Date(v.lastVisit) >= startOfToday
    ).length;
    const visitorsThisWeek = allVisitors.filter(
      (v) => new Date(v.lastVisit) >= startOfWeek
    ).length;
    const mobileCount = allVisitors.filter((v) => v.deviceType === "mobile").length;
    const total = allVisitors.length || 1;
    const mobilePercent = Math.round((mobileCount / total) * 100);

    const liveMatches = allMatches.filter((m) => m.status === "live").length;

    const avgRating =
      allFeedback.length > 0
        ? Math.round((allFeedback.reduce((s, f) => s + f.rating, 0) / allFeedback.length) * 10) / 10
        : null;

    return {
      totalVisitors: allVisitors.length,
      visitorsToday,
      visitorsThisWeek,
      mobilePercent,
      desktopPercent: 100 - mobilePercent,
      liveMatches,
      totalMatches: allMatches.length,
      totalTeams: allTeams.length,
      totalLeagues: allLeagues.length,
      avgRating,
      totalFeedback: allFeedback.length,
    };
  }

  async getVisitsChart(): Promise<{ date: string; count: number }[]> {
    const result: { date: string; count: number }[] = [];
    const allVisitors = await db.select().from(visitors);

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = allVisitors.filter((v) => {
        const t = new Date(v.lastVisit);
        return t >= dayStart && t < dayEnd;
      }).length;

      result.push({ date: dateStr, count });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
