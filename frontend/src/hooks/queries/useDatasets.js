import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Cached datasets list, reused across tab switches / detail returns.
export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: () => apiGet("/datasets").then((d) => d?.data ?? []),
  });
}
