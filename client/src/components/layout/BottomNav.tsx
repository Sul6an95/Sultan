import { Link, useLocation } from "wouter";
import { Gamepad2, Newspaper, Trophy, Star, Search } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          label: "Matches",  icon: Gamepad2  },
  { href: "/news",      label: "News",     icon: Newspaper },
  { href: "/leagues",   label: "Leagues",  icon: Trophy    },
  { href: "/following", label: "Following",icon: Star      },
  { href: "/search",    label: "Search",   icon: Search    },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="border-t border-white/8 bg-[#0e0e14]/95 backdrop-blur-md">
        <div className="flex justify-around items-stretch max-w-lg mx-auto">
          {NAV_ITEMS.map(item => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 flex-1 transition-all ${
                  active ? "text-primary" : "text-white/40 hover:text-white/60"
                }`}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-all ${active ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
                <span className={`text-[9px] font-bold tracking-widest uppercase ${
                  active ? "text-primary" : "text-white/30"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
