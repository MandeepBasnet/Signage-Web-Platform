import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Cached displays list. Because the data lives in the query cache (not component
// state), switching Dashboard tabs and returning no longer re-fetches /displays
// from scratch — the cached array is shown instantly while a background refresh
// runs if it has gone stale. Returns the normalized display array as `data`.
export function useDisplays() {
  return useQuery({
    queryKey: ["displays"],
    queryFn: () => apiGet("/displays").then((d) => d?.data ?? []),
    // Overrides the global default. This view exists to answer "is my screen
    // alive", and a stale answer is worse than none; staleTime (60s) still
    // bounds it to at most one refetch per minute of active use.
    refetchOnWindowFocus: true,
  });
}
