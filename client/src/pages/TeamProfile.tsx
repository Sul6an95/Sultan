import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ArrowLeft, Users, Trophy, Calendar, ChevronRight, Loader2, RefreshCw, Download } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MatchDetailModal } from "@/components/matches/MatchDetailModal";
import type { Team, Player, MatchWithRelations } from "@shared/schema";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";

type TabType = "matches" | "results" | "squad";

function TeamLogo({ team, size = "lg" }: { team: Team; size?: "sm" | "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const safeImage = normalizeImageUrl(team.logoUrl);
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  if (!safeImage || broken) {
    return (
      <div className={`${sizeClasses[size]} rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center`}>
        <span className={`font-bold text-white/60 ${size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm"}`}>
          {initialsFromName(team.name, 2)}
        </span>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl bg-white/10 border border-white/20 p-2 overflow-hidden`}>
      <img
        src={safeImage}
        alt={team.name}
        className="w-full h-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function MatchRow({ match, onClick }: { match: MatchWithRelations; onClick: () => void }) {
  const isHome = true; // In esports, both teams are equal
  const opponent = match.team1;
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl transition"
    >
      {/* Date */}
      <div className="w-14 text-center flex-shrink-0">
        <p className="text-[10px] text-white/40 uppercase">
          {format(new Date(match.startTime), "dd MMM", { locale: ar })}
        </p>
        <p className="text-xs text-white/60">
          {format(new Date(match.startTime), "HH:mm")}
        </p>
      </div>

      {/* Tournament */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/50 truncate">{match.tournament}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-5 h-5 rounded bg-white/10 overflow-hidden flex-shrink-0">
            {match.team1.logoUrl ? (
              <img src={match.team1.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[8px] font-bold text-white/40 flex items-center justify-center h-full">
                {initialsFromName(match.team1.name, 1)}
              </span>
            )}
          </div>
          <span className="text-sm text-white font-medium truncate">{match.team1.name}</span>
          <span className="text-white/30 text-xs">vs</span>
          <span className="text-sm text-white font-medium truncate">{match.team2.name}</span>
          <div className="w-5 h-5 rounded bg-white/10 overflow-hidden flex-shrink-0">
            {match.team2.logoUrl ? (
              <img src={match.team2.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[8px] font-bold text-white/40 flex items-center justify-center h-full">
                {initialsFromName(match.team2.name, 1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score / Status */}
      <div className="flex-shrink-0 text-right">
        {isLive ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-red-400">{match.score1} - {match.score2}</span>
          </div>
        ) : isFinished ? (
          <div className="px-2 py-1 rounded-lg bg-white/8">
            <span className="text-sm font-bold text-white">{match.score1} - {match.score2}</span>
          </div>
        ) : (
          <ChevronRight className="w-4 h-4 text-white/30" />
        )}
      </div>
    </button>
  );
}

function PlayerCard({ player }: { player: Player }) {
  const [broken, setBroken] = useState(false);
  const safeImage = normalizeImageUrl(player.imageUrl);

  const roleLabels: Record<string, string> = {
    captain: "كابتن",
    player: "لاعب",
    coach: "مدرب",
    analyst: "محلل",
    substitute: "احتياطي",
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white/4 border border-white/8 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
        {safeImage && !broken ? (
          <img src={safeImage} alt={player.handle} className="w-full h-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="text-xs font-bold text-white/50">{initialsFromName(player.handle, 2)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{player.handle}</p>
        <p className="text-[10px] text-white/40">{player.name}</p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
        player.role === "captain" ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-white/8 border-white/20 text-white/50"
      }`}>
        {roleLabels[player.role] || player.role}
      </span>
    </div>
  );
}

export default function TeamProfilePage() {
  const [, params] = useRoute("/team/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("matches");
  const [selectedMatch, setSelectedMatch] = useState<MatchWithRelations | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const teamId = params?.id ? Number(params.id) : null;

  // Fetch team data
  const { data: teams } = useQuery<Team[]>({ queryKey: ["/api/teams"] });
  const team = teams?.find(t => t.id === teamId);

  // Fetch team's matches (all matches, no date filter)
  const { data: allMatches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery<MatchWithRelations[]>({
    queryKey: [`/api/matches`, { teamId }],
    queryFn: async () => {
      const res = await fetch(`/api/matches?teamId=${teamId}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      return res.json();
    },
    enabled: !!teamId,
  });

  // Fetch team's players
  const { data: players = [], isLoading: playersLoading, refetch: refetchPlayers } = useQuery<Player[]>({
    queryKey: [`/api/teams/${teamId}/players`],
    enabled: !!teamId,
  });

  // Get admin token for sync operations
  const getAdminToken = () => {
    const token = localStorage.getItem("rivox_admin_token");
    const exp = localStorage.getItem("rivox_admin_token_exp");
    if (!token || !exp || Date.now() > Number(exp)) return null;
    return token;
  };

  // Sync team history mutation
  const syncHistoryMut = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Admin access required");
      const res = await fetch(`/api/admin/sync-team-history/${teamId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSyncStatus(`تم جلب ${data.added} مباراة`);
      refetchMatches();
      setTimeout(() => setSyncStatus(null), 3000);
    },
    onError: () => {
      setSyncStatus("فشل في جلب البيانات");
      setTimeout(() => setSyncStatus(null), 3000);
    },
  });

  // Sync team players mutation
  const syncPlayersMut = useMutation({
    mutationFn: async () => {
      const token = getAdminToken();
      if (!token) throw new Error("Admin access required");
      const res = await fetch(`/api/admin/sync-team-players/${teamId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSyncStatus(`تم جلب ${data.added} لاعب`);
      refetchPlayers();
      setTimeout(() => setSyncStatus(null), 3000);
    },
    onError: () => {
      setSyncStatus("فشل في جلب اللاعبين");
      setTimeout(() => setSyncStatus(null), 3000);
    },
  });

  const isAdmin = !!getAdminToken();
  const isSyncing = syncHistoryMut.isPending || syncPlayersMut.isPending;

  // Split matches into upcoming and finished
  const upcomingMatches = allMatches
    .filter(m => m.status === "upcoming" || m.status === "live")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  const finishedMatches = allMatches
    .filter(m => m.status === "finished")
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const tabs: { id: TabType; label: string; icon: typeof Trophy; count?: number }[] = [
    { id: "matches", label: "المباريات", icon: Calendar, count: upcomingMatches.length },
    { id: "results", label: "النتائج", icon: Trophy, count: finishedMatches.length },
    { id: "squad", label: "الفريق", icon: Users, count: players.length },
  ];

  if (!teamId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-white/50">فريق غير موجود</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col w-full min-h-screen">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/8">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">رجوع</span>
          </button>

          {/* Sync Status Banner */}
          {syncStatus && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-primary/20 border border-primary/30 text-sm text-primary font-medium">
              {syncStatus}
            </div>
          )}

          {team ? (
            <div className="flex items-center gap-4">
              <TeamLogo team={team} size="lg" />
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white">{team.name}</h1>
                <p className="text-sm text-white/50 mt-1">
                  {allMatches.length} مباراة • {finishedMatches.filter(m => {
                    const isTeam1 = m.team1Id === teamId;
                    const won = isTeam1 ? (m.score1 ?? 0) > (m.score2 ?? 0) : (m.score2 ?? 0) > (m.score1 ?? 0);
                    return won;
                  }).length} فوز
                </p>
              </div>
              
              {/* Admin Sync Buttons */}
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => syncHistoryMut.mutate()}
                    disabled={isSyncing}
                    className="p-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 transition disabled:opacity-50"
                    title="جلب تاريخ المباريات"
                  >
                    {syncHistoryMut.isPending ? (
                      <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                  <button
                    onClick={() => syncPlayersMut.mutate()}
                    disabled={isSyncing}
                    className="p-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 transition disabled:opacity-50"
                    title="جلب اللاعبين"
                  >
                    {syncPlayersMut.isPending ? (
                      <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 animate-pulse" />
              <div>
                <div className="w-32 h-6 bg-white/10 rounded animate-pulse" />
                <div className="w-24 h-4 bg-white/10 rounded mt-2 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-white/8 flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${
                activeTab === t.id ? "bg-primary/20 text-primary" : "text-white/50 hover:text-white"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === t.id ? "bg-primary/30" : "bg-white/10"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-4">
          {/* Upcoming Matches Tab */}
          {activeTab === "matches" && (
            <div className="space-y-3">
              {matchesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              ) : upcomingMatches.length > 0 ? (
                <>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">المباريات القادمة</p>
                  {upcomingMatches.map(match => (
                    <MatchRow key={match.id} match={match} onClick={() => setSelectedMatch(match)} />
                  ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50">لا توجد مباريات قادمة</p>
                  <p className="text-white/30 text-sm mt-1">تابع النتائج السابقة</p>
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === "results" && (
            <div className="space-y-3">
              {matchesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              ) : finishedMatches.length > 0 ? (
                <>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">النتائج السابقة</p>
                  {finishedMatches.map(match => (
                    <MatchRow key={match.id} match={match} onClick={() => setSelectedMatch(match)} />
                  ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50">لا توجد نتائج سابقة</p>
                </div>
              )}
            </div>
          )}

          {/* Squad Tab */}
          {activeTab === "squad" && (
            <div className="space-y-3">
              {playersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              ) : players.length > 0 ? (
                <>
                  <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">اللاعبون</p>
                  {players.map(player => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50">لا توجد بيانات لاعبين</p>
                  <p className="text-white/30 text-sm mt-1">يمكن للأدمن إضافتها</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Match Detail Modal */}
        {selectedMatch && (
          <MatchDetailModal
            match={selectedMatch}
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
