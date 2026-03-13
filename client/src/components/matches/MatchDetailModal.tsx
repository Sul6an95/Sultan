import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { X, ExternalLink, Trophy, Zap, Users, BarChart3, Swords, Loader2, GitBranch, Table2, Clock } from "lucide-react";
import type { MatchWithRelations, Player, MatchStats } from "@shared/schema";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";

interface Props {
  match: MatchWithRelations;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "overview" | "lineup" | "stats" | "h2h" | "bracket" | "table";

type BracketRound = "round_of_16" | "quarter_final" | "semi_final" | "final";
type BracketEntry = {
  id?: number;
  round: BracketRound;
  position: number;
  team1Name: string;
  team1Logo?: string | null;
  team2Name: string;
  team2Logo?: string | null;
  score1?: number | null;
  score2?: number | null;
  isTbd?: number | null;
};

type StandingEntry = {
  id?: number;
  position: number;
  teamName: string;
  teamLogo?: string | null;
  played: number;
  goalDifference: number;
  points: number;
  isCurrentTeam?: number | null;
};

const ROUND_LABELS: Record<BracketRound, string> = {
  round_of_16: "Round of 16",
  quarter_final: "Quarter-final",
  semi_final: "Semi-final",
  final: "Final",
};

function LogoImage({ name, imageUrl, className, initialsCount = 2 }: { name: string; imageUrl: string | null; className: string; initialsCount?: number }) {
  const [broken, setBroken] = useState(false);
  const safeImage = normalizeImageUrl(imageUrl);

  if (!safeImage || broken) {
    return <span className="text-xl font-bold text-white/70">{initialsFromName(name, initialsCount)}</span>;
  }

  return (
    <img
      src={safeImage}
      alt={name}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

function PlayerImage({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const safeImage = normalizeImageUrl(imageUrl);

  if (!safeImage || broken) {
    return <span className="text-xs font-bold text-white/50">{initialsFromName(name, 2)}</span>;
  }

  return (
    <img
      src={safeImage}
      alt={name}
      className="w-full h-full object-cover"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

export function MatchDetailModal({ match, isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const hasValidTeams = !!(match?.team1 && match?.team2);

  const { data: team1Players = [] } = useQuery<Player[]>({
    queryKey: [`/api/teams/${match?.team1Id}/players`],
    enabled: isOpen && hasValidTeams && activeTab === "lineup",
  });

  const { data: team2Players = [] } = useQuery<Player[]>({
    queryKey: [`/api/teams/${match?.team2Id}/players`],
    enabled: isOpen && hasValidTeams && activeTab === "lineup",
  });

  const { data: matchStats = [] } = useQuery<MatchStats[]>({
    queryKey: [`/api/matches/${match?.id}/stats`],
    enabled: isOpen && hasValidTeams && activeTab === "stats",
  });

  const { data: h2hData } = useQuery<{ team1Wins: number; team2Wins: number; draws: number; matches: MatchWithRelations[] }>({
    queryKey: [`/api/h2h?team1=${match?.team1Id}&team2=${match?.team2Id}`],
    enabled: isOpen && hasValidTeams && activeTab === "h2h",
  });

  // Bracket data for live/upcoming matches
  const { data: bracketData = [], isLoading: bracketLoading } = useQuery<BracketEntry[]>({
    queryKey: [`/api/matches/${match?.id}/bracket`],
    enabled: isOpen && hasValidTeams && activeTab === "bracket",
  });

  // Standings data for finished matches
  const { data: standingsData = [], isLoading: standingsLoading } = useQuery<StandingEntry[]>({
    queryKey: [`/api/matches/${match?.id}/standings`],
    enabled: isOpen && hasValidTeams && activeTab === "table",
  });

  if (!isOpen || !match || !hasValidTeams) return null;

  const isLive     = match.status === "live";
  const isFinished = match.status === "finished";

  const score1 = match.score1 ?? 0;
  const score2 = match.score2 ?? 0;
  const team1Won = isFinished && score1 > score2;
  const team2Won = isFinished && score2 > score1;

  const tabs: { id: TabType; label: string; icon: typeof Trophy }[] = [
    { id: "overview", label: "نظرة عامة", icon: Trophy },
    { id: "lineup", label: "التشكيلة", icon: Users },
    { id: "stats", label: "إحصائيات", icon: BarChart3 },
    { id: "h2h", label: "المواجهات", icon: Swords },
    // Dynamic tab based on match status
    ...(isFinished 
      ? [{ id: "table" as TabType, label: "الجدول", icon: Table2 }]
      : [{ id: "bracket" as TabType, label: "الشجرة", icon: GitBranch }]
    ),
  ];

  const team1Stats = matchStats.find(s => s.teamId === match.team1Id);
  const team2Stats = matchStats.find(s => s.teamId === match.team2Id);

  const roleLabels: Record<string, string> = {
    captain: "كابتن",
    player: "لاعب",
    coach: "مدرب",
    analyst: "محلل",
    substitute: "احتياطي",
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111118] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg h-[90vh] sm:h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95">

        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-[#111118]/95 px-5 py-3 flex items-center justify-between border-b border-white/8">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center flex-shrink-0">
              <LogoImage
                name={match.game.name}
                imageUrl={match.game.imageUrl}
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white/90 truncate">{match.tournament}</p>
              <p className="text-[10px] text-white/40">
                {format(new Date(match.startTime), "dd MMM yyyy • HH:mm")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0" data-testid="button-close-modal">
            <X className="w-4.5 h-4.5 text-white/60" />
          </button>
        </div>

        {/* Score Hero - Always visible */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-4">
            {/* Team 1 */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className={`rounded-2xl overflow-hidden border-2 flex items-center justify-center p-1.5 ${
                team1Won ? "border-primary bg-primary/10" : "border-white/15 bg-white/6"
              }`} style={{width:64,height:64}}>
                <LogoImage
                  name={match.team1.name}
                  imageUrl={match.team1.logoUrl}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className={`text-xs font-bold text-center leading-tight ${team1Won ? "text-white" : "text-white/70"}`}>
                {match.team1.name}
              </p>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              {isLive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400">LIVE</span>
                </div>
              )}
              {(isLive || isFinished) ? (
                <div className="px-4 py-1.5 bg-white/6 border border-white/10 rounded-xl">
                  <span className="text-2xl font-black text-white tabular-nums">
                    {match.score1} — {match.score2}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-white/80">VS</span>
                  <span className="text-xs text-white/40">{format(new Date(match.startTime), "HH:mm")}</span>
                </div>
              )}
              {isFinished && <span className="text-[9px] font-semibold text-white/35 uppercase">انتهت</span>}
            </div>

            {/* Team 2 */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className={`rounded-2xl overflow-hidden border-2 flex items-center justify-center p-1.5 ${
                team2Won ? "border-primary bg-primary/10" : "border-white/15 bg-white/6"
              }`} style={{width:64,height:64}}>
                <LogoImage
                  name={match.team2.name}
                  imageUrl={match.team2.logoUrl}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className={`text-xs font-bold text-center leading-tight ${team2Won ? "text-white" : "text-white/70"}`}>
                {match.team2.name}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-white/8 flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === t.id ? "bg-primary/20 text-primary" : "text-white/50 hover:text-white"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
          
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Tournament Info */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <p className="text-xs font-bold text-white/60 uppercase tracking-wider">البطولة</p>
                </div>
                <p className="text-sm font-semibold text-white">{match.tournament}</p>
                <p className="text-xs text-white/50 mt-1">{match.game.name}</p>
              </div>

              {/* Streams */}
              {match.streamUrls && match.streamUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-white/60 uppercase tracking-wider">شاهد مباشر</p>
                  </div>
                  {match.streamUrls.map((url, idx) => {
                    const isTwitch = url.includes("twitch");
                    const isYT = url.includes("youtube");
                    const label = isTwitch ? "Twitch" : isYT ? "YouTube" : "بث مباشر";
                    const color = isTwitch ? "bg-purple-600/20 border-purple-500/30 text-purple-300"
                                : isYT    ? "bg-red-600/20 border-red-500/30 text-red-300"
                                : "bg-primary/15 border-primary/30 text-primary";
                    return (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                         className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:opacity-80 ${color}`}>
                        <span className="font-semibold text-sm">{label}</span>
                        <ExternalLink className="w-4 h-4 opacity-70" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lineup Tab */}
          {activeTab === "lineup" && (
            <div className="space-y-4">
              {/* Team 1 Lineup */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <p className="text-xs font-bold text-white/60 mb-3">{match.team1.name}</p>
                {team1Players.length > 0 ? (
                  <div className="space-y-2">
                    {team1Players.map(p => (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                          <PlayerImage name={p.handle} imageUrl={p.imageUrl} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{p.handle}</p>
                          <p className="text-[10px] text-white/40">{p.name}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                          p.role === "captain" ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-white/8 border-white/20 text-white/50"
                        }`}>
                          {roleLabels[p.role] || p.role}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-xs text-center py-4">لا توجد بيانات لاعبين</p>
                )}
              </div>

              {/* Team 2 Lineup */}
              <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <p className="text-xs font-bold text-white/60 mb-3">{match.team2.name}</p>
                {team2Players.length > 0 ? (
                  <div className="space-y-2">
                    {team2Players.map(p => (
                      <div key={p.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                          <PlayerImage name={p.handle} imageUrl={p.imageUrl} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{p.handle}</p>
                          <p className="text-[10px] text-white/40">{p.name}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                          p.role === "captain" ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-white/8 border-white/20 text-white/50"
                        }`}>
                          {roleLabels[p.role] || p.role}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/30 text-xs text-center py-4">لا توجد بيانات لاعبين</p>
                )}
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === "stats" && (
            <div className="space-y-4">
              {team1Stats || team2Stats ? (
                <>
                  {/* Kills */}
                  <StatBar label="Kills" val1={team1Stats?.kills ?? 0} val2={team2Stats?.kills ?? 0} team1={match.team1.name} team2={match.team2.name} />
                  {/* Deaths */}
                  <StatBar label="Deaths" val1={team1Stats?.deaths ?? 0} val2={team2Stats?.deaths ?? 0} team1={match.team1.name} team2={match.team2.name} invert />
                  {/* Assists */}
                  <StatBar label="Assists" val1={team1Stats?.assists ?? 0} val2={team2Stats?.assists ?? 0} team1={match.team1.name} team2={match.team2.name} />
                  {/* Gold */}
                  {(team1Stats?.goldEarned || team2Stats?.goldEarned) && (
                    <StatBar label="Gold" val1={team1Stats?.goldEarned ?? 0} val2={team2Stats?.goldEarned ?? 0} team1={match.team1.name} team2={match.team2.name} suffix="K" />
                  )}
                  {/* Towers */}
                  {(team1Stats?.towersDestroyed || team2Stats?.towersDestroyed) && (
                    <StatBar label="Towers" val1={team1Stats?.towersDestroyed ?? 0} val2={team2Stats?.towersDestroyed ?? 0} team1={match.team1.name} team2={match.team2.name} />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <BarChart3 className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">لا توجد إحصائيات متاحة</p>
                  <p className="text-xs mt-1">يمكن للأدمن إضافتها من لوحة التحكم</p>
                </div>
              )}
            </div>
          )}

          {/* H2H Tab */}
          {activeTab === "h2h" && (
            <div className="space-y-4">
              {h2hData ? (
                <>
                  {/* H2H Summary */}
                  <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-3 divide-x divide-white/8">
                      <div className="py-4 text-center">
                        <p className="text-2xl font-black text-white">{h2hData.team1Wins}</p>
                        <p className="text-[10px] text-white/40 mt-0.5 truncate px-1">{match.team1.name}</p>
                      </div>
                      <div className="py-4 text-center bg-white/3">
                        <p className="text-2xl font-black text-white/50">{h2hData.draws}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">تعادل</p>
                      </div>
                      <div className="py-4 text-center">
                        <p className="text-2xl font-black text-white">{h2hData.team2Wins}</p>
                        <p className="text-[10px] text-white/40 mt-0.5 truncate px-1">{match.team2.name}</p>
                      </div>
                    </div>
                    {/* Win bar */}
                    <div className="h-1.5 flex">
                      {(() => {
                        const total = h2hData.team1Wins + h2hData.draws + h2hData.team2Wins;
                        if (total === 0) return <div className="bg-white/10 h-full w-full" />;
                        return (
                          <>
                            <div className="bg-primary h-full transition-all" style={{width: `${(h2hData.team1Wins/total)*100}%`}} />
                            <div className="bg-white/20 h-full" style={{width: `${(h2hData.draws/total)*100}%`}} />
                            <div className="bg-primary/60 h-full flex-1" />
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Recent H2H Matches */}
                  {h2hData.matches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider">آخر المواجهات</p>
                      {h2hData.matches.slice(0, 5).map(m => (
                        <div key={m.id} className="bg-white/4 border border-white/8 rounded-xl p-3 flex items-center gap-3">
                          <div className="flex-1 text-right">
                            <p className={`text-xs font-semibold ${(m.score1 ?? 0) > (m.score2 ?? 0) ? "text-white" : "text-white/50"}`}>
                              {m.team1.name}
                            </p>
                          </div>
                          <div className="px-2 py-1 bg-white/8 rounded-lg">
                            <span className="text-sm font-bold text-white tabular-nums">{m.score1} - {m.score2}</span>
                          </div>
                          <div className="flex-1">
                            <p className={`text-xs font-semibold ${(m.score2 ?? 0) > (m.score1 ?? 0) ? "text-white" : "text-white/50"}`}>
                              {m.team2.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {h2hData.matches.length === 0 && (
                    <p className="text-white/30 text-xs text-center py-4">لا توجد مواجهات سابقة</p>
                  )}
                </>
              ) : (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              )}
            </div>
          )}

          {/* Bracket Tab - For live/upcoming matches */}
          {activeTab === "bracket" && (
            <div className="space-y-4">
              {bracketLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              ) : bracketData.length > 0 ? (
                <div className="space-y-3">
                  {/* Group by round */}
                  {(["final", "semi_final", "quarter_final", "round_of_16"] as BracketRound[]).map(round => {
                    const roundMatches = bracketData.filter(b => b.round === round);
                    if (roundMatches.length === 0) return null;
                    return (
                      <div key={round} className="space-y-2">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider">{ROUND_LABELS[round]}</p>
                        {roundMatches.map((entry, idx) => (
                          <div key={idx} className="bg-white/4 border border-white/8 rounded-xl p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 flex items-center gap-2">
                                {entry.team1Logo && (
                                  <img src={entry.team1Logo} alt="" className="w-5 h-5 rounded object-contain" />
                                )}
                                <span className={`text-sm font-semibold ${entry.score1 != null && entry.score2 != null && entry.score1 > entry.score2 ? "text-white" : "text-white/60"}`}>
                                  {entry.team1Name}
                                </span>
                              </div>
                              <div className="px-3 py-1 bg-white/8 rounded-lg">
                                <span className="text-sm font-bold text-white tabular-nums">
                                  {entry.isTbd ? "TBD" : `${entry.score1 ?? "-"} - ${entry.score2 ?? "-"}`}
                                </span>
                              </div>
                              <div className="flex-1 flex items-center gap-2 justify-end">
                                <span className={`text-sm font-semibold ${entry.score1 != null && entry.score2 != null && entry.score2 > entry.score1 ? "text-white" : "text-white/60"}`}>
                                  {entry.team2Name}
                                </span>
                                {entry.team2Logo && (
                                  <img src={entry.team2Logo} alt="" className="w-5 h-5 rounded object-contain" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <TournamentPlaceholder 
                  icon={GitBranch}
                  title="Tournament Bracket"
                  message="Tournament data coming soon"
                />
              )}
            </div>
          )}

          {/* Table Tab - For finished matches */}
          {activeTab === "table" && (
            <div className="space-y-4">
              {standingsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                </div>
              ) : standingsData.length > 0 ? (
                <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-white/5 text-xs text-white/40 font-bold border-b border-white/8">
                    <span>#</span>
                    <span className="col-span-2">Team</span>
                    <span className="text-center">PL</span>
                    <span className="text-center">GD</span>
                    <span className="text-center">PTS</span>
                  </div>
                  {/* Table rows */}
                  {standingsData.map((entry, idx) => (
                    <div 
                      key={idx} 
                      className={`grid grid-cols-6 gap-2 px-4 py-2.5 items-center text-sm border-b border-white/5 last:border-b-0 ${
                        entry.isCurrentTeam ? "bg-amber-500/10 border-l-2 border-l-amber-400" : ""
                      }`}
                    >
                      <span className="text-white/50 font-bold">{entry.position}</span>
                      <div className="col-span-2 flex items-center gap-2">
                        {entry.teamLogo && (
                          <img src={entry.teamLogo} alt="" className="w-5 h-5 rounded object-contain" />
                        )}
                        <span className={`font-semibold truncate ${entry.isCurrentTeam ? "text-amber-300" : "text-white"}`}>
                          {entry.teamName}
                        </span>
                      </div>
                      <span className="text-white/70 text-center">{entry.played}</span>
                      <span className={`text-center font-medium ${entry.goalDifference >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {entry.goalDifference > 0 ? "+" : ""}{entry.goalDifference}
                      </span>
                      <span className="text-white font-bold text-center">{entry.points}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <TournamentPlaceholder 
                  icon={Table2}
                  title="Group Standings"
                  message="Tournament data coming soon"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentPlaceholder({ icon: Icon, title, message }: { 
  icon: typeof Trophy; 
  title: string; 
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-sm font-bold text-white/70 mb-1">{title}</h3>
      <p className="text-xs text-white/40 text-center">{message}</p>
      <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
        <Clock className="w-4 h-4 text-primary/70" />
        <span className="text-xs font-medium text-primary/80">Coming Soon</span>
      </div>
    </div>
  );
}

function StatBar({ label, val1, val2, team1, team2, invert = false, suffix = "" }: { 
  label: string; val1: number; val2: number; team1: string; team2: string; invert?: boolean; suffix?: string 
}) {
  const total = val1 + val2;
  const pct1 = total > 0 ? (val1 / total) * 100 : 50;
  const better1 = invert ? val1 < val2 : val1 > val2;
  const better2 = invert ? val2 < val1 : val2 > val1;

  return (
    <div className="bg-white/4 border border-white/8 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${better1 ? "text-white" : "text-white/50"}`}>{val1}{suffix}</span>
        <span className="text-[10px] font-bold text-white/40 uppercase">{label}</span>
        <span className={`text-sm font-bold ${better2 ? "text-white" : "text-white/50"}`}>{val2}{suffix}</span>
      </div>
      <div className="h-1.5 flex rounded-full overflow-hidden bg-white/10">
        <div className={`h-full transition-all ${better1 ? "bg-primary" : "bg-white/30"}`} style={{width: `${pct1}%`}} />
        <div className={`h-full flex-1 ${better2 ? "bg-primary" : "bg-white/30"}`} />
      </div>
    </div>
  );
}

