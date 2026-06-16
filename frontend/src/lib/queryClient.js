import { QueryClient } from "@tanstack/react-query";

// Shared query client. staleTime > 0 is the key to the "don't refetch on every
// tab switch / remount" win: when a screen unmounts and remounts (the Dashboard
// swaps a different component per tab), the cached data is reused instead of
// re-hitting the backend. gcTime keeps unused data around so returning to a
// screen is instant; a background revalidation runs once data goes stale.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // reuse cache for 1 min across remounts
      gcTime: 10 * 60 * 1000, // keep unused data 10 min
      refetchOnWindowFocus: false, // no surprise refetch when refocusing the tab
      retry: 1,
    },
  },
});
