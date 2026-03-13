import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useFavorites } from "@/hooks/use-favorites";
import { ChevronUp, Star } from "lucide-react";
import { initialsFromName, normalizeImageUrl } from "@/lib/image-utils";

function TeamLogo({ team }: { team: any }) {
  const [broken, setBroken] = useState(false);
  const safeLogoUrl = normalizeImageUrl(team.logoUrl);

  return (
    <div className="w-8 h-8 rounded-md bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden hover:border-white/30 transition-colors cursor-pointer">
      {safeLogoUrl && !broken ? (
        <img
          src={safeLogoUrl}
          alt={team.name}
          className="w-full h-full object-contain p-0.5"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="text-[7px] font-bold text-white/60">{initialsFromName(team.name, 1)}</span>
      )}
    </div>
  );
}

export function FollowingBar() {
  const { favorites } = useFavorites();
  const [isOpen, setIsOpen] = useState(true);
  
  const { data: teams } = useQuery({
    queryKey: [api.teams.list.path],
    queryFn: async () => {
      const res = await fetch(api.teams.list.path);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const favoriteTeams = teams?.filter((t: any) => favorites.includes(t.id)) || [];

  if (favorites.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-3"
        data-testid="button-following-toggle"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-white/70 fill-white/70" />
          <h2 className="text-sm font-bold text-white">Following</h2>
        </div>
        <ChevronUp className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "" : "rotate-180"}`} />
      </button>

      {isOpen && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x no-scrollbar">
          {favoriteTeams.map((team: any) => (
            <div 
              key={team.id} 
              className="flex-shrink-0 snap-start flex flex-col items-center gap-1"
            >
              <TeamLogo team={team} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
