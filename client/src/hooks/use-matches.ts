import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useMatches(date?: string, teamId?: number) {
  return useQuery({
    queryKey: [api.matches.list.path, date, teamId],
    queryFn: async () => {
      const url = new URL(api.matches.list.path, window.location.origin);
      if (date) {
        url.searchParams.set("date", date);
      }
      if (teamId) {
        url.searchParams.set("teamId", String(teamId));
      }
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch matches");
      
      const data = await res.json();
      return parseWithLogging(api.matches.list.responses[200], data, "matches.list");
    },
  });
}
