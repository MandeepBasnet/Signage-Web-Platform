import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

const pickArray = (d) =>
  Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];

// Picker lists for the Add/Edit Event modal: playlists, layouts, display groups.
// Fetched together and cached; `enabled` ties loading to the modal being open,
// so reopening it doesn't re-fetch. Returns { playlists, layouts, displayGroups }.
export function useScheduleOptions(enabled) {
  return useQuery({
    queryKey: ["schedule-options"],
    queryFn: async () => {
      const [pl, lo, dg] = await Promise.all([
        apiGet("/playlists"),
        apiGet("/layouts"),
        apiGet("/schedule/display-groups"),
      ]);
      return {
        playlists: pickArray(pl),
        layouts: pickArray(lo),
        displayGroups: pickArray(dg),
      };
    },
    enabled,
  });
}
