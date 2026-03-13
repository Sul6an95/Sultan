import { storage } from "../storage";
import type { DataProvider, DataProviderSyncResult } from "./types";

const PROVIDER_ID = "riot";
const PROVIDER_NAME = "LoL Esports (Riot)";

// Public LoL Esports API key — no auth required beyond this header
const LOL_ESPORTS_API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const BASE_URL = "https://esports-api.lolesports.com/persisted/gw";

// Major leagues to pull
const LEAGUE_IDS = [
  "98767991299243165", // LCS
  "98767991302996019", // LEC
  "98767991310872058", // LCK
  "98767991314006698", // LPL
  "98767991355908944", // MSI / Worlds
  "109545772895506419", // Arabian League
];

function isRiotConfigured(): boolean {
  // Always available — uses public key. Optional: can override with RIOT_API_KEY
  return true;
}

async function riotGet(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": LOL_ESPORTS_API_KEY },
  });
  if (!res.ok) throw new Error(`LoL Esports API ${res.status}: ${await res.text()}`);
  return res.json();
}

function normalizeState(state: string): "upcoming" | "live" | "finished" {
  if (state === "inProgress") return "live";
  if (state === "completed")  return "finished";
  return "upcoming";
}

export async function syncFromRiot(): Promise<boolean> {
  console.log("🔄 Syncing from LoL Esports API…");

  try {
    // Fetch leagues metadata
    const leagueRes = await riotGet("/getLeagues?hl=en-US");
    const allLeagues: any[] = leagueRes?.data?.leagues ?? [];
    const leagueMap = new Map<string, any>(allLeagues.map((l: any) => [l.slug, l]));

    // Build game record for LoL
    const existingGames = await storage.getGames();
    let lolGame = existingGames.find((g) =>
      g.name === "League of Legends" || g.name === "LoL"
    );
    if (!lolGame) {
      lolGame = await storage.createGame({
        name: "League of Legends",
        imageUrl:
          "https://static.lolesports.com/leagues/1592516315279_LLA-01-FullonDark.png",
      });
    }

    let matchCount = 0;

    for (const leagueId of LEAGUE_IDS) {
      let pageToken: string | undefined;

      do {
        const url =
          `/getSchedule?hl=en-US&leagueId=${leagueId}` +
          (pageToken ? `&pageToken=${pageToken}` : "");
        const schedRes = await riotGet(url).catch(() => null);
        if (!schedRes) break;

        const schedule: any[] = schedRes?.data?.schedule?.events ?? [];
        pageToken = schedRes?.data?.schedule?.pages?.newer ?? undefined;

        for (const event of schedule) {
          if (event.type !== "match") continue;

          const match = event.match;
          const teams: any[] = match?.teams ?? [];
          if (teams.length < 2) continue;

          const team1Raw = teams[0];
          const team2Raw = teams[1];

          // Upsert teams
          const existingTeams = await storage.getTeams();

          let team1 = existingTeams.find((t) => t.name === team1Raw.name);
          if (!team1) {
            team1 = await storage.createTeam({
              name: team1Raw.name ?? "TBD",
              logoUrl: team1Raw.image ?? "",
              imageUrl: team1Raw.image ?? "",
              gameId: lolGame!.id,
              imageSource: "auto",
            });
          }

          let team2 = existingTeams.find((t) => t.name === team2Raw.name);
          if (!team2) {
            team2 = await storage.createTeam({
              name: team2Raw.name ?? "TBD",
              logoUrl: team2Raw.image ?? "",
              imageUrl: team2Raw.image ?? "",
              gameId: lolGame!.id,
              imageSource: "auto",
            });
          }

          const leagueSlug: string = event.league?.slug ?? "";
          const leagueMeta = leagueMap.get(leagueSlug);
          const tournamentName: string =
            event.league?.name ?? leagueMeta?.name ?? leagueSlug ?? "LoL Esports";

          // scores
          const result1 = team1Raw.result;
          const result2 = team2Raw.result;
          const score1: number = result1?.gameWins ?? 0;
          const score2: number = result2?.gameWins ?? 0;

          await storage.createMatch({
            gameId: lolGame!.id,
            team1Id: team1.id,
            team2Id: team2.id,
            tournament: tournamentName,
            startTime: new Date(event.startTime),
            status: normalizeState(event.state),
            score1,
            score2,
            streamUrls: [],
            imageSource: "auto",
          });

          matchCount++;
        }

        // Only fetch current page — avoid flooding with history
        break;
      } while (pageToken);
    }

    console.log(`✅ LoL Esports sync done: ${matchCount} matches loaded.`);
    return true;
  } catch (err) {
    console.error("❌ LoL Esports sync failed:", err);
    return false;
  }
}

export const riotProvider: DataProvider = {
  id: PROVIDER_ID,
  name: PROVIDER_NAME,

  isConfigured(): boolean {
    return isRiotConfigured();
  },

  async sync(): Promise<DataProviderSyncResult> {
    const ok = await syncFromRiot();
    if (!ok) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        providerName: PROVIDER_NAME,
        matchesLoaded: 0,
        message: "LoL Esports sync failed.",
        errorCode: "sync_failed",
      };
    }
    const matchesLoaded = (await storage.getMatches()).length;
    return {
      ok: true,
      providerId: PROVIDER_ID,
      providerName: PROVIDER_NAME,
      matchesLoaded,
      message: `Synced successfully from ${PROVIDER_NAME}.`,
    };
  },
};
