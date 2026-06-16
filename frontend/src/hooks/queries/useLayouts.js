import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

export const PAGE_SIZE = 20;

// Server-paginated, searchable layouts. The query key includes page + search so
// each page/search combination is cached independently; React Query also handles
// out-of-order responses (no manual cancelled flag) and, via keepPreviousData,
// keeps the current rows on screen while the next page/search loads. Returns
// { layouts, total }.
export function useLayouts({ page, search }) {
  return useQuery({
    queryKey: ["layouts", { page, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        start: String(page * PAGE_SIZE),
        length: String(PAGE_SIZE),
      });
      if (search) params.append("search", search);
      return apiGet(`/layouts?${params.toString()}`).then((d) => ({
        layouts: d?.data || [],
        total: Number(d?.total) || 0,
      }));
    },
    placeholderData: keepPreviousData,
  });
}
