import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Column definitions for a dataset. Enabled only when a dataset is selected and
// cached per id (columns rarely change, so reopening is instant).
export function useDatasetColumns(dataSetId) {
  return useQuery({
    queryKey: ["dataset-columns", dataSetId],
    queryFn: () =>
      apiGet(`/datasets/${dataSetId}/column`).then((d) => d?.data ?? []),
    enabled: !!dataSetId,
  });
}
