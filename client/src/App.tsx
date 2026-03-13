import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Onboarding, { hasRegistered } from "@/components/Onboarding";
import FeedbackWidget from "@/components/FeedbackWidget";

// Pages
import MatchesPage from "./pages/Matches";
import NewsPage from "./pages/News";
import LeaguesPage from "./pages/Leagues";
import FollowingPage from "./pages/Following";
import SearchPage from "./pages/Search";
import AdminPage from "./pages/Admin";
import TeamProfilePage from "./pages/TeamProfile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MatchesPage} />
      <Route path="/team/:id" component={TeamProfilePage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/leagues" component={LeaguesPage} />
      <Route path="/following" component={FollowingPage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith("/admin");

  const [registered, setRegistered] = useState(() => hasRegistered());

  const showOnboarding = !isAdminRoute && !registered;

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setRegistered(true)} />}
      {!isAdminRoute && registered && <FeedbackWidget />}
      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppShell />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
