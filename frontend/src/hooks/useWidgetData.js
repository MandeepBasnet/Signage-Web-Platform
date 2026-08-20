import { useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";
import { API_BASE_URL } from "../config/api.js";

// Playlist and dataset contents for the widgets on a layout, fetched on demand
// and memoised per id. `loadingWidgetData` holds keys like "playlist-47" so the
// canvas can show a spinner on the specific widget being filled in.
//
// KNOWN QUIRK, preserved deliberately: the cache is written with a String key
// but read with the raw argument, so a numeric id misses its own cache entry
// and refetches. Harmless (the request is idempotent) but wasteful. Left as-is
// because this extraction is meant to be pure motion — worth fixing on its own.
export function useWidgetData() {
  const [playlistData, setPlaylistData] = useState(new Map());
  const [datasetData, setDatasetData] = useState(new Map());
  const [loadingWidgetData, setLoadingWidgetData] = useState(new Set());

  const markLoading = (key, loading) =>
    setLoadingWidgetData((prev) => {
      const next = new Set(prev);
      if (loading) next.add(key);
      else next.delete(key);
      return next;
    });

  const fetchPlaylistMedia = async (playlistId, forceRefresh = false) => {
    if (!playlistId || (!forceRefresh && playlistData.has(playlistId))) return;

    markLoading(`playlist-${playlistId}`, true);
    console.log(`Fetching playlist media for ID: ${playlistId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok)
        throw new Error(`Failed to fetch playlist: ${response.statusText}`);

      const data = await response.json();

      setPlaylistData((prev) =>
        new Map(prev).set(String(playlistId), {
          playlist: data.playlist,
          media: data.media || [],
        })
      );

      console.log(
        `Fetched ${data.media?.length || 0} media items for playlist ${playlistId}`
      );
    } catch (err) {
      console.error(`Failed to fetch playlist ${playlistId}:`, err);
    } finally {
      markLoading(`playlist-${playlistId}`, false);
    }
  };

  const fetchDatasetData = async (dataSetId, forceRefresh = false) => {
    if (!dataSetId || (!forceRefresh && datasetData.has(dataSetId))) return;

    markLoading(`dataset-${dataSetId}`, true);
    console.log(`Fetching dataset data for ID: ${dataSetId}`);

    try {
      const [colResponse, dataResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/datasets/${dataSetId}/column`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/datasets/data/${dataSetId}`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (!colResponse.ok || !dataResponse.ok)
        throw new Error("Failed to fetch dataset");

      const colData = await colResponse.json();
      const rowData = await dataResponse.json();

      setDatasetData((prev) =>
        new Map(prev).set(String(dataSetId), {
          columns: colData.data || [],
          rows: rowData.data || [],
        })
      );

      console.log(
        `Fetched dataset ${dataSetId}: ${colData.data?.length || 0} columns, ${
          rowData.data?.length || 0
        } rows`
      );
    } catch (err) {
      console.error(`Failed to fetch dataset ${dataSetId}:`, err);
    } finally {
      markLoading(`dataset-${dataSetId}`, false);
    }
  };

  return {
    playlistData,
    datasetData,
    loadingWidgetData,
    fetchPlaylistMedia,
    fetchDatasetData,
  };
}
