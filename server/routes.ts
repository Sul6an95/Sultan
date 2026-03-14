import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "http";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import {
  listDataProviders,
  resolvePrimaryDataProviderId,
  syncFromPrimaryProvider,
  syncFromProvider,
} from "./data-provider";
import { syncUpcomingMatches, syncLiveMatches, syncTeamPastMatches, syncTeamPlayers, syncPastMatches } from "./pandascore";
import {
  insertMatchSchema,
  insertGameSchema,
  insertTeamSchema,
  insertLeagueSchema,
  insertVisitorSchema,
  insertFeedbackSchema,
  insertPlayerSchema,
  insertMatchStatsSchema,
  insertBracketSchema,
  insertStandingSchema,
} from "@shared/schema";
import { isCloudinaryConfigured, uploadImageToCloudinary, uploadImageFromUrl } from "./cloudinary";

const visitorBodySchema = insertVisitorSchema.omit({ deviceType: true }).extend({
  emailOrPhone: z
    .string()
    .min(1)
    .refine(
      (v) => {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRe = /^\+?[0-9\s\-().]{7,20}$/;
        return emailRe.test(v) || phoneRe.test(v);
      },
      { message: "يرجى إدخال بريد إلكتروني أو رقم جوال صحيح" },
    ),
});

function detectDeviceType(userAgent: string): "mobile" | "desktop" {
  return /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
    ? "mobile"
    : "desktop";
}
// ── Admin auth middleware ────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || process.env.SESSION_SECRET;
const ADMIN_TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS || 1000 * 60 * 60 * 12); // 12h
const ADMIN_LOGIN_WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS || 1000 * 60 * 10); // 10m
const ADMIN_LOGIN_MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 10);
const adminLoginSchema = z.object({ password: z.string().min(1) });
const adminUploadImageSchema = z
  .object({
    fileData: z.string().min(1, "fileData is required"),
    entityType: z.enum(["team", "league", "match"]).optional(),
    entityId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const hasEntityType = typeof data.entityType === "string";
    const hasEntityId = typeof data.entityId === "number";

    if (hasEntityType !== hasEntityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "entityType and entityId must be provided together",
      });
    }
  });
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();

if (isProduction && !ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD must be set in production");
}

if (isProduction && !ADMIN_TOKEN_SECRET) {
  throw new Error("ADMIN_TOKEN_SECRET (or SESSION_SECRET) must be set in production");
}

if (!isProduction && !ADMIN_PASSWORD) {
  console.warn("[admin] ADMIN_PASSWORD is not set; using development fallback password.");
}

if (!isProduction && !ADMIN_TOKEN_SECRET) {
  console.warn("[admin] ADMIN_TOKEN_SECRET is not set; using development fallback token secret.");
}

const resolvedAdminPassword = ADMIN_PASSWORD || "rivox-admin-dev";
const resolvedAdminTokenSecret = ADMIN_TOKEN_SECRET || "rivox-admin-token-dev";

type AdminTokenPayload = {
  sub: "admin";
  iat: number;
  exp: number;
  nonce: string;
};

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, "utf8");
  const rightBuf = Buffer.from(right, "utf8");
  if (leftBuf.length !== rightBuf.length) return false;
  return timingSafeEqual(leftBuf, rightBuf);
}

function signAdminToken(): string {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    sub: "admin",
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_MS,
    nonce: randomBytes(8).toString("hex"),
  };

  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signaturePart = createHmac("sha256", resolvedAdminTokenSecret)
    .update(payloadPart)
    .digest("base64url");

  return `${payloadPart}.${signaturePart}`;
}

function verifyAdminToken(token: string): boolean {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return false;

  const expectedSignature = createHmac("sha256", resolvedAdminTokenSecret)
    .update(payloadPart)
    .digest("base64url");

  if (!safeEqual(signaturePart, expectedSignature)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Partial<AdminTokenPayload>;

    if (payload.sub !== "admin") return false;
    if (typeof payload.exp !== "number") return false;
    if (Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

function allowDestructiveOperations(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DESTRUCTIVE_SYNC === "true";
}

function shouldAutoSeedOnBoot(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_SEED_ON_BOOT === "true";
}

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function limitAdminLoginAttempts(req: Request, res: Response, next: NextFunction) {
  const key = getClientKey(req);
  const now = Date.now();
  const existing = adminLoginAttempts.get(key);

  if (!existing || now > existing.resetAt) {
    adminLoginAttempts.set(key, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    return next();
  }

  if (existing.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
    return res.status(429).json({ message: "Too many login attempts. Please try again later." });
  }

  existing.count += 1;
  adminLoginAttempts.set(key, existing);
  return next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!verifyAdminToken(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Health check endpoint ───────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // ── Public routes ──────────────────────────────────────────────────────────
  app.get(api.games.list.path, async (req, res) => {
    const data = await storage.getGames();
    res.json(data);
  });

  app.get(api.teams.list.path, async (req, res) => {
    const data = await storage.getTeams();
    res.json(data);
  });

  app.get(api.leagues.list.path, async (_req, res) => {
    const data = await storage.getLeagues();
    res.json(data);
  });

  app.get(api.players.list.path, async (req, res) => {
    const data = await storage.getPlayers();
    res.json(data);
  });

  // ── Public: Image Proxy (bypass CORS for PandaScore images) ──────────────────
  app.get("/api/img-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || typeof url !== "string") return res.status(400).send("missing url");
    const allowedHosts = ["pandascore.co", "lolesports.com", "ui-avatars.com"];
    try {
      const parsed = new URL(url);
      if (!allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
        return res.status(403).send("host not allowed");
      }
      const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!upstream.ok) return res.status(upstream.status).send("upstream error");
      const ct = upstream.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.send(buf);
    } catch {
      return res.status(500).send("proxy error");
    }
  });

  // ── Public: Visitors ───────────────────────────────────────────────────────
  app.post("/api/visitors", async (req, res) => {
    const parsed = visitorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    try {
      const deviceType = detectDeviceType(req.headers["user-agent"] || "");
      const visitor = await storage.upsertVisitor({
        emailOrPhone: parsed.data.emailOrPhone,
        deviceType,
      });
      return res.json({ ok: true, id: visitor.id, visitCount: visitor.visitCount });
    } catch (err) {
      console.error("[API] POST /api/visitors error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Public: Feedback ───────────────────────────────────────────────────────
  app.post("/api/feedback", async (req, res) => {
    const schema = insertFeedbackSchema.pick({ visitorId: true, rating: true, comment: true });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    if (parsed.data.rating < 1 || parsed.data.rating > 5) {
      return res.status(400).json({ message: "التقييم يجب أن يكون بين 1 و 5" });
    }
    try {
      const fb = await storage.createFeedback(parsed.data);
      return res.json({ ok: true, id: fb.id });
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.matches.list.path, async (req, res) => {
    try {
      const input = api.matches.list.input?.parse(req.query) || {};
      const data = await storage.getMatches(input);
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin: Login ───────────────────────────────────────────────────────────
  app.post("/api/admin/login", limitAdminLoginAttempts, (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }

    if (!safeEqual(parsed.data.password, resolvedAdminPassword)) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة" });
    }

    const token = signAdminToken();
    adminLoginAttempts.delete(getClientKey(req));
    return res.json({
      token,
      tokenType: "Bearer",
      expiresInMs: ADMIN_TOKEN_TTL_MS,
    });
  });

  // ── Admin: Stats & Analytics ───────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getAdminStats();
      return res.json(stats);
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/visitors", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getVisitors();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/feedback", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getFeedback();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/visits-chart", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getVisitsChart();
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── Admin: Matches ─────────────────────────────────────────────────────────
  app.get("/api/admin/matches", requireAdmin, async (req, res) => {
    const data = await storage.getMatches();
    res.json(data);
  });

  app.post("/api/admin/matches", requireAdmin, async (req, res) => {
    try {
      // Convert startTime string to Date if needed
      const reqBody = { ...req.body };
      if (typeof reqBody.startTime === "string") {
        reqBody.startTime = new Date(reqBody.startTime);
      }
      const body = insertMatchSchema.parse(reqBody);
      const payload = {
        ...body,
        ...(body.imageUrl ? { imageSource: "manual" as const } : {}),
      };
      const match = await storage.createMatch(payload);
      res.json(match);
    } catch (err) {
      console.error("Match creation error:", err);
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: (err as Error).message || "Internal server error" });
    }
  });

  app.patch("/api/admin/matches/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Convert startTime string to Date if needed
      const reqBody = { ...req.body };
      if (typeof reqBody.startTime === "string") {
        reqBody.startTime = new Date(reqBody.startTime);
      }
      const body = insertMatchSchema.partial().parse(reqBody);
      const payload = {
        ...body,
        ...(body.imageUrl !== undefined ? { imageSource: "manual" as const } : {}),
      };
      const match = await storage.updateMatch(id, payload);
      res.json(match);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/matches/:id", requireAdmin, async (req, res) => {
    await storage.deleteMatch(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Public: Brackets & Standings ─────────────────────────────────────────────
  app.get("/api/matches/:id/bracket", async (req, res) => {
    const matchId = Number(req.params.id);
    const data = await storage.getBrackets(matchId);
    res.json(data);
  });

  app.get("/api/matches/:id/standings", async (req, res) => {
    const matchId = Number(req.params.id);
    const data = await storage.getStandings(matchId);
    res.json(data);
  });

  // ── Admin: Brackets ──────────────────────────────────────────────────────────
  app.post("/api/admin/matches/:id/bracket", requireAdmin, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const items = z.array(insertBracketSchema.omit({ matchId: true })).parse(req.body);
      const saved = await storage.saveBrackets(matchId, items.map(i => ({ ...i, matchId })));
      res.json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/matches/:id/bracket", requireAdmin, async (req, res) => {
    const matchId = Number(req.params.id);
    await storage.deleteBrackets(matchId);
    res.json({ ok: true });
  });

  // ── Admin: Standings ─────────────────────────────────────────────────────────
  app.post("/api/admin/matches/:id/standings", requireAdmin, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const items = z.array(insertStandingSchema.omit({ matchId: true })).parse(req.body);
      const saved = await storage.saveStandings(matchId, items.map(i => ({ ...i, matchId })));
      res.json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/matches/:id/standings", requireAdmin, async (req, res) => {
    const matchId = Number(req.params.id);
    await storage.deleteStandings(matchId);
    res.json({ ok: true });
  });

  // ── Admin: Mirror game images to Cloudinary ───────────────────────────────
  app.post("/api/admin/mirror-game-images", requireAdmin, async (req, res) => {
    const games = await storage.getGames();
    const results: { id: number; name: string; url: string; ok: boolean }[] = [];
    for (const g of games) {
      if (!g.imageUrl || !g.imageUrl.includes("pandascore.co")) {
        results.push({ id: g.id, name: g.name, url: g.imageUrl ?? "", ok: false });
        continue;
      }
      try {
        const uploaded = await uploadImageFromUrl(g.imageUrl, { publicIdPrefix: `game-${g.id}` });
        await storage.updateGame(g.id, { imageUrl: uploaded.url });
        results.push({ id: g.id, name: g.name, url: uploaded.url, ok: true });
      } catch {
        results.push({ id: g.id, name: g.name, url: g.imageUrl, ok: false });
      }
    }
    res.json({ results });
  });

  // ── Admin: Games ───────────────────────────────────────────────────────────
  app.post("/api/admin/games", requireAdmin, async (req, res) => {
    try {
      const body = insertGameSchema.parse(req.body);
      const game = await storage.createGame(body);
      res.json(game);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/games/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertGameSchema.partial().parse(req.body);
      const game = await storage.updateGame(id, body);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/games/:id", requireAdmin, async (req, res) => {
    await storage.deleteGame(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: Teams ───────────────────────────────────────────────────────────
  app.post("/api/admin/teams", requireAdmin, async (req, res) => {
    try {
      const body = insertTeamSchema.parse(req.body);
      const payload = {
        ...body,
        imageUrl: body.imageUrl || body.logoUrl,
        imageSource: "manual" as const,
      };
      const team = await storage.createTeam(payload);
      res.json(team);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/teams/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertTeamSchema.partial().parse(req.body);
      const payload = {
        ...body,
        ...(body.logoUrl && body.imageUrl === undefined ? { imageUrl: body.logoUrl } : {}),
        ...(body.logoUrl !== undefined || body.imageUrl !== undefined
          ? { imageSource: "manual" as const }
          : {}),
      };
      const team = await storage.updateTeam(id, payload);
      res.json(team);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/teams/:id", requireAdmin, async (req, res) => {
    await storage.deleteTeam(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: Leagues ─────────────────────────────────────────────────────────
  app.post("/api/admin/leagues", requireAdmin, async (req, res) => {
    try {
      const body = insertLeagueSchema.parse(req.body);
      const payload = {
        ...body,
        ...(body.imageUrl ? { imageSource: "manual" as const } : {}),
      };
      const league = await storage.createLeague(payload);
      res.json(league);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/leagues/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertLeagueSchema.partial().parse(req.body);
      const payload = {
        ...body,
        ...(body.imageUrl !== undefined ? { imageSource: "manual" as const } : {}),
      };
      const league = await storage.updateLeague(id, payload);
      res.json(league);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/leagues/:id", requireAdmin, async (req, res) => {
    await storage.deleteLeague(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: Players ────────────────────────────────────────────────────────
  app.get("/api/admin/players", requireAdmin, async (_req, res) => {
    const players = await storage.getPlayers();
    res.json(players);
  });

  app.post("/api/admin/players", requireAdmin, async (req, res) => {
    try {
      const body = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer(body);
      res.json(player);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/players/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertPlayerSchema.partial().parse(req.body);
      const player = await storage.updatePlayer(id, body);
      res.json(player);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/players/:id", requireAdmin, async (req, res) => {
    await storage.deletePlayer(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin: Match Stats ────────────────────────────────────────────────────
  app.get("/api/admin/match-stats/:matchId", requireAdmin, async (req, res) => {
    const matchId = Number(req.params.matchId);
    const stats = await storage.getMatchStats(matchId);
    res.json(stats);
  });

  app.post("/api/admin/match-stats", requireAdmin, async (req, res) => {
    try {
      const body = insertMatchStatsSchema.parse(req.body);
      const stats = await storage.createMatchStats(body);
      res.json(stats);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/match-stats/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertMatchStatsSchema.partial().parse(req.body);
      const stats = await storage.updateMatchStats(id, body);
      res.json(stats);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/match-stats/:id", requireAdmin, async (req, res) => {
    await storage.deleteMatchStats(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Public: Players by team ───────────────────────────────────────────────
  app.get("/api/teams/:teamId/players", async (req, res) => {
    const teamId = Number(req.params.teamId);
    const players = await storage.getPlayersByTeam(teamId);
    res.json(players);
  });

  // ── Public: Match Stats ───────────────────────────────────────────────────
  app.get("/api/matches/:matchId/stats", async (req, res) => {
    const matchId = Number(req.params.matchId);
    const stats = await storage.getMatchStats(matchId);
    res.json(stats);
  });

  // ── Public: H2H (Head to Head) ────────────────────────────────────────────
  app.get("/api/h2h", async (req, res) => {
    const team1Id = Number(req.query.team1);
    const team2Id = Number(req.query.team2);
    
    if (!team1Id || !team2Id || isNaN(team1Id) || isNaN(team2Id)) {
      return res.status(400).json({ message: "team1 and team2 query params required" });
    }
    
    const h2h = await storage.getH2H(team1Id, team2Id);
    res.json(h2h);
  });

  // ── Admin: Upload image ────────────────────────────────────────────────────
  app.post("/api/admin/upload-image", requireAdmin, async (req, res) => {
    const parsed = adminUploadImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request body" });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(400).json({
        message:
          "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
      });
    }

    try {
      const { fileData, entityType, entityId } = parsed.data;
      const uploaded = await uploadImageToCloudinary(fileData, {
        publicIdPrefix: entityType ? `rivox-${entityType}` : "rivox-admin",
      });

      if (entityType === "team" && entityId) {
        await storage.updateTeam(entityId, {
          logoUrl: uploaded.url,
          imageUrl: uploaded.url,
          imageSource: "manual",
        });
      }

      if (entityType === "league" && entityId) {
        await storage.updateLeague(entityId, {
          imageUrl: uploaded.url,
          imageSource: "manual",
        });
      }

      if (entityType === "match" && entityId) {
        await storage.updateMatch(entityId, {
          imageUrl: uploaded.url,
          imageSource: "manual",
        });
      }

      return res.json({
        ok: true,
        url: uploaded.url,
        publicId: uploaded.publicId,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image upload failed";
      return res.status(500).json({ message });
    }
  });

  app.get("/api/admin/data-providers", requireAdmin, (_req, res) => {
    const primaryProviderId = resolvePrimaryDataProviderId();
    res.json({
      primaryProviderId,
      providers: listDataProviders(),
    });
  });

  // ── Admin: Data provider sync ──────────────────────────────────────────────
  app.post("/api/admin/sync", requireAdmin, async (req, res) => {
    if (!allowDestructiveOperations()) {
      return res.status(403).json({
        message: "Destructive sync is disabled in production. Set ALLOW_DESTRUCTIVE_SYNC=true to enable.",
      });
    }

    try {
      const selectedProvider = typeof req.query.provider === "string" ? req.query.provider : undefined;
      const result = selectedProvider
        ? await syncFromProvider(selectedProvider)
        : await syncFromPrimaryProvider();

      if (!result.ok) {
        if (result.errorCode === "provider_not_found") {
          return res.status(404).json({ message: result.message });
        }

        if (result.errorCode === "not_configured") {
          return res.status(400).json({ message: result.message });
        }

        return res.status(500).json({ message: result.message });
      }

      res.json({
        ok: true,
        count: result.matchesLoaded,
        providerId: result.providerId,
        providerName: result.providerName,
        message: result.message,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Non-destructive sync: upcoming matches only (no ALLOW_DESTRUCTIVE_SYNC needed)
  app.post("/api/admin/sync-upcoming", requireAdmin, async (_req, res) => {
    try {
      const result = await syncUpcomingMatches();
      if (!result.ok) {
        return res.status(500).json({ message: result.message });
      }
      res.json({ ok: true, added: result.added, message: result.message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  // Non-destructive sync: live matches only (no ALLOW_DESTRUCTIVE_SYNC needed)
  app.post("/api/admin/sync-live", requireAdmin, async (_req, res) => {
    try {
      const result = await syncLiveMatches();
      if (!result.ok) {
        return res.status(500).json({ message: result.message });
      }
      res.json({ ok: true, added: result.added, message: result.message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  // Non-destructive sync: past/finished matches
  app.post("/api/admin/sync-past", requireAdmin, async (req, res) => {
    try {
      const daysBack = Number(req.query.days) || 30;
      const result = await syncPastMatches(daysBack);
      if (!result.ok) {
        return res.status(500).json({ message: result.message });
      }
      res.json({ ok: true, added: result.added, message: result.message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  // Sync past matches for a specific team
  app.post("/api/admin/sync-team-history/:teamId", requireAdmin, async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      const result = await syncTeamPastMatches(team.name);
      if (!result.ok) {
        return res.status(500).json({ message: result.message });
      }
      res.json({ ok: true, added: result.added, message: result.message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  // Sync players for a specific team from PandaScore
  app.post("/api/admin/sync-team-players/:teamId", requireAdmin, async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      const result = await syncTeamPlayers(team.name, teamId);
      if (!result.ok) {
        return res.status(500).json({ message: result.message });
      }
      res.json({ ok: true, added: result.added, message: result.message });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Sync failed" });
    }
  });

  // Clear all matches (admin only)
  app.delete("/api/admin/clear-matches", requireAdmin, async (_req, res) => {
    try {
      await storage.clearAllMatches();
      res.json({ ok: true, message: "All matches cleared" });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to clear matches" });
    }
  });

  // Import matches from JSON (non-destructive)
  app.post("/api/admin/import-matches", requireAdmin, async (req, res) => {
    try {
      const matchesData = req.body.matches;
      if (!Array.isArray(matchesData)) {
        return res.status(400).json({ message: "Expected { matches: [...] }" });
      }

      let imported = 0;
      for (const m of matchesData) {
        try {
          await storage.createMatch({
            gameId: m.gameId,
            tournament: m.tournament || "",
            imageUrl: m.imageUrl || null,
            imageSource: "manual",
            team1Id: m.team1Id,
            team2Id: m.team2Id,
            startTime: new Date(m.startTime),
            status: m.status || "upcoming",
            score1: m.score1 || 0,
            score2: m.score2 || 0,
            streamUrls: m.streamUrls || [],
          });
          imported++;
        } catch (e) {
          console.error("Failed to import match:", e);
        }
      }

      res.json({ ok: true, imported, message: `${imported} matches imported` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Import failed" });
    }
  });

  if (shouldAutoSeedOnBoot()) {
    await seedDatabase();
  } else {
    console.log("Skipping automatic seed in production (ENABLE_SEED_ON_BOOT is not true).");
  }

  return httpServer;
}

async function seedDatabase() {
  const existingMatches = await storage.getMatches();
  const existingGames = await storage.getGames();

  // If we already have data, skip seeding entirely
  if (existingMatches.length > 0 || existingGames.length > 0) {
    console.log("Database already has data, skipping seed.");
    return;
  }

  // Try safe sync first (non-destructive)
  const primaryProviderId = resolvePrimaryDataProviderId();
  const providers = listDataProviders();
  const primaryProvider = providers.find((provider) => provider.id === primaryProviderId);

  if (primaryProvider?.configured) {
    try {
      const { syncUpcomingMatches } = require("./pandascore");
      const syncResult = await syncUpcomingMatches();
      if (syncResult.added > 0) {
        console.log(`[seed] Safe sync completed: ${syncResult.added} matches added.`);
        return;
      }
    } catch (e: any) {
      console.warn(`[seed] Safe sync failed: ${e.message}`);
    }
  }

  console.log("Seeding database with expanded e-sports data...");

  const val  = await storage.createGame({ name: "Valorant",          imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Valorant_logo_-_pink_color_version.svg" });
  const cs2  = await storage.createGame({ name: "Counter-Strike 2",  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Counter-Strike_2_logo.svg" });
  const dota = await storage.createGame({ name: "Dota 2",            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Dota_2_icon.svg" });
  const lol  = await storage.createGame({ name: "League of Legends", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d8/League_of_Legends_2019_vector.svg" });
  const pubg = await storage.createGame({ name: "PUBG Mobile",       imageUrl: "https://upload.wikimedia.org/wikipedia/en/2/23/Pubg_mobile_logo.png" });
  const rl   = await storage.createGame({ name: "Rocket League",     imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Rocket_League_coverart.jpg" });
  const ml   = await storage.createGame({ name: "Mobile Legends",    imageUrl: "https://upload.wikimedia.org/wikipedia/en/5/5f/Mobile_Legends_Bang_Bang.png" });

  const gmMates    = await storage.createTeam({ name: "Gentle Mates",  logoUrl: "https://logo.clearbit.com/teamgentlemates.com",  gameId: val.id });
  const bbl        = await storage.createTeam({ name: "BBL Esports",   logoUrl: "https://logo.clearbit.com/bbl.gg",               gameId: val.id });
  const furia      = await storage.createTeam({ name: "FURIA",         logoUrl: "https://logo.clearbit.com/furia.gg",             gameId: val.id });
  const nrg        = await storage.createTeam({ name: "NRG Esports",   logoUrl: "https://logo.clearbit.com/nrg.gg",               gameId: val.id });
  const sentinels  = await storage.createTeam({ name: "Sentinels",     logoUrl: "https://logo.clearbit.com/sentinels.gg",         gameId: val.id });
  const loud       = await storage.createTeam({ name: "LOUD",          logoUrl: "https://logo.clearbit.com/loud.gg",              gameId: val.id });
  const liqVal     = await storage.createTeam({ name: "Team Liquid",   logoUrl: "https://logo.clearbit.com/teamliquid.com",       gameId: val.id });
  const fnVal      = await storage.createTeam({ name: "Fnatic",        logoUrl: "https://logo.clearbit.com/fnatic.com",           gameId: val.id });

  const faze       = await storage.createTeam({ name: "FaZe Clan",     logoUrl: "https://logo.clearbit.com/fazeclan.com",         gameId: cs2.id });
  const navi       = await storage.createTeam({ name: "NAVI",          logoUrl: "https://logo.clearbit.com/navi.gg",              gameId: cs2.id });
  const g2cs       = await storage.createTeam({ name: "G2 Esports",    logoUrl: "https://logo.clearbit.com/g2esports.com",        gameId: cs2.id });
  const heroic     = await storage.createTeam({ name: "Heroic",        logoUrl: "https://logo.clearbit.com/heroic.gg",            gameId: cs2.id });
  const vitCs2     = await storage.createTeam({ name: "Team Vitality", logoUrl: "https://logo.clearbit.com/team-vitality.gg",     gameId: cs2.id });
  const mouz       = await storage.createTeam({ name: "MOUZ",          logoUrl: "https://logo.clearbit.com/mouz.gg",              gameId: cs2.id });
  const monte      = await storage.createTeam({ name: "Monte",         logoUrl: "https://ui-avatars.com/api/?name=MNT&background=1a56db&color=fff&bold=true&size=200&font-size=0.4", gameId: cs2.id });
  const spirit     = await storage.createTeam({ name: "Team Spirit",   logoUrl: "https://logo.clearbit.com/teamspirit.gg",        gameId: cs2.id });

  const liqDota    = await storage.createTeam({ name: "Team Liquid",   logoUrl: "https://logo.clearbit.com/teamliquid.com",       gameId: dota.id });
  const vici       = await storage.createTeam({ name: "Vici Gaming",   logoUrl: "https://ui-avatars.com/api/?name=VG&background=c0392b&color=fff&bold=true&size=200&font-size=0.5", gameId: dota.id });
  const falcons    = await storage.createTeam({ name: "Team Falcons",  logoUrl: "https://logo.clearbit.com/falcons.gg",           gameId: dota.id });
  const og         = await storage.createTeam({ name: "OG",            logoUrl: "https://logo.clearbit.com/og.gg",                gameId: dota.id });

  const t1         = await storage.createTeam({ name: "T1",            logoUrl: "https://logo.clearbit.com/t1.gg",                gameId: lol.id });
  const fnLol      = await storage.createTeam({ name: "Fnatic",        logoUrl: "https://logo.clearbit.com/fnatic.com",           gameId: lol.id });
  const c9Lol      = await storage.createTeam({ name: "Cloud9",        logoUrl: "https://logo.clearbit.com/cloud9.gg",            gameId: lol.id });
  const bds        = await storage.createTeam({ name: "Team BDS",      logoUrl: "https://ui-avatars.com/api/?name=BDS&background=7c3aed&color=fff&bold=true&size=200&font-size=0.4", gameId: lol.id });

  const nova       = await storage.createTeam({ name: "Nova Esports",  logoUrl: "https://logo.clearbit.com/novaesports.com",      gameId: pubg.id });
  const rrq        = await storage.createTeam({ name: "RRQ Hoshi",     logoUrl: "https://ui-avatars.com/api/?name=RRQ&background=b91c1c&color=fff&bold=true&size=200&font-size=0.4", gameId: pubg.id });

  const g2Rl       = await storage.createTeam({ name: "G2 Esports",    logoUrl: "https://logo.clearbit.com/g2esports.com",        gameId: rl.id });
  const vitRl      = await storage.createTeam({ name: "Team Vitality", logoUrl: "https://logo.clearbit.com/team-vitality.gg",     gameId: rl.id });
  const ssg        = await storage.createTeam({ name: "Spacestation",  logoUrl: "https://logo.clearbit.com/spacestation.gg",      gameId: rl.id });
  const kcorp      = await storage.createTeam({ name: "Karmine Corp",  logoUrl: "https://logo.clearbit.com/karminecorp.fr",       gameId: rl.id });

  const onic       = await storage.createTeam({ name: "ONIC Esports",  logoUrl: "https://ui-avatars.com/api/?name=ONIC&background=ff6b35&color=fff&bold=true&size=200&font-size=0.4", gameId: ml.id });
  const echo       = await storage.createTeam({ name: "Echo",          logoUrl: "https://ui-avatars.com/api/?name=ECH&background=06b6d4&color=fff&bold=true&size=200&font-size=0.4", gameId: ml.id });
  const rrqMl      = await storage.createTeam({ name: "RRQ",           logoUrl: "https://ui-avatars.com/api/?name=RRQ&background=b91c1c&color=fff&bold=true&size=200&font-size=0.4", gameId: ml.id });
  const falconsMl  = await storage.createTeam({ name: "Team Falcons",  logoUrl: "https://logo.clearbit.com/falcons.gg",           gameId: ml.id });
  const alterEgo   = await storage.createTeam({ name: "Alter Ego",     logoUrl: "https://ui-avatars.com/api/?name=AE&background=8b5cf6&color=fff&bold=true&size=200&font-size=0.5", gameId: ml.id });
  const incBlu     = await storage.createTeam({ name: "Incendio Blight",logoUrl: "https://ui-avatars.com/api/?name=IB&background=ef4444&color=fff&bold=true&size=200&font-size=0.5", gameId: ml.id });

  const pFn = (n: string, h: string, tId: number, img?: string) =>
    storage.createPlayer({ name: n, handle: h, teamId: tId, imageUrl: img ?? null });

  await pFn("Mathieu Herbaut",    "ZywOo",     vitCs2.id);
  await pFn("Oleksandr Kostyliev","s1mple",    navi.id);
  await pFn("Nikola Kovač",       "NiKo",      g2cs.id);
  await pFn("Russel Van Dulken",  "Twistzz",   faze.id);
  await pFn("Casper Møller",      "cadiaN",    heroic.id);
  await pFn("Lee Sang-hyeok",     "Faker",     t1.id);
  await pFn("Lee Min-hyeong",     "Gumayusi",  t1.id);
  await pFn("Tyson Ngo",          "TenZ",      sentinels.id);
  await pFn("Victor Wong",        "Victor",    nrg.id);
  await pFn("Felipe Beca",        "aspas",     loud.id);
  await pFn("Jesse Joronen",      "jamppi",    liqVal.id);
  await pFn("Sébastien Debs",     "Maks1Muм",  mouz.id);
  await pFn("Martin Sazdov",      "MATYS",     vitCs2.id);
  await pFn("Amer Al-Barkawi",    "Miracle-",  liqDota.id);
  await pFn("Chen Zhihao",        "Somnus",    vici.id);
  await pFn("Anathan Pham",       "ana",       og.id);
  await pFn("Kairi Rayosdelsol",  "Kairi",     echo.id);
  await pFn("Karl Gabriel",       "KarlTzy",   echo.id);
  await pFn("Sanz Rafael",        "Sanford",   onic.id);
  await pFn("Abdul Qodir",        "Udil",      onic.id);
  await pFn("Muhammad Ikhsan",    "OURA",      rrqMl.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = (offsetDays: number, h: number, m = 0) => {
    const t = new Date(today);
    t.setDate(t.getDate() + offsetDays);
    t.setHours(h, m, 0, 0);
    return t;
  };

  await storage.createMatch({ gameId: val.id,  tournament: "VCT Americas 2026 — Stage 1",  team1Id: furia.id,    team2Id: sentinels.id, startTime: d(-1, 18),    status: "finished", score1: 2, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: val.id,  tournament: "VCT Americas 2026 — Stage 1",  team1Id: nrg.id,      team2Id: loud.id,      startTime: d(-1, 21),    status: "finished", score1: 1, score2: 2, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: navi.id,     team2Id: g2cs.id,      startTime: d(-1, 17),    status: "finished", score1: 16,score2: 12,streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: vitCs2.id,   team2Id: faze.id,      startTime: d(-1, 20),    status: "finished", score1: 2, score2: 0, streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: dota.id, tournament: "The International 2025",        team1Id: falcons.id,  team2Id: og.id,        startTime: d(-1, 14),    status: "finished", score1: 2, score2: 1, streamUrls: ["https://twitch.tv/dota2ti"] });
  await storage.createMatch({ gameId: lol.id,  tournament: "LoL World Championship 2025",   team1Id: t1.id,       team2Id: fnLol.id,     startTime: d(-1, 19),    status: "finished", score1: 3, score2: 1, streamUrls: ["https://twitch.tv/riotgames"] });
  await storage.createMatch({ gameId: rl.id,   tournament: "RLCS World Championship",       team1Id: g2Rl.id,     team2Id: kcorp.id,     startTime: d(-1, 16),    status: "finished", score1: 4, score2: 3, streamUrls: ["https://twitch.tv/rocketleague"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: echo.id,     team2Id: rrqMl.id,     startTime: d(-1, 15),    status: "finished", score1: 3, score2: 1, streamUrls: ["https://youtube.com/mobilelegends"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: onic.id,     team2Id: falconsMl.id, startTime: d(-1, 17,30), status: "finished", score1: 3, score2: 2, streamUrls: ["https://youtube.com/mobilelegends"] });

  await storage.createMatch({ gameId: val.id,  tournament: "VCT EMEA 2026 — Stage 1",       team1Id: gmMates.id,  team2Id: bbl.id,       startTime: d(0, 15),     status: "finished", score1: 2, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: faze.id,     team2Id: mouz.id,      startTime: d(0, 14),     status: "finished", score1: 2, score2: 1, streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: dota.id, tournament: "PGL Wallachia Season 7",        team1Id: liqDota.id,  team2Id: vici.id,      startTime: d(0, 11),     status: "finished", score1: 0, score2: 2, streamUrls: ["https://twitch.tv/pgl"] });
  await storage.createMatch({ gameId: val.id,  tournament: "VCT EMEA 2026 — Stage 1",       team1Id: liqVal.id,   team2Id: fnVal.id,     startTime: d(0, 17,30),  status: "live",     score1: 1, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: navi.id,     team2Id: heroic.id,    startTime: d(0, 18),     status: "live",     score1: 12,score2: 14,streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: rl.id,   tournament: "RLCS World Championship",       team1Id: vitRl.id,    team2Id: ssg.id,       startTime: d(0, 18,30),  status: "live",     score1: 3, score2: 2, streamUrls: ["https://twitch.tv/rocketleague"] });
  await storage.createMatch({ gameId: val.id,  tournament: "VCT Americas 2026 — Stage 1",  team1Id: furia.id,    team2Id: liqVal.id,    startTime: d(0, 20),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: val.id,  tournament: "VCT Americas 2026 — Stage 1",  team1Id: nrg.id,      team2Id: sentinels.id, startTime: d(0, 22),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: spirit.id,   team2Id: monte.id,     startTime: d(0, 21),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: lol.id,  tournament: "LCS Spring 2026",               team1Id: t1.id,       team2Id: c9Lol.id,     startTime: d(0, 20,30),  status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/riotgames"] });
  await storage.createMatch({ gameId: pubg.id, tournament: "PMGC 2026",                     team1Id: nova.id,     team2Id: rrq.id,       startTime: d(0, 23),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://youtube.com/pubgmobile"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: falconsMl.id,team2Id: alterEgo.id,  startTime: d(0, 16),     status: "live",     score1: 2, score2: 1, streamUrls: ["https://youtube.com/mobilelegends"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: onic.id,     team2Id: incBlu.id,    startTime: d(0, 19),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://youtube.com/mobilelegends"] });

  await storage.createMatch({ gameId: val.id,  tournament: "VCT EMEA 2026 — Stage 1",       team1Id: gmMates.id,  team2Id: fnVal.id,     startTime: d(1, 17),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: val.id,  tournament: "VCT Americas 2026 — Stage 1",  team1Id: loud.id,     team2Id: sentinels.id, startTime: d(1, 20),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: g2cs.id,     team2Id: faze.id,      startTime: d(1, 19),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "BLAST Premier Spring 2026",     team1Id: heroic.id,   team2Id: monte.id,     startTime: d(1, 21),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/blast"] });
  await storage.createMatch({ gameId: dota.id, tournament: "The International 2025",        team1Id: falcons.id,  team2Id: liqDota.id,   startTime: d(1, 15),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/dota2ti"] });
  await storage.createMatch({ gameId: dota.id, tournament: "The International 2025",        team1Id: og.id,       team2Id: vici.id,      startTime: d(1, 18),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/dota2ti"] });
  await storage.createMatch({ gameId: lol.id,  tournament: "LEC Spring 2026",               team1Id: fnLol.id,    team2Id: bds.id,       startTime: d(1, 18),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/riotgames"] });
  await storage.createMatch({ gameId: rl.id,   tournament: "RLCS World Championship",       team1Id: g2Rl.id,     team2Id: vitRl.id,     startTime: d(1, 20),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/rocketleague"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: echo.id,     team2Id: alterEgo.id,  startTime: d(1, 16),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://youtube.com/mobilelegends"] });
  await storage.createMatch({ gameId: ml.id,   tournament: "MSC 2026",                      team1Id: rrqMl.id,    team2Id: incBlu.id,    startTime: d(1, 19),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://youtube.com/mobilelegends"] });

  await storage.createMatch({ gameId: val.id,  tournament: "VCT EMEA 2026 — Stage 1",       team1Id: bbl.id,      team2Id: nrg.id,       startTime: d(2, 17),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/valorant"] });
  await storage.createMatch({ gameId: cs2.id,  tournament: "ESL Pro League Season 23",      team1Id: vitCs2.id,   team2Id: spirit.id,    startTime: d(2, 19),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/esl_csgo"] });
  await storage.createMatch({ gameId: lol.id,  tournament: "LCS Spring 2026",               team1Id: c9Lol.id,    team2Id: bds.id,       startTime: d(2, 21),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://twitch.tv/riotgames"] });
  await storage.createMatch({ gameId: pubg.id, tournament: "PMGC 2026",                     team1Id: rrq.id,      team2Id: nova.id,      startTime: d(2, 22),     status: "upcoming", score1: 0, score2: 0, streamUrls: ["https://youtube.com/pubgmobile"] });

  const seededMatches = await storage.getMatches();
  const seededLeagueKeys = new Set<string>();
  for (const match of seededMatches) {
    const key = `${match.gameId}:${match.tournament}`;
    if (!match.tournament || seededLeagueKeys.has(key)) continue;

    await storage.createLeague({
      name: match.tournament,
      imageUrl: match.game.imageUrl,
      gameId: match.gameId,
    });
    seededLeagueKeys.add(key);
  }

  console.log("✅ Database seeded successfully with full esports data.");
}
