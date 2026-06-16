import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Schedule events for a date range. Cached per range and refetched when the
// range changes; create/edit/delete update or refetch it. Returns the events
// array as `data`.
export function useSchedule({ from, to }) {
  return useQuery({
    queryKey: ["schedule", from, to],
    queryFn: () => {
      const params = new URLSearchParams({
        fromDt: `${from} 00:00:00`,
        toDt: `${to} 23:59:59`,
      });
      return apiGet(`/schedule?${params.toString()}`).then((d) => d?.data ?? []);
    },
  });
}
