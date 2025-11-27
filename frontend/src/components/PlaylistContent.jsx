/* eslint-disable no-undef */
"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";
import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
import MediaPreviewModal from "./MediaPreviewModal";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [nameChangeNotice, setNameChangeNotice] = useState(null);
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [deleteHoveredWidgetId, setDeleteHoveredWidgetId] = useState(null);
  const [deleteHoveredPlaylistId, setDeleteHoveredPlaylistId] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);

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

  const handlePreview = (item) => {
    const mediaId = getMediaId(item);
    const token = localStorage.getItem("auth_token");
    const previewUrl = `${API_BASE_URL}/library/${mediaId}/download?preview=1&token=${token}`;
    
    setPreviewMedia({
      ...item,
      previewUrl
    });
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

          // Use the new thumbnail endpoint for previews
          if (isImageType || isVideoType) {
            // For images and videos, use the thumbnail endpoint with query param token
            const token = localStorage.getItem("auth_token");
            urlMap.set(mediaId, `${API_BASE_URL}/library/${mediaId}/thumbnail?preview=1&width=300&height=200&token=${token}`);
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
      setPlaylistLoading(true); // Set loading immediately
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

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) {
      setCreateError("Playlist name is required");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const response = await fetch(`${API_BASE_URL}/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: newPlaylistDescription.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle duplicate playlist error (409 Conflict)
        if (response.status === 409) {
          setCreateError(
            errorData?.message ||
              `A playlist named '${newPlaylistName.trim()}' already exists. Please choose a different name.`
          );
          setIsCreating(false);
          return;
        }

        throw new Error(
          errorData?.message || `Failed to create playlist: ${response.status}`
        );
      }

      const data = await response.json();
      setShowCreateModal(false);
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      if (data?.nameInfo?.wasChanged) {
        setNameChangeNotice({
          entity: "playlist",
          originalName: data.nameInfo.originalName,
          finalName: data.nameInfo.finalName,
          changeReason:
            data.nameInfo.changeReason ||
            "The playlist name was adjusted to keep it unique.",
        });
      }
      // Refresh the playlist list
      fetchPlaylists();
    } catch (err) {
      console.error("Error creating playlist:", err);
      setCreateError(err.message || "Failed to create playlist");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMedia = async (widgetId) => {
    if (
      !confirm("Are you sure you want to remove this media from the playlist?")
    ) {
      return;
    }

    try {
      const playlistId =
        selectedPlaylist.playlistId ||
        selectedPlaylist.playlist_id ||
        selectedPlaylist.id ||
        selectedPlaylist.ID ||
        selectedPlaylist.PlaylistId;

      const response = await fetch(
        `${API_BASE_URL}/playlists/${playlistId}/media/${widgetId}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete media");
      }

      // Refresh playlist
      fetchPlaylistDetails(playlistId);
    } catch (err) {
      console.error("Error deleting media:", err);
      alert("Failed to delete media");
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!confirm("Are you sure you want to delete this playlist?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.status === 409) {
        const data = await response.json();
        alert(
          `Cannot delete playlist:\n\n${data.message}\n\n${data.details || ""}`
        );
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message || `Failed to delete playlist: ${response.status}`
        );
      }

      // Refresh playlists
      fetchPlaylists();
    } catch (err) {
      console.error("Error deleting playlist:", err);
      alert(`Failed to delete playlist: ${err.message}`);
    }
  };

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    return (
      mediaUrls.get(mediaId) ||
      `${API_BASE_URL}/playlists/media/${mediaId}/preview`
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
            <AddMediaPlaylistButton
              playlistId={
                selectedPlaylist?.playlistId ||
                selectedPlaylist?.playlist_id ||
                selectedPlaylist?.id ||
                selectedPlaylist?.ID ||
                selectedPlaylist?.PlaylistId
              }
              onMediaAdded={() => {
                // Refresh playlist details when media is added
                const playlistId =
                  selectedPlaylist?.playlistId ||
                  selectedPlaylist?.playlist_id ||
                  selectedPlaylist?.id ||
                  selectedPlaylist?.ID ||
                  selectedPlaylist?.PlaylistId;
                if (playlistId) {
                  fetchPlaylistDetails(playlistId);
                }
              }}
              onClose={() => {
                setShowAddMediaModal(false);
              }}
              isOpen={showAddMediaModal}
            />
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                    >
                      Thumbnail
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Duration
                    </th>
                    <th
                      scope="col"
                      className="relative px-6 py-3 w-10"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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

                    const isDeleteHovered = deleteHoveredWidgetId === widgetId;

                    return (
                      <tr
                        key={`${widgetId || "widget"}-${mediaId || "media"}`}
                        className={`hover:bg-gray-50 transition-colors ${
                          isDeleteHovered ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100 cursor-pointer flex items-center justify-center"
                            onClick={() => handlePreview(item)}
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
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  />
                                )}
                                {isVideoType && (
                                  <video
                                    src={mediaUrl}
                                    className="h-full w-full object-cover"
                                    muted
                                    loop
                                    onMouseOver={(e) => e.target.play()}
                                    onMouseOut={(e) => e.target.pause()}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                )}
                                {isAudioType && (
                                  <div className="flex items-center justify-center h-full w-full text-gray-500">
                                    <span className="text-2xl">🎵</span>
                                  </div>
                                )}
                                {!isImageType && !isVideoType && !isAudioType && (
                                  <div className="flex items-center justify-center h-full w-full text-gray-400 text-2xl">
                                    {getMediaIcon(mediaType)}
                                  </div>
                                )}
                                {/* Fallback */}
                                <div className="hidden items-center justify-center h-full w-full text-gray-400 text-2xl">
                                  {getMediaIcon(mediaType)}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full w-full text-gray-400 text-2xl">
                                {getMediaIcon(mediaType)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {item.name ||
                              item.fileName ||
                              item.mediaName ||
                              "Unnamed Media"}
                          </div>
                          {item.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 capitalize">
                            {item.mediaType || "Unknown"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {item.duration ? `${item.duration}s` : "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {widgetId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMedia(widgetId);
                              }}
                              onMouseEnter={() =>
                                setDeleteHoveredWidgetId(widgetId)
                              }
                              onMouseLeave={() => setDeleteHoveredWidgetId(null)}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove from playlist"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-5 h-5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      {/* Media Preview Modal */}
      <MediaPreviewModal
        isOpen={!!previewMedia}
        onClose={() => setPreviewMedia(null)}
        mediaUrl={previewMedia?.previewUrl}
        mediaType={previewMedia?.mediaType || previewMedia?.type}
        mediaName={previewMedia?.name || previewMedia?.fileName}
      />
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
      {/* Loading Overlay */}
      {playlistLoading && (
        <div className="fixed inset-0 z-[9999] bg-gray-900 bg-opacity-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white font-medium">Loading playlist...</p>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Playlists</h2>
            <p className="text-sm text-gray-500 mt-1">
              {playlists.length}
              {playlists.length === 1 ? " playlist" : " playlists"} found
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPlaylists}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              + Add Playlist
            </button>
          </div>
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
            {playlists.map((playlist) => {
              const playlistId =
                playlist.playlistId || playlist.playlist_id || playlist.id;
              const isDeleteHovered = deleteHoveredPlaylistId === playlistId;

              return (
                <div
                  key={playlistId}
                  className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white cursor-pointer group relative ${
                    isDeleteHovered ? "bg-red-50 border-red-200" : "bg-white"
                  }`}
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
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📂</span>
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(playlistId);
                        }}
                        onMouseEnter={() =>
                          setDeleteHoveredPlaylistId(playlistId)
                        }
                        onMouseLeave={() => setDeleteHoveredPlaylistId(null)}
                        className="p-1.5 rounded-full hover:bg-red-100 transition-colors flex-shrink-0 text-gray-400 hover:text-red-600"
                        title="Delete playlist"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
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
              );
            })}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Create New Playlist
            </h3>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Playlist Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCreating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  placeholder="Enter playlist description (optional)"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName("");
                  setNewPlaylistDescription("");
                  setCreateError("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={isCreating || !newPlaylistName.trim()}
              >
                {isCreating ? "Creating..." : "Create Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {nameChangeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {nameChangeNotice.entity === "media"
                ? "Media Name Updated"
                : "Playlist Name Updated"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {nameChangeNotice.changeReason}
            </p>
            <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-800 space-y-1">
              <p>
                <span className="font-semibold">Original:</span>{" "}
                {nameChangeNotice.originalName || "N/A"}
              </p>
              <p>
                <span className="font-semibold">Saved As:</span>{" "}
                {nameChangeNotice.finalName || "N/A"}
              </p>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setNameChangeNotice(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Media Preview Modal */}
      <MediaPreviewModal
        isOpen={!!previewMedia}
        onClose={() => setPreviewMedia(null)}
        mediaUrl={previewMedia?.previewUrl}
        mediaType={previewMedia?.mediaType || previewMedia?.type}
        mediaName={previewMedia?.name || previewMedia?.fileName}
      />
    </section>
  );
}
