"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const ensureNameHasExtension = (desiredName = "", fallbackName = "") => {
  const trimmed = desiredName?.trim() ?? "";
  if (!trimmed) return trimmed;

  const fallbackMatch = (fallbackName || "").match(/(\.[^./\\]+)$/);
  const fallbackExtension = fallbackMatch ? fallbackMatch[0] : "";
  const hasExtension = /\.[^./\\]+$/.test(trimmed);

  if (hasExtension || !fallbackExtension) {
    return trimmed;
  }

  return `${trimmed}${fallbackExtension}`;
};

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
  const [addMediaTab, setAddMediaTab] = useState("owned");
  const [ownedMediaOptions, setOwnedMediaOptions] = useState([]);
  const [allMediaOptions, setAllMediaOptions] = useState([]);
  const [mediaOptionsLoading, setMediaOptionsLoading] = useState(false);
  const [mediaOptionsError, setMediaOptionsError] = useState(null);
  const [attachingMediaId, setAttachingMediaId] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("1");
  const [uploadDuration, setUploadDuration] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [folderOptions, setFolderOptions] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [uploadNameSuggestion, setUploadNameSuggestion] = useState(null);

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

  const fetchMediaOptions = async (scope = "owned") => {
    try {
      setMediaOptionsLoading(true);
      setMediaOptionsError(null);

      const endpoint =
        scope === "all" ? "/library/all" : "/library";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
            `Failed to fetch media: ${response.status}`
        );
      }

      const data = await response.json();
      if (scope === "all") {
        setAllMediaOptions(data?.data || []);
      } else {
        setOwnedMediaOptions(data?.data || []);
      }
    } catch (err) {
      console.error("Error fetching media options:", err);
      setMediaOptionsError(err.message || "Failed to load media");
    } finally {
      setMediaOptionsLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      setFoldersLoading(true);
      const response = await fetch(`${API_BASE_URL}/library/folders`, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch folders: ${response.status}`
        );
      }

      const data = await response.json();
      const flattenFolders = (nodes = [], parentPath = []) => {
        const list = [];
        nodes.forEach((node) => {
          if (!node) return;
          const folderId = node.folderId || node.id;
          const label =
            node.folderName ||
            node.text ||
            node.name ||
            `Folder ${folderId || ""}`;
          const currentPath = [...parentPath, label];

          if (folderId) {
            list.push({
              id: String(folderId),
              label,
              path: currentPath.join(" / "),
            });
          }

          if (Array.isArray(node.children) && node.children.length > 0) {
            list.push(...flattenFolders(node.children, currentPath));
          }
        });
        return list;
      };

      const flat = flattenFolders(data?.folders || []);
      setFolderOptions(flat);
      if (!uploadFolder && flat.length > 0) {
        setUploadFolder(flat[0].id);
      }
    } catch (err) {
      console.error("Error fetching folders:", err);
      setUploadError(err.message || "Failed to fetch folders");
    } finally {
      setFoldersLoading(false);
    }
  };

  const openAddMediaModal = () => {
    setShowAddMediaModal(true);
    setAddMediaTab("owned");
    setMediaOptionsError(null);
    fetchMediaOptions("owned");
    if (!folderOptions.length) {
      fetchFolders();
    }
  };

  const resetUploadState = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadDuration(10);
    setUploadFolder("1");
    setUploadError(null);
    setUploadProgress(null);
    setUploadNameSuggestion(null);
  };

  const closeAddMediaModal = () => {
    setShowAddMediaModal(false);
    setAddMediaTab("owned");
    setMediaOptionsError(null);
    setOwnedMediaOptions([]);
    setAllMediaOptions([]);
    setMediaOptionsLoading(false);
    setAttachingMediaId(null);
    resetUploadState();
  };

  const handleAddMediaTabChange = (tab) => {
    setAddMediaTab(tab);
    setMediaOptionsError(null);
    if (tab === "owned") {
      fetchMediaOptions("owned");
    } else if (tab === "all") {
      fetchMediaOptions("all");
    }
  };

  const getSelectedPlaylistId = () => {
    if (!selectedPlaylist) return null;
    return (
      selectedPlaylist.playlistId ||
      selectedPlaylist.playlist_id ||
      selectedPlaylist.id ||
      selectedPlaylist.ID ||
      selectedPlaylist.PlaylistId
    );
  };

  const handleAttachMedia = async (mediaId) => {
    const playlistId = getSelectedPlaylistId();
    if (!playlistId || !mediaId) return;

    try {
      setAttachingMediaId(mediaId);
      const response = await fetch(
        `${API_BASE_URL}/playlists/${playlistId}/media`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            mediaIds: [mediaId],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to add media: ${response.status}`
        );
      }

      await response.json();
      fetchPlaylistDetails(playlistId);
      fetchMediaOptions(addMediaTab === "all" ? "all" : "owned");
    } catch (err) {
      console.error("Error adding media to playlist:", err);
      setMediaOptionsError(
        err.message || "Failed to add media to playlist"
      );
    } finally {
      setAttachingMediaId(null);
    }
  };

  const handleUploadFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name);
      }
      setUploadError(null);
      setUploadNameSuggestion(null);
    }
  };

  const validateUploadMediaName = async (nameToValidate) => {
    if (!nameToValidate) {
      setUploadError("Media name is required.");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/library/validate-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: nameToValidate }),
      });

      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        setUploadError(
          errorData?.message ||
            `A media named '${nameToValidate}' already exists. Please choose another name.`
        );
        setUploadNameSuggestion(errorData?.nameInfo || null);
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to validate media name: ${response.status}`
        );
      }

      setUploadNameSuggestion(null);
      return true;
    } catch (err) {
      console.error("Error validating media name:", err);
      setUploadError(err.message || "Failed to validate media name");
      setUploadNameSuggestion(null);
      return false;
    }
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a media file to upload.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const derivedName = ensureNameHasExtension(
        uploadName?.trim() || uploadFile.name,
        uploadFile.name
      );

      setUploadProgress("Checking media name...");
      const nameIsValid = await validateUploadMediaName(derivedName);
      if (!nameIsValid) {
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      setUploadProgress("Preparing upload...");

      const formData = new FormData();
      formData.append("media", uploadFile);
      formData.append("folderId", uploadFolder || "1");
      formData.append("duration", uploadDuration || 10);
      if (derivedName) {
        formData.append("name", derivedName);
      }

      const response = await fetch(`${API_BASE_URL}/library/upload`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Upload failed: ${response.status}`
        );
      }

      setUploadProgress("Upload successful!");

      if (result.nameInfo?.wasChanged) {
        setNameChangeNotice({
          entity: "media",
          originalName: result.nameInfo.originalName,
          finalName: result.nameInfo.finalName,
          changeReason:
            result.nameInfo.changeReason ||
            "The media name was adjusted to keep it unique.",
        });
      }

      fetchMediaOptions(addMediaTab === "all" ? "all" : "owned");
      setTimeout(() => {
        resetUploadState();
        setUploadProgress(null);
      }, 800);
    } catch (err) {
      console.error("Error uploading media:", err);
      setUploadError(err.message || "Failed to upload media");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const renderMediaSelectionGrid = (items = []) => {
    if (!items.length) {
      return (
        <div className="text-center py-10 text-gray-500">
          No media found for this view.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const mediaId = getMediaId(item);
          const mediaType = item.mediaType || item.type || "";
          return (
            <div
              key={mediaId || item.id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getMediaIcon(mediaType)}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {item.name || item.fileName || "Unnamed Media"}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {mediaType || "Unknown type"}
                  </p>
                </div>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="text-xs text-gray-500 space-y-1">
                {mediaId && <p>Media ID: {mediaId}</p>}
                {item.fileSize && (
                  <p>Size: {formatFileSize(item.fileSize)}</p>
                )}
                {item.modifiedDt && (
                  <p>
                    Modified:{" "}
                    {new Date(item.modifiedDt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAttachMedia(mediaId)}
                disabled={attachingMediaId === mediaId}
                className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {attachingMediaId === mediaId
                  ? "Adding..."
                  : "Add to Playlist"}
              </button>
            </div>
          );
        })}
      </div>
    );
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
            <button
              onClick={openAddMediaModal}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Media
            </button>
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

      {showAddMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Media to Playlist
                </h3>
                <p className="text-sm text-gray-500">
                  Choose from your media, the full library, or upload new media.
                </p>
              </div>
              <button
                onClick={closeAddMediaModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 border-b px-6 py-3">
              {[
                { key: "owned", label: "Your Media" },
                { key: "all", label: "All Library" },
                { key: "upload", label: "Upload" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleAddMediaTabChange(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    addMediaTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {addMediaTab !== "upload" && (
                <>
                  {mediaOptionsError && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <p>{mediaOptionsError}</p>
                      <button
                        onClick={() =>
                          fetchMediaOptions(
                            addMediaTab === "all" ? "all" : "owned"
                          )
                        }
                        className="mt-2 text-xs font-medium text-red-700 underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {mediaOptionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                        Loading media...
                      </div>
                    </div>
                  ) : addMediaTab === "owned" ? (
                    renderMediaSelectionGrid(ownedMediaOptions)
                  ) : (
                    renderMediaSelectionGrid(allMediaOptions)
                  )}
                </>
              )}

              {addMediaTab === "upload" && (
                <form className="space-y-4" onSubmit={handleUploadSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Media File <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={handleUploadFileChange}
                      className="block w-full text-sm text-gray-700"
                      disabled={uploading}
                      required
                    />
                    {uploadFile && (
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {uploadFile.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => {
                        setUploadName(e.target.value);
                        setUploadNameSuggestion(null);
                        setUploadError(null);
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Optional name"
                      disabled={uploading}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Folder
                      </label>
                      <select
                        value={uploadFolder}
                        onChange={(e) => setUploadFolder(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={uploading}
                      >
                        {folderOptions.length === 0 ? (
                          <option value="1">
                            {foldersLoading
                              ? "Loading folders..."
                              : "Root Folder"}
                          </option>
                        ) : (
                          folderOptions.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.path}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
                        onClick={fetchFolders}
                        disabled={foldersLoading || uploading}
                      >
                        {foldersLoading ? "Refreshing folders..." : "Refresh folders"}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={uploadDuration}
                        onChange={(e) => setUploadDuration(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={uploading}
                      />
                    </div>
                  </div>

                  {uploadProgress && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      {uploadProgress}
                    </div>
                  )}

                  {uploadError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {uploadError}
                    </div>
                  )}

                  {uploadNameSuggestion?.suggestedName && (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-800 space-y-2">
                      <p>
                        Suggested name:{" "}
                        <span className="font-semibold">
                          {uploadNameSuggestion.suggestedName}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadName(uploadNameSuggestion.suggestedName);
                          setUploadNameSuggestion(null);
                          setUploadError(null);
                        }}
                        className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
                      >
                        Use suggested name
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetUploadState}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                      disabled={uploading}
                    >
                      Reset
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70"
                      disabled={uploading || !uploadFile}
                    >
                      {uploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </form>
              )}
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
    </section>
  );
}
