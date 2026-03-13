import { z } from 'zod';
import { games, teams, leagues, players, matches } from './schema';
import type { MatchWithRelations } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  games: {
    list: {
      method: 'GET' as const,
      path: '/api/games' as const,
      responses: {
        200: z.array(z.custom<typeof games.$inferSelect>()),
      },
    },
  },
  teams: {
    list: {
      method: 'GET' as const,
      path: '/api/teams' as const,
      responses: {
        200: z.array(z.custom<typeof teams.$inferSelect>()),
      },
    },
  },
  leagues: {
    list: {
      method: 'GET' as const,
      path: '/api/leagues' as const,
      responses: {
        200: z.array(z.custom<typeof leagues.$inferSelect>()),
      },
    },
  },
  players: {
    list: {
      method: 'GET' as const,
      path: '/api/players' as const,
      responses: {
        200: z.array(z.custom<typeof players.$inferSelect>()),
      },
    },
  },
  matches: {
    list: {
      method: 'GET' as const,
      path: '/api/matches' as const,
      input: z.object({
        date: z.string().optional(), // YYYY-MM-DD
        gameId: z.coerce.number().optional(),
        teamId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<MatchWithRelations>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
