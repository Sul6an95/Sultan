import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

const FAVORITES_KEY = "rivox_favorite_teams";

export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
  }, []);

  const toggleFavorite = (teamId: number) => {
    setFavorites((prev) => {
      const isFavorited = prev.includes(teamId);
      const newFavorites = isFavorited 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId];
      
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      
      // Invalidate any queries that might depend on favorites
      // (Optional: if we had a specific /api/matches/following endpoint)
      
      return newFavorites;
    });
  };

  const isFavorite = (teamId: number) => favorites.includes(teamId);

  return { favorites, toggleFavorite, isFavorite };
}
