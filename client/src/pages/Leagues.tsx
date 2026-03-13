import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, Plus, Check, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { MatchWithRelations } from "@shared/schema";

interface League {
  id: string;
  name: string;
  game: string;
  gameIcon: string;
  region: string;
  color: string;
}

const GAME_COLORS: Record<string, string> = {
  "Valorant": "#ff4655",
  "Counter-Strike 2": "#f5a623",
  "Dota 2": "#c23c2a",
  "League of Legends": "#c69b3a",
  "Rocket League": "#0066ff",
  "PUBG Mobile": "#e8d44d",
  "Mobile Legends": "#06b6d4",
};

function inferRegion(tournament: string): string {
  const lower = tournament.toLowerCase();
  if (lower.includes("emea") || lower.includes("europe")) return "Europe";
  if (lower.includes("americas") || lower.includes("na") || lower.includes("latam")) return "Americas";
  if (lower.includes("pacific") || lower.includes("apac") || lower.includes("asia")) return "Pacific";
  if (lower.includes("saudi") || lower.includes("riyadh")) return "Saudi Arabia";
  return "Global";
}

const STORAGE_KEY = "followed_leagues";

function useFollowedLeagues() {
  const [followed, setFollowed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });

  const toggle = (id: string) => {
    setFollowed(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { followed, toggle, isFollowing: (id: string) => followed.includes(id) };
}

export default function LeaguesPage() {
  const [search, setSearch] = useState("");
  const { followed, toggle, isFollowing } = useFollowedLeagues();
  const { data: matches = [] } = useQuery<MatchWithRelations[]>({ queryKey: [api.matches.list.path] });

  const allLeagues = useMemo<League[]>(() => {
    const byKey = new Map<string, League>();

    for (const m of matches) {
      const key = `${m.tournament}__${m.game.id}`;
      if (byKey.has(key)) continue;

      byKey.set(key, {
        id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name: m.tournament,
        game: m.game.name,
        gameIcon: m.game.imageUrl,
        region: inferRegion(m.tournament),
        color: GAME_COLORS[m.game.name] ?? "#6d28d9",
      });
    }

    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  const filtered = allLeagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.game.toLowerCase().includes(search.toLowerCase())
  );

  const followedLeagues = allLeagues.filter(l => followed.includes(l.id));
  const suggestedLeagues = filtered.filter(l => !followed.includes(l.id));

  return (
    <AppLayout>
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <h1 className="font-display font-bold text-3xl text-white mb-4">Leagues</h1>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find leagues"
              className="w-full bg-white/8 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
              data-testid="input-search-leagues"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Following Section */}
          {followedLeagues.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-5 py-2">
                <span className="font-bold text-white text-base">Following</span>
                <button className="text-sm font-semibold text-primary" data-testid="button-edit-following">Edit</button>
              </div>
              {followedLeagues.map(league => (
                <LeagueRow key={league.id} league={league} isFollowing={true} onToggle={() => toggle(league.id)} />
              ))}
            </div>
          )}

          {/* Suggested Section */}
          {suggestedLeagues.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-5 py-2">
                <span className="font-bold text-white text-base">
                  {search ? "Results" : "Suggested"}
                </span>
                {!search && (
                  <button className="text-sm font-semibold text-primary">Don't show again</button>
                )}
              </div>
              {suggestedLeagues.map(league => (
                <LeagueRow key={league.id} league={league} isFollowing={false} onToggle={() => toggle(league.id)} />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <TrendingUp className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No leagues found</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function LeagueRow({ league, isFollowing, onToggle }: { league: League; isFollowing: boolean; onToggle: () => void }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5 bg-white/[0.04] border-b border-white/5 hover:bg-white/[0.07] transition-colors"
      data-testid={`row-league-${league.id}`}
    >
      {/* Game Icon */}
      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
        <img src={league.gameIcon} alt={league.game} className="w-full h-full object-contain p-1" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm">{league.name}</p>
        <p className="text-xs text-white/45">{league.game} · {league.region}</p>
      </div>

      {/* Follow Button */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          isFollowing
            ? "bg-primary/20 border border-primary/40 text-primary"
            : "bg-white/10 border border-white/20 text-white hover:bg-primary/20 hover:border-primary/40 hover:text-primary"
        }`}
        data-testid={`button-follow-${league.id}`}
      >
        {isFollowing ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
