import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, Star, Users, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useFavorites } from "@/hooks/use-favorites";
import { api } from "@shared/routes";
import type { Team, Player, MatchWithRelations, Game } from "@shared/schema";
import { format } from "date-fns";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";

interface FollowedTeam {
  id: number;
  name: string;
  logoUrl: string;
  game: string;
  bgColor: string;
  nextMatch?: { opponent: string; date: string; isHome: boolean };
}

interface FollowedPlayer {
  id: number;
  name: string;
  handle: string;
  team: string;
  game: string;
  imageUrl: string | null;
}

// FotMob-style vibrant team colors
const TEAM_COLORS: Record<string, string> = {
  "Sentinels": "#b91c1c",
  "Cloud9": "#0ea5e9",
  "LOUD": "#16a34a",
  "Fnatic": "#f97316",
  "Team Liquid": "#1e3a8a",
  "G2 Esports": "#dc2626",
  "NRG": "#7c3aed",
  "100 Thieves": "#dc2626",
  "T1": "#ef4444",
  "Gen.G": "#eab308",
  "DRX": "#3b82f6",
  "NAVI": "#eab308",
  "FaZe Clan": "#dc2626",
  "Vitality": "#eab308",
  "FURIA": "#1c1917",
  "MIBR": "#16a34a",
};

const FALLBACK_COLORS = ["#b91c1c", "#0369a1", "#15803d", "#7c3aed", "#c2410c", "#0f766e", "#be185d", "#1d4ed8"];

function getTeamColor(name: string): string {
  if (TEAM_COLORS[name]) return TEAM_COLORS[name];
  const sum = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

function getNextMatchForTeam(teamId: number, allMatches: MatchWithRelations[]): FollowedTeam["nextMatch"] {
  // Filter matches that have valid teams
  const relevant = allMatches.filter((m) => m.team1 && m.team2 && (m.team1Id === teamId || m.team2Id === teamId));
  if (!relevant.length) return undefined;

  const now = Date.now();
  const liveMatch = relevant.find((m) => m.status === "live");
  if (liveMatch && liveMatch.team1 && liveMatch.team2) {
    const isHome = liveMatch.team1Id === teamId;
    const opponent = isHome ? liveMatch.team2.name : liveMatch.team1.name;
    return { opponent, date: "LIVE NOW", isHome };
  }

  const upcoming = relevant
    .filter((m) => m.status === "upcoming" || new Date(m.startTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  if (!upcoming || !upcoming.team1 || !upcoming.team2) return undefined;
  const isHome = upcoming.team1Id === teamId;
  const opponent = isHome ? upcoming.team2.name : upcoming.team1.name;
  return {
    opponent,
    date: format(new Date(upcoming.startTime), "EEE, d MMM 'at' h:mm a"),
    isHome,
  };
}

type Tab = "teams" | "players";

export default function FollowingPage() {
  const [tab, setTab] = useState<Tab>("teams");
  const [showSuggested, setShowSuggested] = useState(true);
  const [, navigate] = useLocation();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const teamsQuery = useQuery<Team[]>({ queryKey: [api.teams.list.path] });
  const gamesQuery = useQuery<Game[]>({ queryKey: [api.games.list.path] });
  const playersQuery = useQuery<Player[]>({ queryKey: [api.players.list.path] });
  const matchesQuery = useQuery<MatchWithRelations[]>({ queryKey: [api.matches.list.path] });
  
  const teams = teamsQuery.data ?? [];
  const games = gamesQuery.data ?? [];
  const players = playersQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  
  const isLoading = teamsQuery.isLoading || playersQuery.isLoading;

  const gameById = useMemo(
    () => new Map(games.map((g) => [g.id, g])),
    [games],
  );

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  const followedTeams = useMemo<FollowedTeam[]>(() => {
    return favorites
      .map((teamId) => teamById.get(teamId))
      .filter((team): team is Team => !!team)
      .map((team) => {
        const gameName = team.gameId ? gameById.get(team.gameId)?.name ?? "Unknown" : "Unknown";
        return {
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          game: gameName,
          bgColor: getTeamColor(team.name),
          nextMatch: getNextMatchForTeam(team.id, matches),
        };
      });
  }, [favorites, teamById, gameById, matches]);

  // Suggested teams (teams not followed yet, with upcoming matches)
  const suggestedTeams = useMemo(() => {
    const followedIds = new Set(favorites);
    return teams
      .filter(t => !followedIds.has(t.id))
      .slice(0, 10)
      .map(team => {
        const gameName = team.gameId ? gameById.get(team.gameId)?.name ?? "" : "";
        return {
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          game: gameName,
        };
      });
  }, [teams, favorites, gameById]);

  const followedPlayers = useMemo<FollowedPlayer[]>(() => {
    return players.slice(0, 10).map((player) => {
      const team = player.teamId !== null ? teamById.get(player.teamId) : undefined;
      const gameName = team?.gameId ? gameById.get(team.gameId)?.name ?? "" : "";
      return {
        id: player.id,
        name: player.name,
        handle: player.handle,
        team: team?.name ?? "",
        game: gameName,
        imageUrl: player.imageUrl,
      };
    });
  }, [players, teamById, gameById]);

  return (
    <AppLayout>
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-5 pt-6 pb-3">
          <div className="flex items-center justify-between mb-5">
            <h1 className="font-display font-bold text-3xl text-white">Following</h1>
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-1.5 rounded-full bg-white/8 border border-white/15 text-sm font-semibold text-white/80 hover:bg-white/15 transition-colors"
                data-testid="button-edit-following"
              >
                Edit
              </button>
              <button
                className="w-8 h-8 rounded-full bg-white/8 border border-white/15 flex items-center justify-center hover:bg-white/15 transition-colors"
                data-testid="button-add-following"
                onClick={() => navigate("/search")}
              >
                <Plus className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-6 border-b border-white/10 pb-0">
            {(["teams", "players"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-sm font-bold capitalize transition-all border-b-2 -mb-px ${
                  tab === t
                    ? "text-white border-white"
                    : "text-white/40 border-transparent hover:text-white/60"
                }`}
                data-testid={`tab-${t}`}
              >
                {t === "teams" ? "Teams" : "Players"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === "teams" ? (
            <div className="space-y-6">
              {/* Followed Teams Grid */}
              {followedTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Your Teams</p>
                  <div className="grid grid-cols-2 gap-3">
                    {followedTeams.map(team => (
                      <TeamCard 
                        key={team.id} 
                        team={team} 
                        onUnfollow={() => toggleFavorite(team.id)} 
                        onClick={() => navigate(`/team/${team.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Teams */}
              {showSuggested && suggestedTeams.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Suggested</p>
                    <button 
                      onClick={() => setShowSuggested(false)}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      Don't show again
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestedTeams.map(team => (
                      <SuggestedTeamRow 
                        key={team.id} 
                        team={team} 
                        isFollowing={isFavorite(team.id)}
                        onToggle={() => toggleFavorite(team.id)} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {followedTeams.length === 0 && !showSuggested && (
                <div className="flex flex-col items-center py-20 text-white/30">
                  <Star className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">You're not following any teams yet</p>
                  <button
                    onClick={() => setShowSuggested(true)}
                    className="mt-4 px-5 py-2.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-sm font-semibold"
                  >
                    Show Suggestions
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Suggested Players */}
              {followedPlayers.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Suggested</p>
                    <button className="text-[10px] text-primary hover:text-primary/80 transition-colors">
                      Don't show again
                    </button>
                  </div>
                  <div className="space-y-2">
                    {followedPlayers.map(player => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-20 text-white/30">
                  <Users className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No players available yet</p>
                  <p className="text-xs text-white/20 mt-1">Players will appear when synced from esports data</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function TeamCard({ team, onUnfollow, onClick }: { team: FollowedTeam; onUnfollow: () => void; onClick: () => void }) {
  const [broken, setBroken] = useState(false);
  const safeLogoUrl = normalizeImageUrl(team.logoUrl);

  return (
    <div
      className="rounded-3xl p-5 flex flex-col min-h-[180px] relative overflow-hidden cursor-pointer group transition-transform hover:scale-[1.02] active:scale-[0.98]"
      style={{ 
        background: `linear-gradient(135deg, ${team.bgColor} 0%, ${team.bgColor}dd 50%, ${team.bgColor}aa 100%)`,
        boxShadow: `0 8px 32px ${team.bgColor}40`
      }}
      data-testid={`card-team-${team.id}`}
      onClick={onClick}
    >
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-black/10" />
      
      {/* Unfollow button (shows on hover) */}
      <button 
        onClick={(e) => { e.stopPropagation(); onUnfollow(); }}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 z-20"
      >
        <X className="w-3.5 h-3.5 text-white" />
      </button>

      {/* Team Logo - Large and prominent */}
      <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md border border-white/40 flex items-center justify-center overflow-hidden shadow-xl mb-auto">
        {safeLogoUrl && !broken ? (
          <img
            src={safeLogoUrl}
            alt={team.name}
            className="w-full h-full object-contain p-2"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-lg font-black text-white drop-shadow-md">{initialsFromName(team.name, 2)}</span>
        )}
      </div>

      {/* Team Info */}
      <div className="relative z-10 mt-3">
        <p className="font-black text-white text-xl leading-tight mb-2 drop-shadow-lg">{team.name}</p>

        {/* Next Match */}
        {team.nextMatch ? (
          <div className="bg-black/20 backdrop-blur-sm rounded-xl px-3 py-2 -mx-1">
            <div className="flex items-center gap-2 text-white">
              <span className="text-sm">{team.nextMatch.isHome ? "⚔" : "✈"}</span>
              <span className="text-sm font-semibold truncate">{team.nextMatch.opponent}</span>
            </div>
            <p className={`text-xs font-bold mt-0.5 ${team.nextMatch.date === "LIVE NOW" ? "text-green-400 animate-pulse" : "text-white/70"}`}>
              {team.nextMatch.date}
            </p>
          </div>
        ) : (
          <p className="text-xs text-white/60 font-medium">No upcoming matches</p>
        )}
      </div>
    </div>
  );
}

function SuggestedTeamRow({ team, isFollowing, onToggle }: { 
  team: { id: number; name: string; logoUrl: string; game: string }; 
  isFollowing: boolean;
  onToggle: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const safeLogoUrl = normalizeImageUrl(team.logoUrl);

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 hover:from-white/8 transition-all">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
        {safeLogoUrl && !broken ? (
          <img
            src={safeLogoUrl}
            alt={team.name}
            className="w-full h-full object-contain p-1.5"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-sm font-bold text-white/70">{initialsFromName(team.name, 2)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-[15px] truncate">{team.name}</p>
        {team.game && <p className="text-xs text-white/50 mt-0.5">{team.game}</p>}
      </div>
      <button
        onClick={onToggle}
        className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg ${
          isFollowing
            ? "bg-green-500 text-white shadow-green-500/30"
            : "bg-white/10 border border-white/25 text-white hover:bg-white/20"
        }`}
      >
        {isFollowing ? (
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /></span>
        ) : (
          "Follow"
        )}
      </button>
    </div>
  );
}

function PlayerRow({ player }: { player: FollowedPlayer }) {
  const [broken, setBroken] = useState(false);
  const safeImageUrl = normalizeImageUrl(player.imageUrl);

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 hover:from-white/8 transition-all cursor-pointer">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/40 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg shadow-primary/20">
        {safeImageUrl && !broken ? (
          <img
            src={safeImageUrl}
            alt={player.name}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-lg font-bold text-white/80">{initialsFromName(player.handle, 2)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-[15px] truncate">{player.handle}</p>
        <p className="text-xs text-white/50 mt-0.5">{player.team || player.name}</p>
      </div>
      <button
        className="px-5 py-2 rounded-full text-sm font-bold bg-white/10 border border-white/25 text-white hover:bg-white/20 transition-all shadow-lg"
      >
        Follow
      </button>
    </div>
  );
}
