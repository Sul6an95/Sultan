import { useState } from "react";
import { format } from "date-fns";
import { Monitor, Gamepad2, Smartphone, Tv2 } from "lucide-react";
import type { MatchWithRelations } from "@shared/schema";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";

interface MatchCardProps {
  match: MatchWithRelations;
}

type Platform = "pc" | "console" | "mobile";

const GAME_PLATFORMS: Record<string, Platform> = {
  "Valorant":                  "pc",
  "Counter-Strike 2":          "pc",
  "Counter-Strike":            "pc",
  "Dota 2":                    "pc",
  "League of Legends":         "pc",
  "LoL":                       "pc",
  "Overwatch":                 "pc",
  "Rainbow 6 Siege":           "pc",
  "StarCraft 2":               "pc",
  "PUBG Mobile":               "mobile",
  "PUBG":                      "mobile",
  "Free Fire":                 "mobile",
  "Mobile Legends":            "mobile",
  "Mobile Legends: Bang Bang":  "mobile",
  "LoL Wild Rift":             "mobile",
  "Rocket League":             "console",
  "EA Sports FC":              "console",
};

const PLATFORM_INFO: Record<Platform, { label: string; icon: typeof Monitor; color: string }> = {
  pc:      { label: "PC",     icon: Monitor,    color: "text-blue-400/70" },
  console: { label: "PS5",    icon: Gamepad2,   color: "text-blue-300/70" },
  mobile:  { label: "Mobile", icon: Smartphone, color: "text-green-400/70" },
};

function getPlatform(gameName: string): Platform {
  return GAME_PLATFORMS[gameName] ?? "pc";
}

function TeamLogo({ name, logoUrl, won }: { name: string; logoUrl: string | null; won: boolean }) {
  const [broken, setBroken] = useState(false);
  const initials = initialsFromName(name, 2);
  const safeLogoUrl = normalizeImageUrl(logoUrl);
  return (
    <div className={`w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden border flex items-center justify-center
      ${won ? "border-primary/50 bg-primary/10" : "border-white/15 bg-white/8"}`}>
      {safeLogoUrl && !broken ? (
        <img
          src={safeLogoUrl}
          alt={name}
          className="w-full h-full object-contain p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-xs font-bold text-white/70">{initials}</span>
      )}
    </div>
  );
}

export function MatchCard({ match }: MatchCardProps) {
  // Skip rendering if teams are missing
  if (!match.team1 || !match.team2) {
    return null;
  }

  const isLive     = match.status === "live";
  const isFinished = match.status === "finished";

  const team1Won = isFinished && (match.score1 ?? 0) > (match.score2 ?? 0);
  const team2Won = isFinished && (match.score2 ?? 0) > (match.score1 ?? 0);

  const platform = getPlatform(match.game?.name ?? "");
  const { label: platLabel, icon: PlatIcon, color: platColor } = PLATFORM_INFO[platform];

  return (
    <div className="px-4 py-3" data-testid={`card-match-${match.id}`}>
      <div className="flex items-center gap-3">

        {/* Team 1 — logo + name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <TeamLogo name={match.team1.name} logoUrl={match.team1.logoUrl} won={team1Won} />
          <span className={`text-sm font-semibold leading-tight truncate ${
            isFinished ? (team1Won ? "text-white" : "text-white/45") : "text-white"
          }`}>
            {match.team1.name}
          </span>
        </div>

        {/* Score / Status + Platform */}
        <div className="flex flex-col items-center gap-0.5 min-w-[68px] flex-shrink-0">
          {isLive ? (
            <>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-[10px] font-bold text-red-400 tracking-wide">LIVE</span>
              </div>
              <span className="text-base font-bold text-white tabular-nums">
                {match.score1} — {match.score2}
              </span>
            </>
          ) : isFinished ? (
            <>
              <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wide">FT</span>
              <span className="text-base font-bold text-white tabular-nums">
                {match.score1} — {match.score2}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-bold text-white/80 tabular-nums">
                {format(new Date(match.startTime), "HH:mm")}
              </span>
              <span className="text-[10px] text-white/35 font-medium">vs</span>
            </>
          )}

          {/* Platform badge */}
          <div className={`flex items-center gap-0.5 mt-0.5 ${platColor}`} data-testid={`badge-platform-${match.id}`}>
            <PlatIcon className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="text-[9px] font-bold tracking-wide">{platLabel}</span>
          </div>

          {/* Stream badge */}
          {match.streamUrls && match.streamUrls.length > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5 text-red-400/80" data-testid={`badge-stream-${match.id}`}>
              <Tv2 className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="text-[9px] font-bold tracking-wide">بث</span>
            </div>
          )}
        </div>

        {/* Team 2 — name + logo */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
          <span className={`text-sm font-semibold leading-tight truncate text-right ${
            isFinished ? (team2Won ? "text-white" : "text-white/45") : "text-white"
          }`}>
            {match.team2.name}
          </span>
          <TeamLogo name={match.team2.name} logoUrl={match.team2.logoUrl} won={team2Won} />
        </div>

      </div>
    </div>
  );
}
