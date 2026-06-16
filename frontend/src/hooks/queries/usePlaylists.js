import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Cached playlists list. Reused across tab switches / detail-view returns
// instead of re-fetching. Returns the playlist array as `data`.
export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: () => apiGet("/playlists").then((d) => d?.data ?? []),
  });
}
