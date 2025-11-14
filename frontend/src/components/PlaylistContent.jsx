"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function PlaylistContent() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistMedia, setPlaylistMedia] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState(null);
  const [mediaUrls, setMediaUrls] = useState(new Map());

  // Helper functions
  const getMediaId = (item) => {
    return (
      item.mediaId ||
      item.media_id ||
      item.id ||
      item.media?.mediaId ||
      item.media?.media_id ||
      item.media?.id
    );
  };

  const getWidgetId = (item) => {
    return (
      item.widgetId ||
      item.widget_id ||
      item.widget?.widgetId ||
      item.widget?.widget_id
    );
  };

  const isImage = (mediaType) => {
    const type = mediaType?.toLowerCase() || "";
    return (
      type.includes("image") ||
      type.includes("jpg") ||
      type.includes("jpeg") ||
      type.includes("png") ||
      type.includes("gif") ||
      type.includes("webp") ||
      type.includes("svg")
    );
  };

  const isVideo = (mediaType) => {
    const type = mediaType?.toLowerCase() || "";
    return (
      type.includes("video") ||
      type.includes("mp4") ||
      type.includes("webm") ||
      type.includes("ogg") ||
      type.includes("mov") ||
      type.includes("avi")
    );
  };

  const isAudio = (mediaType) => {
    const type = mediaType?.toLowerCase() || "";
    return (
      type.includes("audio") ||
      type.includes("mp3") ||
      type.includes("wav") ||
      type.includes("ogg") ||
      type.includes("m4a")
    );
  };

  const getMediaIcon = (mediaType) => {
    const type = mediaType?.toLowerCase() || "";
    if (type.includes("image")) return "🖼️";
    if (type.includes("video")) return "🎬";
    if (type.includes("audio")) return "🎵";
    if (type.includes("pdf")) return "📄";
    return "📹";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      mediaUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [mediaUrls]);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/playlists`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch playlists: ${response.status}`
        );
      }

      const data = await response.json();
      setPlaylists(data?.data || []);
    } catch (err) {
      console.error("Error fetching playlists:", err);
      setError(err.message || "Failed to load playlists");
    } finally {
      setLoading(false);
    }
  };

  const normalizeMediaItems = (playlist, mediaItems = []) => {
    const widgets = playlist?.widgets || [];
    const hasValidMedia = mediaItems?.some((item) => getMediaId(item));

    if (hasValidMedia) {
      return mediaItems.map((item) => {
        const widgetId = getWidgetId(item);
        const mediaId = getMediaId(item);
        return {
          ...item,
          mediaId,
          widgetId,
          mediaType:
            item.mediaType ||
            item.type ||
            item.widgetType ||
            item.moduleName ||
            "",
          name:
            item.name ||
            item.mediaName ||
            item.media?.name ||
            item.fileName ||
            (widgetId ? `Widget ${widgetId}` : "Playlist Item"),
        };
      });
    }

    const derivedItems = [];
    widgets.forEach((widget) => {
      const widgetId = widget.widgetId || widget.widget_id || widget.id;
      const baseInfo = {
        widgetId,
        mediaType:
          widget.type ||
          widget.moduleName ||
          widget.mediaType ||
          widget.media?.mediaType,
        name:
          widget.name ||
          widget.media?.name ||
          (widgetId ? `Widget ${widgetId}` : "Playlist Widget"),
        duration: widget.duration,
        displayOrder: widget.displayOrder,
        widget,
      };

      const widgetMediaIds = widget.mediaIds || widget.media_ids || [];
      const ids =
        widgetMediaIds.length > 0
          ? widgetMediaIds
          : [widget.mediaId || widget.media_id].filter(Boolean);

      if (!ids.length) {
        derivedItems.push({
          ...baseInfo,
          mediaId: null,
        });
        return;
      }

      ids.forEach((mediaId, idx) => {
        derivedItems.push({
          ...baseInfo,
          mediaId,
          orderIndex: idx,
        });
      });
    });

    return derivedItems;
  };

  const fetchPlaylistDetails = async (playlistId) => {
    try {
      setPlaylistLoading(true);
      setPlaylistError(null);

      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to fetch playlist details: ${response.status}`
        );
      }

      const data = await response.json();
      setSelectedPlaylist(data.playlist);
      const normalizedMediaItems = normalizeMediaItems(
        data.playlist,
        data.media || []
      );

      // Pre-fetch media URLs for images/videos/audio
      const urlMap = new Map();
      for (const item of normalizedMediaItems) {
        const mediaId = getMediaId(item);
        if (mediaId) {
          const mediaType =
            item.mediaType ||
            item.type ||
            item.widgetType ||
            item.moduleName ||
            "";
          const isImageType = isImage(mediaType);
          const isVideoType = isVideo(mediaType);
          const isAudioType = isAudio(mediaType);

          // Only pre-fetch for displayable media types
          if (isImageType || isVideoType || isAudioType) {
            try {
              const mediaResponse = await fetch(
                `${API_BASE_URL}/library/${mediaId}/download`,
                {
                  headers: {
                    ...getAuthHeaders(),
                  },
                }
              );

              if (mediaResponse.ok) {
                const blob = await mediaResponse.blob();
                const blobUrl = URL.createObjectURL(blob);
                urlMap.set(mediaId, blobUrl);
              }
            } catch (err) {
              console.warn(`Failed to pre-fetch media ${mediaId}:`, err);
            }
          }
        }
      }

      setMediaUrls(urlMap);
      setPlaylistMedia(normalizedMediaItems);
    } catch (err) {
      console.error("Error fetching playlist details:", err);
      setPlaylistError(err.message || "Failed to load playlist details");
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handlePlaylistClick = (playlist) => {
    // Try multiple possible ID field names
    const playlistId =
      playlist.playlistId ||
      playlist.playlist_id ||
      playlist.id ||
      playlist.ID ||
      playlist.PlaylistId;

    if (playlistId) {
      fetchPlaylistDetails(playlistId);
    } else {
      console.error("No playlist ID found in playlist object:", playlist);
      setPlaylistError("Could not find playlist ID. Please try again.");
    }
  };

  const handleBackClick = () => {
    // Cleanup blob URLs
    mediaUrls.forEach((url) => {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    setMediaUrls(new Map());
    setSelectedPlaylist(null);
    setPlaylistMedia([]);
    setPlaylistError(null);
  };

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    return (
      mediaUrls.get(mediaId) || `${API_BASE_URL}/library/${mediaId}/download`
    );
  };

  // Show playlist detail view
  if (selectedPlaylist) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
          {/* Back button and playlist info */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackClick}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                ← Back to Playlists
              </button>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedPlaylist.name ||
                    selectedPlaylist.playlistName ||
                    "Playlist Details"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {playlistMedia.length}{" "}
                  {playlistMedia.length === 1 ? "media item" : "media items"}
                </p>
              </div>
            </div>
          </div>

          {selectedPlaylist.description && (
            <p className="text-gray-600 mb-6">{selectedPlaylist.description}</p>
          )}

          {playlistLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading playlist media...</p>
              </div>
            </div>
          ) : playlistError ? (
            <div className="rounded-lg border border-red-200 p-6 bg-red-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                  <p className="text-red-700">{playlistError}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const playlistId =
                    selectedPlaylist.playlistId ||
                    selectedPlaylist.playlist_id ||
                    selectedPlaylist.id;
                  if (playlistId) fetchPlaylistDetails(playlistId);
                }}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : playlistMedia.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No media items in this playlist
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Media items will appear here once they are added to the
                playlist.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {playlistMedia.map((item) => {
                const mediaId = getMediaId(item);
                const widgetId = getWidgetId(item);
                const mediaUrl = getMediaUrl(item);
                const mediaType =
                  item.mediaType ||
                  item.type ||
                  item.widgetType ||
                  item.moduleName ||
                  "";
                const isImageType = isImage(mediaType);
                const isVideoType = isVideo(mediaType);
                const isAudioType = isAudio(mediaType);

                return (
                  <div
                    key={`${widgetId || "widget"}-${mediaId || "media"}`}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col"
                  >
                    {/* Media Preview */}
                    <div
                      className="w-full bg-gray-100 flex items-center justify-center overflow-hidden"
                      style={{ minHeight: "200px", maxHeight: "300px" }}
                    >
                      {mediaUrl ? (
                        <>
                          {isImageType && (
                            <img
                              src={mediaUrl}
                              alt={
                                item.name ||
                                item.fileName ||
                                item.mediaName ||
                                "Media"
                              }
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          )}
                          {isVideoType && (
                            <video
                              src={mediaUrl}
                              controls
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          )}
                          {isAudioType && (
                            <div className="w-full p-4">
                              <audio
                                src={mediaUrl}
                                controls
                                className="w-full"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.parentElement.nextSibling.style.display =
                                    "flex";
                                }}
                              >
                                Your browser does not support the audio tag.
                              </audio>
                            </div>
                          )}
                          {!isImageType && !isVideoType && !isAudioType && (
                            <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                              <span className="text-6xl mb-2">
                                {getMediaIcon(mediaType)}
                              </span>
                              <a
                                href={mediaUrl}
                                download
                                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                              >
                                Download
                              </a>
                            </div>
                          )}
                          {/* Fallback when media fails to load */}
                          <div className="hidden flex-col items-center justify-center p-8 text-gray-400">
                            <span className="text-6xl mb-2">
                              {getMediaIcon(mediaType)}
                            </span>
                            <a
                              href={mediaUrl}
                              download
                              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                            >
                              Download
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                          <span className="text-6xl mb-2">
                            {getMediaIcon(mediaType)}
                          </span>
                          <span className="text-sm">No preview available</span>
                        </div>
                      )}
                    </div>

                    {/* Media Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-base truncate flex-1">
                          {item.name ||
                            item.fileName ||
                            item.mediaName ||
                            "Unnamed Media"}
                        </h3>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex flex-col gap-1 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                        {widgetId && <span>Widget ID: {widgetId}</span>}
                        {mediaId && <span>Media ID: {mediaId}</span>}
                        {item.mediaType && (
                          <span className="capitalize">
                            Type: {item.mediaType}
                          </span>
                        )}
                        {item.fileSize && (
                          <span>Size: {formatFileSize(item.fileSize)}</span>
                        )}
                        {item.duration && (
                          <span>Duration: {item.duration}s</span>
                        )}
                        {item.modifiedDt && (
                          <span>
                            Modified:{" "}
                            {new Date(item.modifiedDt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-600">Loading playlists...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-red-200 p-6 bg-red-50 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchPlaylists}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 relative p-4">
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Playlists</h2>
            <p className="text-sm text-gray-500 mt-1">
              {playlists.length}{" "}
              {playlists.length === 1 ? "playlist" : "playlists"} found
            </p>
          </div>
          <button
            onClick={fetchPlaylists}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No playlists found</p>
            <p className="text-gray-400 text-sm mt-2">
              Your playlists will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.playlistId || playlist.playlist_id || playlist.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlaylistClick(playlist);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePlaylistClick(playlist);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-lg truncate flex-1">
                    {playlist.name ||
                      playlist.playlistName ||
                      "Unnamed Playlist"}
                  </h3>
                  <span className="text-2xl ml-2">📂</span>
                </div>
                {playlist.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                  {playlist.modifiedDt && (
                    <span>
                      Modified:{" "}
                      {new Date(playlist.modifiedDt).toLocaleDateString()}
                    </span>
                  )}
                  {playlist.duration && (
                    <span className="ml-auto">
                      Duration: {playlist.duration}s
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
