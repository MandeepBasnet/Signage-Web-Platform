import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

export const ITEMS_PER_PAGE = 8;

// Server-paginated, folder-filtered, searchable media library. Cached per
// { folder, page, search }; keepPreviousData holds the current page on screen
// while the next loads. Pass { enabled } to gate until the default folder is
// resolved. Returns { media, total }.
export function useMedia({ folder, page, search }, options = {}) {
  return useQuery({
    queryKey: ["media", { folder, page, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        start: String((page - 1) * ITEMS_PER_PAGE),
        length: String(ITEMS_PER_PAGE),
      });
      if (folder && folder !== "all") params.append("folderId", folder);
      if (search) params.append("search", search);
      return apiGet(`/library?${params.toString()}`).then((d) => ({
        media: d?.data || [],
        total: Number(d?.total) || 0,
      }));
    },
    placeholderData: keepPreviousData,
    ...options,
  });
}
