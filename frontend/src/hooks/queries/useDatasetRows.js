import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";

// Data rows for a dataset. Enabled only when a dataset is selected, cached per
// id; add/delete-row mutations refetch this query.
export function useDatasetRows(dataSetId) {
  return useQuery({
    queryKey: ["dataset-rows", dataSetId],
    queryFn: () =>
      apiGet(`/datasets/data/${dataSetId}`).then((d) => d?.data ?? []),
    enabled: !!dataSetId,
  });
}
