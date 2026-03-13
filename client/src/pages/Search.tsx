import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search as SearchIcon, TrendingUp, X, Users, Trophy, Gamepad2, Swords } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { MatchWithRelations } from "@shared/schema";
import { format } from "date-fns";

type FilterType = "all" | "teams" | "leagues" | "players" | "matches";

const FILTER_ICONS: Record<FilterType, typeof Trophy> = {
  all:     Gamepad2,
  teams:   Users,
  leagues: Trophy,
  players: Swords,
  matches: Swords,
};

const TYPE_COLOR: Record<FilterType, string> = {
  all:     "text-white/60",
  teams:   "text-blue-400",
  leagues: "text-yellow-400",
  players: "text-green-400",
  matches: "text-primary",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: teams  = [] } = useQuery<any[]>({ queryKey: [api.teams.list.path] });
  const { data: players = [] } = useQuery<any[]>({ queryKey: [api.players.list.path] });
  const { data: matches = [] } = useQuery<MatchWithRelations[]>({ queryKey: [api.matches.list.path] });
  const { data: games = [] } = useQuery<any[]>({ queryKey: ["/api/games"] });

  const filters: FilterType[] = ["all", "teams", "players", "leagues", "matches"];
  const labels: Record<FilterType, string> = {
    all: "All", teams: "Teams", players: "Players", leagues: "Leagues", matches: "Matches"
  };

  const q = query.toLowerCase().trim();

  const matchedTeams = q
    ? teams.filter((t: any) => t.name.toLowerCase().includes(q))
    : [];
  const matchedPlayers = q
    ? players.filter((p: any) => p.name.toLowerCase().includes(q) || p.handle?.toLowerCase().includes(q))
    : [];
  const matchedGames = q
    ? games.filter((g: any) => g.name.toLowerCase().includes(q))
    : [];

  const leagues = matches.reduce((acc, m) => {
    const key = `${m.tournament}__${m.game.name}`;
    const existing = acc.get(key);
    if (existing) {
      existing.matchesCount += 1;
    } else {
      acc.set(key, {
        id: key,
        name: m.tournament,
        game: m.game.name,
        matchesCount: 1,
      });
    }
    return acc;
  }, new Map<string, { id: string; name: string; game: string; matchesCount: number }>());

  const matchedLeagues = q
    ? Array.from(leagues.values()).filter((l) =>
        l.name.toLowerCase().includes(q) || l.game.toLowerCase().includes(q),
      )
    : [];

  const matchedMatches = q
    ? matches.filter((m) =>
        m.tournament.toLowerCase().includes(q) ||
        m.team1.name.toLowerCase().includes(q) ||
        m.team2.name.toLowerCase().includes(q) ||
        m.game.name.toLowerCase().includes(q),
      )
    : [];

  const hasResults =
    matchedTeams.length > 0 ||
    matchedPlayers.length > 0 ||
    matchedLeagues.length > 0 ||
    matchedMatches.length > 0 ||
    matchedGames.length > 0;

  // Build trending from real data
  const trending = useMemo(() => {
    const items: { label: string; type: FilterType }[] = [];
    
    // Add top teams from matches (teams that appear most frequently)
    const teamCounts = new Map<string, number>();
    matches.forEach(m => {
      teamCounts.set(m.team1.name, (teamCounts.get(m.team1.name) || 0) + 1);
      teamCounts.set(m.team2.name, (teamCounts.get(m.team2.name) || 0) + 1);
    });
    const topTeams = Array.from(teamCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => ({ label: name, type: "teams" as FilterType }));
    items.push(...topTeams);
    
    // Add top tournaments
    const tournamentCounts = new Map<string, number>();
    matches.forEach(m => {
      tournamentCounts.set(m.tournament, (tournamentCounts.get(m.tournament) || 0) + 1);
    });
    const topTournaments = Array.from(tournamentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => ({ label: name, type: "leagues" as FilterType }));
    items.push(...topTournaments);
    
    return items;
  }, [matches]);

  const trendingFiltered = filter === "all" ? trending : trending.filter(t => t.type === filter);

  return (
    <AppLayout>
      <div className="flex flex-col w-full min-h-full">

        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <h1 className="font-display font-bold text-3xl text-white mb-5">Search</h1>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                  filter === f
                    ? "bg-white text-black"
                    : "bg-white/6 border border-white/10 text-white/60 hover:text-white"
                }`}
                data-testid={`button-filter-${f}`}
              >
                {labels[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-36">
          {!q ? (
            /* Trending */
            <div>
              <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-4">Trending</p>
              <div className="flex flex-wrap gap-2">
                {trendingFiltered.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(item.label)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white/70 hover:bg-white/8 hover:text-white transition-all"
                    data-testid={`chip-trending-${idx}`}
                  >
                    <TrendingUp className={`w-3 h-3 ${TYPE_COLOR[item.type]}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : hasResults ? (
            <div className="space-y-4">
              {/* Games */}
              {filter === "all" && matchedGames.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Games</p>
                  <div className="space-y-2">
                    {matchedGames.map((game: any) => {
                      const platIcon = game.platform === "mobile" ? "📱" : game.platform === "console" ? "🎮" : game.platform === "cross-platform" ? "🌐" : "💻";
                      return (
                      <div key={game.id}
                           className="flex items-center gap-3.5 p-3.5 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/6 transition-colors cursor-pointer"
                           data-testid={`result-game-${game.id}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img src={game.imageUrl} alt={game.name} className="w-full h-full object-contain p-1" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{game.name}</p>
                          <p className="text-xs text-white/40">{platIcon} {game.platform === "mobile" ? "Mobile" : game.platform === "console" ? "Console" : game.platform === "cross-platform" ? "Cross-platform" : "PC"}</p>
                        </div>
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">Game</span>
                      </div>
                    );})}
                  </div>
                </div>
              )}

              {/* Teams */}
              {(filter === "all" || filter === "teams") && matchedTeams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Teams</p>
                  <div className="space-y-2">
                    {matchedTeams.map((team: any) => (
                      <div key={team.id}
                           className="flex items-center gap-3.5 p-3.5 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/6 transition-colors cursor-pointer"
                           data-testid={`result-team-${team.id}`}>
                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain p-1" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{team.name}</p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">Team</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Players */}
              {(filter === "all" || filter === "players") && matchedPlayers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Players</p>
                  <div className="space-y-2">
                    {matchedPlayers.map((player: any) => (
                      <div key={player.id}
                           className="flex items-center gap-3.5 p-3.5 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/6 transition-colors cursor-pointer"
                           data-testid={`result-player-${player.id}`}>
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{player.handle.substring(0,2).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{player.handle}</p>
                          <p className="text-xs text-white/40">{player.name}</p>
                        </div>
                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Player</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leagues */}
              {(filter === "all" || filter === "leagues") && matchedLeagues.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Leagues</p>
                  <div className="space-y-2">
                    {matchedLeagues.map((league) => (
                      <div key={league.id}
                           className="flex items-center gap-3.5 p-3.5 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/6 transition-colors cursor-pointer"
                           data-testid={`result-league-${league.id.replace(/\W+/g, "-")}`}>
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex-shrink-0 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{league.name}</p>
                          <p className="text-xs text-white/40">{league.game} · {league.matchesCount} matches</p>
                        </div>
                        <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">League</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matches */}
              {(filter === "all" || filter === "matches") && matchedMatches.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/35 uppercase tracking-widest mb-3">Matches</p>
                  <div className="space-y-2">
                    {matchedMatches.map((match) => (
                      <div key={match.id}
                           className="flex items-center gap-3.5 p-3.5 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/6 transition-colors cursor-pointer"
                           data-testid={`result-match-${match.id}`}>
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex-shrink-0 flex items-center justify-center">
                          <Swords className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{match.team1.name} vs {match.team2.name}</p>
                          <p className="text-xs text-white/40 truncate">{match.tournament} · {format(new Date(match.startTime), "d MMM, HH:mm")}</p>
                        </div>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">Match</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-white/25">
              <SearchIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          )}
        </div>

        {/* Search Bar Fixed Bottom */}
        <div className="fixed bottom-[68px] left-0 right-0 px-4 z-40 max-w-lg mx-auto">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search teams, players…"
              className="w-full bg-[#1a1a24] backdrop-blur-sm border border-white/15 rounded-2xl py-3.5 pl-11 pr-11 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-primary/50 transition-all shadow-xl"
              data-testid="input-search"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                data-testid="button-clear-search"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
