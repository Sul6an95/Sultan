import { useState, useEffect } from "react";
import { format, addDays, subDays, isToday, isYesterday, isTomorrow } from "date-fns";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { MatchCard } from "@/components/matches/MatchCard";
import { MatchDetailModal } from "@/components/matches/MatchDetailModal";
import { useMatches } from "@/hooks/use-matches";
import { Loader2, Radio, ChevronRight, X } from "lucide-react";
import type { MatchWithRelations, Team } from "@shared/schema";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";
import { useQuery } from "@tanstack/react-query";

// ── Platform mapping ──────────────────────────────────────────────────────────
type PlatformFilter = "all" | "mobile" | "pc" | "playstation" | "live";

function matchesPlatform(m: MatchWithRelations, filter: PlatformFilter): boolean {
  if (filter === "all")  return true;
  if (filter === "live") return m.status === "live";
  
  // Use game.platform field from database
  const gamePlatform = (m.game as any).platform as string | undefined;
  
  if (filter === "mobile") {
    return gamePlatform === "mobile";
  }
  if (filter === "playstation") {
    return gamePlatform === "console";
  }
  if (filter === "pc") {
    return gamePlatform === "pc" || gamePlatform === "cross-platform" || !gamePlatform;
  }
  return true;
}


const GAME_LABEL: Record<string, string> = {
  "Valorant":                  "VAL",
  "Counter-Strike 2":          "CS2",
  "Counter-Strike":            "CS2",
  "Dota 2":                    "Dota 2",
  "League of Legends":         "LoL",
  "LoL":                       "LoL",
  "Mobile Legends: Bang Bang":  "MLBB",
  "Mobile Legends":            "MLBB",
  "Rocket League":             "RL",
  "PUBG Mobile":               "PUBG",
  "PUBG":                      "PUBG",
  "Rainbow 6 Siege":           "R6",
  "Overwatch":                 "OW",
  "EA Sports FC":              "FC",
};

const GAME_COLORS: Record<string, string> = {
  "Valorant":                  "#ff4655",
  "Counter-Strike 2":          "#f5a623",
  "Counter-Strike":            "#f5a623",
  "Dota 2":                    "#c23c2a",
  "League of Legends":         "#c69b3a",
  "LoL":                       "#c69b3a",
  "Mobile Legends: Bang Bang":  "#06b6d4",
  "Mobile Legends":            "#06b6d4",
  "Rocket League":             "#0066ff",
  "PUBG Mobile":               "#e8d44d",
  "PUBG":                      "#e8d44d",
  "Rainbow 6 Siege":           "#7c3aed",
  "Overwatch":                 "#f97316",
  "EA Sports FC":              "#22c55e",
};

function dayLabel(date: Date): string {
  if (isToday(date))     return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isTomorrow(date))  return "Tomorrow";
  return format(date, "EEE");
}

function TournamentGameIcon({ gameName, imageUrl }: { gameName: string; imageUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const safeImage = normalizeImageUrl(imageUrl);
  const initials = initialsFromName(gameName, 2);

  return (
    <div className="w-5 h-5 rounded-md overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
      {safeImage && !broken ? (
        <img
          src={safeImage}
          alt={gameName}
          className="w-full h-full object-contain p-0.5"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-[9px] font-bold text-white/65">{initials}</span>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMatch, setSelectedMatch] = useState<MatchWithRelations | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [autoJumped, setAutoJumped] = useState(false);

  // Parse team filter from URL using wouter's useSearch
  const urlParams = new URLSearchParams(searchString);
  const teamIdParam = urlParams.get("team");
  const teamId = teamIdParam ? Number(teamIdParam) : undefined;

  // Fetch team info if filtering by team
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const filterTeam = teamId ? teams?.find(t => t.id === teamId) : undefined;

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  // When filtering by team, don't filter by date to show all team matches
  const matchesQuery = useMatches(teamId ? undefined : dateStr, teamId);
  const allMatchesQuery = useMatches(undefined, teamId); // used to find nearest day
  const matches = (matchesQuery.data ?? []) as MatchWithRelations[];
  const allMatches = (allMatchesQuery.data ?? []) as MatchWithRelations[];
  const { isLoading } = matchesQuery;

  // Clear team filter
  const clearTeamFilter = () => {
    setLocation("/");
  };

  // Auto-jump to nearest date with matches when today is empty
  useEffect(() => {
    if (autoJumped || isLoading || matches.length > 0) return;
    if (allMatches.length === 0) return;
    // Find closest date to today
    const todayMs = new Date().getTime();
    const nearest = allMatches.reduce((best, m) => {
      const d = Math.abs(new Date(m.startTime).getTime() - todayMs);
      return d < best.diff ? { diff: d, date: new Date(m.startTime) } : best;
    }, { diff: Infinity, date: new Date() });
    const nearestDay = new Date(nearest.date);
    nearestDay.setUTCHours(0, 0, 0, 0);
    setSelectedDate(nearestDay);
    setAutoJumped(true);
  }, [isLoading, matches.length, allMatches, autoJumped]);

  const today = new Date();
  const dateTabs = [
    subDays(today, 2),
    subDays(today, 1),
    today,
    addDays(today, 1),
    addDays(today, 2),
  ];

  const isSameDay = (d1: Date, d2: Date) =>
    format(d1, "yyyy-MM-dd") === format(d2, "yyyy-MM-dd");

  // Filter out matches with missing teams, then apply platform filter
  const validMatches = matches.filter((m) => m.team1 && m.team2);
  const filteredMatches = validMatches.filter((m) => matchesPlatform(m, platformFilter));

  const grouped = filteredMatches.reduce((acc, match) => {
    const key = match.tournament;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, MatchWithRelations[]>);

  const liveCount = matches.filter((m) => m.status === "live").length;

  return (
    <AppLayout>
      <div className="flex flex-col w-full">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-0 border-b border-white/8">
          {/* Team Filter Banner */}
          {filterTeam && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  {filterTeam.logoUrl ? (
                    <img src={filterTeam.logoUrl} alt={filterTeam.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] font-bold text-white/60">{initialsFromName(filterTeam.name, 2)}</span>
                  )}
                </div>
                <span className="text-sm font-bold text-white">مباريات {filterTeam.name}</span>
              </div>
              <button onClick={clearTeamFilter} className="p-1 hover:bg-white/10 rounded-lg transition">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          )}

          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-0.5">
              <img src="/logo-r-trimmed.png" alt="R" className="h-9 w-auto object-contain" />
              <h1
                className="font-display font-bold text-3xl tracking-tight"
                style={{
                  background: "linear-gradient(115deg, #c084fc 0%, #ffffff 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ivox
              </h1>
            </div>
            {liveCount > 0 && (
              <button
                onClick={() => setPlatformFilter(prev => prev === "live" ? "all" : "live")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition ${
                  platformFilter === "live"
                    ? "bg-red-500/30 border-red-500/60"
                    : "bg-red-500/15 border-red-500/25 hover:bg-red-500/25"
                }`}
              >
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-400">{liveCount} LIVE</span>
              </button>
            )}
          </div>

          {/* Date Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0">
            {dateTabs.map(date => {
              const active = isSameDay(selectedDate, date);
              const hasLive = isToday(date) && liveCount > 0;
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center px-3 py-2 rounded-t-xl flex-shrink-0 transition-all border-b-2 ${
                    active
                      ? "text-white border-primary bg-primary/10"
                      : "text-white/45 border-transparent hover:text-white/70"
                  }`}
                  data-testid={`button-date-${dayLabel(date)}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    {dayLabel(date)}
                  </span>
                  <span className="text-sm font-bold">{format(date, "d")}</span>
                  {hasLive && (
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Platform Filter ──────────────────────────────────────────────── */}
        <div className="px-4 py-2.5 border-b border-white/8 bg-background/60">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {([
              { id: "all",         label: "الكل" },
              { id: "pc",          label: "PC" },
              { id: "mobile",      label: "Mobile" },
              { id: "playstation", label: "PlayStation" },
            ] as { id: PlatformFilter; label: string }[]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPlatformFilter(id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                  platformFilter === id
                    ? "bg-white text-black"
                    : "bg-white/6 text-white/55 hover:text-white hover:bg-white/10 border border-white/8"
                }`}
                data-testid={`button-platform-filter-${id}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Match List ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-28">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm text-white/40">Loading matches…</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <Radio className="w-8 h-8 text-white/20" />
              </div>
              <p className="font-semibold text-white/60">No matches scheduled</p>
              <p className="text-sm text-white/30 mt-1">Check another day or adjust the filter</p>
            </div>
          ) : (
            <div className="py-2 space-y-2">
              {Object.entries(grouped).map(([tournament, tMatches]) => {
                return (
                  <div key={tournament} className="bg-white/[0.04] border-y border-white/6">
                    {/* Tournament header */}
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Game icon */}
                        <TournamentGameIcon
                          gameName={tMatches[0]?.game.name ?? "Game"}
                          imageUrl={tMatches[0]?.game.imageUrl ?? null}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white/80 truncate">{tournament}</p>
                          <p className="text-[10px] text-white/35">{tMatches[0]?.game.name}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                    </div>

                    {/* Matches */}
                    <div className="divide-y divide-white/5">
                      {tMatches.map(match => (
                        <button
                          key={match.id}
                          onClick={() => setSelectedMatch(match)}
                          className="w-full text-left hover:bg-white/5 active:bg-white/8 transition-colors"
                          data-testid={`button-match-detail-${match.id}`}
                        >
                          <MatchCard match={match} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <MatchDetailModal
        match={selectedMatch!}
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </AppLayout>
  );
}
