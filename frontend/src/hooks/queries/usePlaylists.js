import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

export const PAGE_SIZE = 12;

// Server-paginated, searchable playlists. The query key includes page + search
// so each page/search combination is cached independently; keepPreviousData
// keeps the current rows on screen while the next page/search loads. Returns
// { playlists, total }.
export function usePlaylists({ page, search }) {
  return useQuery({
    queryKey: ["playlists", { page, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        start: String(page * PAGE_SIZE),
        length: String(PAGE_SIZE),
      });
      if (search) params.append("search", search);
      return apiGet(`/playlists?${params.toString()}`).then((d) => ({
        playlists: d?.data || [],
        total: Number(d?.total) || 0,
      }));
    },
    placeholderData: keepPreviousData,
  });
}
