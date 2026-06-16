import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Detail (playlist + its media) for one playlist. Enabled only when a playlist
// is selected, and cached per id so reopening the same playlist is instant.
// Returns the raw { playlist, media } response as `data`.
export function usePlaylistDetails(playlistId) {
  return useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => apiGet(`/playlists/${playlistId}`),
    enabled: !!playlistId,
  });
}
