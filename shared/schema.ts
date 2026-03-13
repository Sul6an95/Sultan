import { pgEnum, pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const imageSourceEnum = pgEnum("image_source", ["auto", "manual"]);
export const deviceTypeEnum = pgEnum("device_type", ["mobile", "desktop"]);
export const gamePlatformEnum = pgEnum("game_platform", ["pc", "mobile", "console", "cross-platform"]);
export const playerRoleEnum = pgEnum("player_role", ["captain", "player", "coach", "analyst", "substitute"]);
export const bracketRoundEnum = pgEnum("bracket_round", ["round_of_16", "quarter_final", "semi_final", "final"]);

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  platform: gamePlatformEnum("platform").notNull().default("pc"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  imageSource: imageSourceEnum("image_source").notNull().default("auto"),
  gameId: integer("game_id").references(() => games.id),
});

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  imageSource: imageSourceEnum("image_source").notNull().default("auto"),
  gameId: integer("game_id").references(() => games.id),
});

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  emailOrPhone: text("email_or_phone").notNull(),
  firstVisit: timestamp("first_visit").notNull().defaultNow(),
  lastVisit: timestamp("last_visit").notNull().defaultNow(),
  visitCount: integer("visit_count").notNull().default(1),
  deviceType: deviceTypeEnum("device_type").notNull(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  visitorId: integer("visitor_id")
    .references(() => visitors.id)
    .notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  handle: text("handle").notNull(),
  teamId: integer("team_id").references(() => teams.id),
  imageUrl: text("image_url"),
  role: playerRoleEnum("role").notNull().default("player"),
  nationality: text("nationality"),
  age: integer("age"),
});

export const matchStats = pgTable("match_stats", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  teamId: integer("team_id").references(() => teams.id).notNull(),
  kills: integer("kills").default(0),
  deaths: integer("deaths").default(0),
  assists: integer("assists").default(0),
  goldEarned: integer("gold_earned").default(0),
  towersDestroyed: integer("towers_destroyed").default(0),
  firstBlood: integer("first_blood").default(0),
  dragons: integer("dragons").default(0),
  barons: integer("barons").default(0),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").references(() => games.id).notNull(),
  tournament: text("tournament").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  imageSource: imageSourceEnum("image_source").notNull().default("auto"),
  team1Id: integer("team1_id").references(() => teams.id).notNull(),
  team2Id: integer("team2_id").references(() => teams.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  status: text("status").notNull().default("upcoming"), // upcoming, live, finished
  score1: integer("score1").default(0),
  score2: integer("score2").default(0),
  streamUrls: jsonb("stream_urls").$type<string[]>().default([]),
});

// Tournament bracket entries for a match
export const brackets = pgTable("brackets", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  round: bracketRoundEnum("round").notNull(),
  position: integer("position").notNull().default(1), // Position within the round (1, 2, 3, etc.)
  team1Name: text("team1_name").notNull(),
  team1Logo: text("team1_logo"),
  team2Name: text("team2_name").notNull(),
  team2Logo: text("team2_logo"),
  score1: integer("score1"),
  score2: integer("score2"),
  isTbd: integer("is_tbd").default(0), // 1 if teams are TBD
});

// Group standings for a match
export const standings = pgTable("standings", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  position: integer("position").notNull(), // Rank in the group (1, 2, 3, etc.)
  teamName: text("team_name").notNull(),
  teamLogo: text("team_logo"),
  played: integer("played").notNull().default(0), // PL
  goalDifference: integer("goal_difference").notNull().default(0), // GD
  points: integer("points").notNull().default(0), // PTS
  isCurrentTeam: integer("is_current_team").default(0), // 1 if this is one of the teams in the match
});

export const gamesRelations = relations(games, ({ many }) => ({
  matches: many(matches),
  teams: many(teams),
  leagues: many(leagues),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  game: one(games, {
    fields: [teams.gameId],
    references: [games.id],
  }),
  matchesAsTeam1: many(matches, { relationName: "team1" }),
  matchesAsTeam2: many(matches, { relationName: "team2" }),
  players: many(players),
}));

export const leaguesRelations = relations(leagues, ({ one }) => ({
  game: one(games, {
    fields: [leagues.gameId],
    references: [games.id],
  }),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  feedback: many(feedback),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  visitor: one(visitors, {
    fields: [feedback.visitorId],
    references: [visitors.id],
  }),
}));

export const playersRelations = relations(players, ({ one }) => ({
  team: one(teams, {
    fields: [players.teamId],
    references: [teams.id],
  }),
}));

export const matchStatsRelations = relations(matchStats, ({ one }) => ({
  match: one(matches, {
    fields: [matchStats.matchId],
    references: [matches.id],
  }),
  team: one(teams, {
    fields: [matchStats.teamId],
    references: [teams.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  game: one(games, {
    fields: [matches.gameId],
    references: [games.id],
  }),
  team1: one(teams, {
    fields: [matches.team1Id],
    references: [teams.id],
    relationName: "team1",
  }),
  team2: one(teams, {
    fields: [matches.team2Id],
    references: [teams.id],
    relationName: "team2",
  }),
  stats: many(matchStats),
  brackets: many(brackets),
  standings: many(standings),
}));

export const bracketsRelations = relations(brackets, ({ one }) => ({
  match: one(matches, {
    fields: [brackets.matchId],
    references: [matches.id],
  }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  match: one(matches, {
    fields: [standings.matchId],
    references: [matches.id],
  }),
}));

export const insertGameSchema = createInsertSchema(games).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export const insertLeagueSchema = createInsertSchema(leagues).omit({ id: true });
export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  firstVisit: true,
  lastVisit: true,
  visitCount: true,
});
export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export const insertMatchSchema = createInsertSchema(matches)
  .omit({ id: true })
  .extend({
    streamUrls: z.array(z.string()).optional(),
  });
export const insertMatchStatsSchema = createInsertSchema(matchStats).omit({ id: true });
export const insertBracketSchema = createInsertSchema(brackets).omit({ id: true });
export const insertStandingSchema = createInsertSchema(standings).omit({ id: true });

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;

export type Visitor = typeof visitors.$inferSelect;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type MatchStats = typeof matchStats.$inferSelect;
export type InsertMatchStats = z.infer<typeof insertMatchStatsSchema>;

export type Bracket = typeof brackets.$inferSelect;
export type InsertBracket = z.infer<typeof insertBracketSchema>;

export type Standing = typeof standings.$inferSelect;
export type InsertStanding = z.infer<typeof insertStandingSchema>;

export type MatchWithRelations = Match & {
  game: Game;
  team1: Team;
  team2: Team;
};
