import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 w-full pb-[68px]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
