import { storage } from "./storage";
import { isCloudinaryConfigured, uploadImageFromUrl } from "./cloudinary";

// Fire and forget function to upload image in background without blocking sync
function mirrorToCloudinaryAsync(url: string, prefix: string, callback: (newUrl: string) => void) {
  if (!url || !isCloudinaryConfigured() || !url.includes("pandascore.co")) {
    callback(url);
    return;
  }
  
  // Return the original URL immediately so UI doesn't break, then update DB when done
  callback(url);
  
  uploadImageFromUrl(url, { publicIdPrefix: prefix })
    .then((result) => {
      // In a more complex system we would update the DB record here with the new URL
      // For now, we rely on the fact that Cloudinary urls will be fetched on next sync
      // or we can add a specific update call if needed.
    })
    .catch((err) => {
      console.error(`[Background Sync] Failed to mirror ${url} to Cloudinary:`, err.message);
    });
}

// For critical items that need immediate Cloudinary URL
async function mirrorToCloudinary(url: string, prefix: string): Promise<string> {
  if (!url || !isCloudinaryConfigured()) return url;
  if (!url.includes("pandascore.co")) return url;
  try {
    const result = await uploadImageFromUrl(url, { publicIdPrefix: prefix });
    return result.url;
  } catch {
    return url;
  }
}

const PS_API = "https://api.pandascore.co";
type GamePlatform = "pc" | "mobile" | "console" | "cross-platform";
const SUPPORTED_GAMES: Record<string, { slug: string; displayName: string; imageUrl: string; platform: GamePlatform }> = {
  "valorant":          { slug: "valorant",          displayName: "Valorant",          imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.png/240px-Valorant_logo_-_pink_color_version.png", platform: "pc" },
  "cs-go":             { slug: "cs-go",             displayName: "Counter-Strike 2",  imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/CS2_logo.svg/240px-CS2_logo.svg.png", platform: "pc" },
  "dota-2":            { slug: "dota-2",            displayName: "Dota 2",            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Dota_2_logo.png/240px-Dota_2_logo.png", platform: "pc" },
  "league-of-legends": { slug: "league-of-legends", displayName: "League of Legends", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/League_of_Legends_2019_vector.svg/240px-League_of_Legends_2019_vector.svg.png", platform: "cross-platform" },
  "mlbb":              { slug: "mlbb",              displayName: "Mobile Legends",    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Mobile_Legends_Bang_Bang.png/240px-Mobile_Legends_Bang_Bang.png", platform: "mobile" },
  "rl":                { slug: "rl",                displayName: "Rocket League",     imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Rocket_League_coverart.jpg/240px-Rocket_League_coverart.jpg", platform: "cross-platform" },
  "pubg":              { slug: "pubg",              displayName: "PUBG Mobile",       imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/PUBG_Mobile_new_logo.png/240px-PUBG_Mobile_new_logo.png", platform: "mobile" },
};

function fallbackLogo(name: string): string {
  const initials = name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map(w => w[0] ?? "").join("").substring(0, 3).toUpperCase();
  const colors = ["6d28d9","7c3aed","1d4ed8","0f766e","b91c1c","c2410c","0369a1","4d7c0f"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&bold=true&size=200&font-size=0.45`;
}

async function psGet(path: string): Promise<any> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) throw new Error("PANDASCORE_API_KEY not set");
  const url = `${PS_API}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PandaScore ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function toStatus(s: string): "upcoming" | "live" | "finished" {
  if (s === "running") return "live";
  if (s === "finished") return "finished";
  return "upcoming";
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildTeamImageKey(gameName: string, teamName: string): string {
  return `${normalizeKeyPart(gameName)}::${normalizeKeyPart(teamName)}`;
}

function buildLeagueImageKey(gameName: string, leagueName: string): string {
  return `${normalizeKeyPart(gameName)}::${normalizeKeyPart(leagueName)}`;
}

function buildMatchImageKey(
  gameName: string,
  tournament: string,
  team1Name: string,
  team2Name: string,
  startTime: Date,
): string {
  return [
    normalizeKeyPart(gameName),
    normalizeKeyPart(tournament),
    normalizeKeyPart(team1Name),
    normalizeKeyPart(team2Name),
    startTime.toISOString(),
  ].join("::");
}

export async function syncFromPandaScore() {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    console.log("No PANDASCORE_API_KEY — skipping PandaScore sync.");
    return false;
  }

  try {
    console.log("🔄 Syncing data from PandaScore...");

    const existingGames = await storage.getGames();
    const existingGameNameById = new Map<number, string>(
      existingGames.map((game) => [game.id, game.name]),
    );
    const existingTeams = await storage.getTeams();
    const existingLeagues = await storage.getLeagues();
    const existingMatches = await storage.getMatches();

    const manualTeamImages = new Map<string, string>();
    for (const team of existingTeams) {
      if (team.imageSource !== "manual" || !team.imageUrl || !team.gameId) continue;
      const gameName = existingGameNameById.get(team.gameId);
      if (!gameName) continue;
      manualTeamImages.set(buildTeamImageKey(gameName, team.name), team.imageUrl);
    }

    const manualLeagueImages = new Map<string, string>();
    for (const league of existingLeagues) {
      if (league.imageSource !== "manual" || !league.imageUrl || !league.gameId) continue;
      const gameName = existingGameNameById.get(league.gameId);
      if (!gameName) continue;
      manualLeagueImages.set(buildLeagueImageKey(gameName, league.name), league.imageUrl);
    }

    const manualMatchImages = new Map<string, string>();
    for (const match of existingMatches) {
      if (match.imageSource !== "manual" || !match.imageUrl) continue;
      const startTime = new Date(match.startTime);
      manualMatchImages.set(
        buildMatchImageKey(match.game.name, match.tournament, match.team1.name, match.team2.name, startTime),
        match.imageUrl,
      );
    }

    await storage.clearAll();

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 2);
    const to = new Date(today);
    to.setDate(to.getDate() + 5);

    const fromStr = from.toISOString().split("T")[0];
    const toStr   = to.toISOString().split("T")[0];

    const slugList = Object.keys(SUPPORTED_GAMES).join(",");

    const raw: any[] = await psGet(
      `/matches?filter[videogame]=${slugList}` +
      `&range[begin_at]=${fromStr}T00:00:00Z,${toStr}T23:59:59Z` +
      `&sort=begin_at&per_page=100`
    );

    const gameMap = new Map<string, number>();
    const teamMap = new Map<number, number>();
    const leagueMap = new Set<string>();

    for (const m of raw) {
      const gameSlug: string = m.videogame?.slug;
      if (!gameSlug || !SUPPORTED_GAMES[gameSlug]) continue;
      const gameInfo = SUPPORTED_GAMES[gameSlug];
      const gameName = gameInfo.displayName;

      if (!gameMap.has(gameSlug)) {
        const safeGameImg = await mirrorToCloudinary(gameInfo.imageUrl, `game-${gameSlug}`);
        const g = await storage.createGame({ name: gameInfo.displayName, imageUrl: safeGameImg, platform: gameInfo.platform });
        gameMap.set(gameSlug, g.id);
      }
      const gameId = gameMap.get(gameSlug)!;

      const opponents = m.opponents || [];
      if (opponents.length < 2) continue;

      const opp1 = opponents[0]?.opponent;
      const opp2 = opponents[1]?.opponent;
      if (!opp1 || !opp2) continue;

      if (!teamMap.has(opp1.id)) {
        const rawImg1  = opp1.image_url ?? fallbackLogo(opp1.name);
        const manualImage1 = manualTeamImages.get(buildTeamImageKey(gameName, opp1.name));
        let imageUrl1 = manualImage1 || rawImg1;
        
        const t = await storage.createTeam({
          name: opp1.name,
          logoUrl: imageUrl1,
          imageUrl: imageUrl1,
          imageSource: manualImage1 ? "manual" : "auto",
          gameId,
        });
        teamMap.set(opp1.id, t.id);

        if (!manualImage1 && rawImg1.includes("pandascore.co")) {
          mirrorToCloudinaryAsync(rawImg1, `team-${opp1.id}`, (newUrl) => {
            if (newUrl !== rawImg1) {
              storage.updateTeam(t.id, { logoUrl: newUrl, imageUrl: newUrl }).catch(console.error);
            }
          });
        }
      }
      if (!teamMap.has(opp2.id)) {
        const rawImg2  = opp2.image_url ?? fallbackLogo(opp2.name);
        const manualImage2 = manualTeamImages.get(buildTeamImageKey(gameName, opp2.name));
        let imageUrl2 = manualImage2 || rawImg2;

        const t = await storage.createTeam({
          name: opp2.name,
          logoUrl: imageUrl2,
          imageUrl: imageUrl2,
          imageSource: manualImage2 ? "manual" : "auto",
          gameId,
        });
        teamMap.set(opp2.id, t.id);

        if (!manualImage2 && rawImg2.includes("pandascore.co")) {
          mirrorToCloudinaryAsync(rawImg2, `team-${opp2.id}`, (newUrl) => {
            if (newUrl !== rawImg2) {
              storage.updateTeam(t.id, { logoUrl: newUrl, imageUrl: newUrl }).catch(console.error);
            }
          });
        }
      }

      const team1Id = teamMap.get(opp1.id)!;
      const team2Id = teamMap.get(opp2.id)!;

      const tournamentName = `${m.league?.name ?? ""} — ${m.tournament?.name ?? ""}`.replace(/^ — | — $/g, "");
      const autoLeagueImage = m.league?.image_url || m.tournament?.image_url || gameInfo.imageUrl;
      const leagueKey = `${gameId}:${tournamentName}`;
      if (tournamentName && !leagueMap.has(leagueKey)) {
        const manualLeagueImage = manualLeagueImages.get(buildLeagueImageKey(gameName, tournamentName));
        const initialLeagueImage = manualLeagueImage || autoLeagueImage;
        const lg = await storage.createLeague({
          name: tournamentName,
          imageUrl: initialLeagueImage,
          imageSource: manualLeagueImage ? "manual" : "auto",
          gameId,
        });
        leagueMap.add(leagueKey);

        if (!manualLeagueImage && autoLeagueImage && autoLeagueImage.includes("pandascore.co")) {
          mirrorToCloudinaryAsync(autoLeagueImage, `league-${gameId}`, (newUrl) => {
            if (newUrl !== autoLeagueImage) {
              storage.updateLeague(lg.id, { imageUrl: newUrl }).catch(console.error);
            }
          });
        }
      }

      const results = m.results || [];
      const score1 = results.find((r: any) => r.team_id === opp1.id)?.score ?? 0;
      const score2 = results.find((r: any) => r.team_id === opp2.id)?.score ?? 0;

      const streams: string[] = [];
      if (Array.isArray(m.streams_list)) {
        for (const s of m.streams_list) {
          const url: string = s.raw_url || s.embed_url || "";
          if (url && !url.startsWith("wss://") && !streams.includes(url)) {
            streams.push(url);
          }
        }
      }
      if (!streams.length && m.official_stream_url && !m.official_stream_url.startsWith("wss://")) {
        streams.push(m.official_stream_url);
      }

      const startTime = new Date(m.begin_at ?? m.scheduled_at ?? Date.now());
      const manualMatchImage = manualMatchImages.get(
        buildMatchImageKey(gameName, tournamentName, opp1.name, opp2.name, startTime),
      );
      const matchImageUrl = manualMatchImage || autoLeagueImage;

      await storage.createMatch({
        gameId,
        tournament: tournamentName,
        imageUrl: matchImageUrl,
        imageSource: manualMatchImage ? "manual" : "auto",
        team1Id,
        team2Id,
        startTime,
        status: toStatus(m.status),
        score1,
        score2,
        streamUrls: streams,
      });
    }

    const total = await storage.getMatches();
    console.log(`✅ PandaScore sync done: ${total.length} matches loaded.`);
    return true;
  } catch (err) {
    console.error("❌ PandaScore sync failed:", err);
    return false;
  }
}

// Sync upcoming matches - LIMITED to today and tomorrow only
export async function syncUpcomingMatches(): Promise<{ ok: boolean; added: number; message: string }> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return { ok: false, added: 0, message: "PANDASCORE_API_KEY not set" };
  }

  try {
    console.log("🔄 Syncing upcoming matches (today + tomorrow only)...");
    const slugList = Object.keys(SUPPORTED_GAMES).join(",");
    
    // Only fetch today and tomorrow
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const fromStr = today.toISOString().split("T")[0];
    const toStr = tomorrow.toISOString().split("T")[0];
    
    const raw: any[] = await psGet(
      `/matches/upcoming?filter[videogame]=${slugList}` +
      `&range[begin_at]=${fromStr}T00:00:00Z,${toStr}T23:59:59Z` +
      `&sort=begin_at&per_page=100`
    );

    const added = await upsertMatches(raw);
    console.log(`✅ Upcoming sync done: ${added} matches added (today+tomorrow only).`);
    return { ok: true, added, message: `${added} upcoming matches synced (today+tomorrow)` };
  } catch (err: any) {
    console.error("❌ Upcoming sync failed:", err);
    return { ok: false, added: 0, message: err.message || "Sync failed" };
  }
}

// Sync live (running) matches WITHOUT clearing existing data
export async function syncLiveMatches(): Promise<{ ok: boolean; added: number; message: string }> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return { ok: false, added: 0, message: "PANDASCORE_API_KEY not set" };
  }

  try {
    console.log("🔄 Syncing live matches from PandaScore (non-destructive)...");
    const slugList = Object.keys(SUPPORTED_GAMES).join(",");
    
    const raw: any[] = await psGet(
      `/matches/running?filter[videogame]=${slugList}&per_page=100`
    );

    const added = await upsertMatches(raw);
    console.log(`✅ Live sync done: ${added} matches added/updated.`);
    return { ok: true, added, message: `${added} live matches synced` };
  } catch (err: any) {
    console.error("❌ Live sync failed:", err);
    return { ok: false, added: 0, message: err.message || "Sync failed" };
  }
}

// Sync past/finished matches for a specific team
export async function syncTeamPastMatches(teamName: string): Promise<{ ok: boolean; added: number; message: string }> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return { ok: false, added: 0, message: "PANDASCORE_API_KEY not set" };
  }

  try {
    console.log(`🔄 Syncing past matches for team: ${teamName}...`);
    const slugList = Object.keys(SUPPORTED_GAMES).join(",");
    
    // Search for team first
    const searchResults: any[] = await psGet(
      `/teams?search[name]=${encodeURIComponent(teamName)}&per_page=5`
    );
    
    if (searchResults.length === 0) {
      return { ok: false, added: 0, message: `Team "${teamName}" not found` };
    }

    const psTeamId = searchResults[0].id;
    
    // Get past matches for this team (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromStr = sixMonthsAgo.toISOString().split("T")[0];
    const toStr = new Date().toISOString().split("T")[0];

    const raw: any[] = await psGet(
      `/teams/${psTeamId}/matches?filter[videogame]=${slugList}&filter[status]=finished` +
      `&range[begin_at]=${fromStr}T00:00:00Z,${toStr}T23:59:59Z` +
      `&sort=-begin_at&per_page=50`
    );

    const added = await upsertMatches(raw);
    console.log(`✅ Past matches sync for ${teamName}: ${added} matches added.`);
    return { ok: true, added, message: `${added} past matches synced for ${teamName}` };
  } catch (err: any) {
    console.error(`❌ Past matches sync failed for ${teamName}:`, err);
    return { ok: false, added: 0, message: err.message || "Sync failed" };
  }
}

// Sync players for a specific team from PandaScore
export async function syncTeamPlayers(teamName: string, localTeamId: number): Promise<{ ok: boolean; added: number; message: string }> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return { ok: false, added: 0, message: "PANDASCORE_API_KEY not set" };
  }

  try {
    console.log(`🔄 Syncing players for team: ${teamName}...`);
    
    // Search for team first
    const searchResults: any[] = await psGet(
      `/teams?search[name]=${encodeURIComponent(teamName)}&per_page=5`
    );
    
    if (searchResults.length === 0) {
      return { ok: false, added: 0, message: `Team "${teamName}" not found in PandaScore` };
    }

    const psTeam = searchResults[0];
    const players = psTeam.players || [];
    
    if (players.length === 0) {
      // Try to get more detailed team info
      const teamDetail: any = await psGet(`/teams/${psTeam.id}`);
      if (teamDetail.players) {
        players.push(...teamDetail.players);
      }
    }

    let addedCount = 0;
    const existingPlayers = await storage.getPlayersByTeam(localTeamId);
    const existingHandles = new Set(existingPlayers.map(p => p.handle.toLowerCase()));

    for (const p of players) {
      const handle = p.name || p.slug || "Unknown";
      if (existingHandles.has(handle.toLowerCase())) continue;

      const playerData = {
        teamId: localTeamId,
        handle,
        name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : (p.name || handle),
        imageUrl: p.image_url || null,
        role: p.role === "captain" ? "captain" as const : "player" as const,
        nationality: p.nationality || null,
        age: p.age || null,
      };

      await storage.createPlayer(playerData);
      addedCount++;
    }

    console.log(`✅ Players sync for ${teamName}: ${addedCount} players added.`);
    return { ok: true, added: addedCount, message: `${addedCount} players synced for ${teamName}` };
  } catch (err: any) {
    console.error(`❌ Players sync failed for ${teamName}:`, err);
    return { ok: false, added: 0, message: err.message || "Sync failed" };
  }
}

// Sync all past matches (finished) - broader sync
export async function syncPastMatches(daysBack: number = 30): Promise<{ ok: boolean; added: number; message: string }> {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    return { ok: false, added: 0, message: "PANDASCORE_API_KEY not set" };
  }

  try {
    console.log(`🔄 Syncing past ${daysBack} days of finished matches...`);
    const slugList = Object.keys(SUPPORTED_GAMES).join(",");
    
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = new Date().toISOString().split("T")[0];

    const raw: any[] = await psGet(
      `/matches/past?filter[videogame]=${slugList}` +
      `&range[begin_at]=${fromStr}T00:00:00Z,${toStr}T23:59:59Z` +
      `&sort=-begin_at&per_page=100`
    );

    console.log(`📊 PandaScore returned ${raw.length} past matches from API`);
    const added = await upsertMatches(raw);
    console.log(`✅ Past matches sync done: ${added} matches added.`);
    return { ok: true, added, message: `${added} past matches synced` };
  } catch (err: any) {
    console.error("❌ Past matches sync failed:", err);
    return { ok: false, added: 0, message: err.message || "Sync failed" };
  }
}

// Helper: upsert matches without clearing DB
async function upsertMatches(raw: any[]): Promise<number> {
  const existingGames = await storage.getGames();
  const existingTeams = await storage.getTeams();
  const existingMatches = await storage.getMatches();

  const gameMap = new Map<string, number>();
  for (const g of existingGames) {
    const slug = Object.entries(SUPPORTED_GAMES).find(([_, v]) => v.displayName === g.name)?.[0];
    if (slug) gameMap.set(slug, g.id);
  }

  const teamNameToId = new Map<string, number>();
  for (const t of existingTeams) {
    teamNameToId.set(t.name.toLowerCase(), t.id);
  }

  // Track existing matches by a composite key
  const existingMatchKeys = new Set<string>();
  for (const m of existingMatches) {
    const key = `${m.team1Id}-${m.team2Id}-${new Date(m.startTime).toISOString()}`;
    existingMatchKeys.add(key);
  }

  let addedCount = 0;

  for (const m of raw) {
    const gameSlug: string = m.videogame?.slug;
    if (!gameSlug || !SUPPORTED_GAMES[gameSlug]) continue;
    const gameInfo = SUPPORTED_GAMES[gameSlug];

    // Get or create game
    let gameId = gameMap.get(gameSlug);
    if (!gameId) {
      const g = await storage.createGame({ name: gameInfo.displayName, imageUrl: gameInfo.imageUrl, platform: gameInfo.platform });
      gameMap.set(gameSlug, g.id);
      gameId = g.id;
    }

    const opponents = m.opponents || [];
    if (opponents.length < 2) continue;

    const opp1 = opponents[0]?.opponent;
    const opp2 = opponents[1]?.opponent;
    if (!opp1 || !opp2) continue;

    // Get or create team 1
    let team1Id = teamNameToId.get(opp1.name.toLowerCase());
    if (!team1Id) {
      const img = opp1.image_url ?? fallbackLogo(opp1.name);
      const t = await storage.createTeam({ name: opp1.name, logoUrl: img, imageUrl: img, imageSource: "auto", gameId });
      teamNameToId.set(opp1.name.toLowerCase(), t.id);
      team1Id = t.id;
    }

    // Get or create team 2
    let team2Id = teamNameToId.get(opp2.name.toLowerCase());
    if (!team2Id) {
      const img = opp2.image_url ?? fallbackLogo(opp2.name);
      const t = await storage.createTeam({ name: opp2.name, logoUrl: img, imageUrl: img, imageSource: "auto", gameId });
      teamNameToId.set(opp2.name.toLowerCase(), t.id);
      team2Id = t.id;
    }

    const startTime = new Date(m.begin_at ?? m.scheduled_at ?? Date.now());
    const matchKey = `${team1Id}-${team2Id}-${startTime.toISOString()}`;

    // Skip if match already exists
    if (existingMatchKeys.has(matchKey)) continue;

    const tournamentName = `${m.league?.name ?? ""} — ${m.tournament?.name ?? ""}`.replace(/^ — | — $/g, "");
    const matchImageUrl = m.league?.image_url || m.tournament?.image_url || gameInfo.imageUrl;

    const results = m.results || [];
    const score1 = results.find((r: any) => r.team_id === opp1.id)?.score ?? 0;
    const score2 = results.find((r: any) => r.team_id === opp2.id)?.score ?? 0;

    const streams: string[] = [];
    if (Array.isArray(m.streams_list)) {
      for (const s of m.streams_list) {
        const url: string = s.raw_url || s.embed_url || "";
        if (url && !url.startsWith("wss://") && !streams.includes(url)) {
          streams.push(url);
        }
      }
    }

    await storage.createMatch({
      gameId,
      tournament: tournamentName,
      imageUrl: matchImageUrl,
      imageSource: "auto",
      team1Id,
      team2Id,
      startTime,
      status: toStatus(m.status),
      score1,
      score2,
      streamUrls: streams,
    });

    existingMatchKeys.add(matchKey);
    addedCount++;
  }

  return addedCount;
}
