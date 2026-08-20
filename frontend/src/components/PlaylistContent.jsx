/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";
import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
import MediaPreviewModal from "./MediaPreviewModal";
import MediaThumbnail from "./MediaThumbnail.jsx";
import { AlertTriangle, ArrowLeft, ListVideo, SearchX } from "lucide-react";

import { API_BASE_URL } from "../config/api.js";
import { isImage, isVideo, formatFileSize } from "../utils/mediaTypes.js";
import SearchBar from "./SearchBar.jsx";
import {
  getMediaId,
  getWidgetId,
  normalizeMediaItems,
} from "../utils/playlistItems.js";
import { usePlaylists, PAGE_SIZE } from "../hooks/queries/usePlaylists.js";
import { usePlaylistDetails } from "../hooks/queries/usePlaylistDetails.js";
import { useToast } from "../hooks/useToast.js";
import { useConfirm } from "../hooks/useConfirm.js";
import EmptyState from "./ui/EmptyState.jsx";

const EMPTY_ARRAY = [];
const MEDIA_PAGE_SIZE = 10;

export default function PlaylistContent() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [search, setSearch] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
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
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [selectedWidgetForExpiry, setSelectedWidgetForExpiry] = useState(null);
  const [expiryFromDate, setExpiryFromDate] = useState("");
  const [expiryToDate, setExpiryToDate] = useState("");
  const [deleteOnExpiry, setDeleteOnExpiry] = useState(false);
  const [updatingExpiry, setUpdatingExpiry] = useState(false);

  // Server-paginated, searchable playlists. keepPreviousData holds the current
  // page on screen while the next page/search loads.
  const [page, setPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const {
    data: playlistsData,
    isLoading: loading,
    error,
    refetch: refetchPlaylists,
  } = usePlaylists({ page, search: debouncedSearch });
  const playlists = playlistsData?.playlists ?? EMPTY_ARRAY;
  const total = playlistsData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce the search box; searching is done server-side.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A new search starts back at the first page.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  // Detail (playlist + media) for the open playlist; enabled only when one is
  // selected, cached per id. isFetching drives the loading overlay/spinner.
  const {
    data: detailData,
    isFetching: playlistLoading,
    error: playlistError,
    refetch: refetchDetails,
  } = usePlaylistDetails(selectedPlaylistId);
  const selectedPlaylist = detailData?.playlist ?? null;
  const playlistMedia = useMemo(
    () =>
      detailData
        ? normalizeMediaItems(detailData.playlist, detailData.media || [])
        : EMPTY_ARRAY,
    [detailData]
  );
  const mediaUrls = useMemo(() => {
    const map = new Map();
    for (const item of playlistMedia) {
      const mediaId = getMediaId(item);
      if (!mediaId || !item.thumbnailUrl) continue;
      const mediaType =
        item.mediaType || item.type || item.widgetType || item.moduleName || "";
      if (isImage(mediaType) || isVideo(mediaType)) {
        map.set(mediaId, `${API_BASE_URL}${item.thumbnailUrl}`);
      }
    }
    return map;
  }, [playlistMedia]);

  // Client-side pagination of the media within the open playlist (the detail
  // endpoint returns the full list). Reset to the first page when a different
  // playlist is opened or the item count shrinks below the current page.
  const [mediaPage, setMediaPage] = useState(0);
  useEffect(() => {
    setMediaPage(0);
  }, [selectedPlaylistId]);
  const mediaPageCount = Math.max(
    1,
    Math.ceil(playlistMedia.length / MEDIA_PAGE_SIZE)
  );
  const safeMediaPage = Math.min(mediaPage, mediaPageCount - 1);
  const pagedMedia = playlistMedia.slice(
    safeMediaPage * MEDIA_PAGE_SIZE,
    (safeMediaPage + 1) * MEDIA_PAGE_SIZE
  );

  // Helper functions
  const handlePreview = (item) => {
    // Backend-signed download URL (no token in the URL).
    const previewUrl = item.downloadUrl
      ? `${API_BASE_URL}${item.downloadUrl}`
      : null;

    setPreviewMedia({
      ...item,
      previewUrl,
    });
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
      setSelectedPlaylistId(String(playlistId));
    } else {
      console.error("No playlist ID found in playlist object:", playlist);
    }
  };

  const handleBackClick = () => {
    setSelectedPlaylistId(null);
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
      refetchPlaylists();
    } catch (err) {
      console.error("Error creating playlist:", err);
      setCreateError(err.message || "Failed to create playlist");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMedia = async (widgetId) => {
    const ok = await confirmDialog({
      title: "Remove this media from the playlist?",
      body: "The file stays in your library — it just stops playing in this playlist.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

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
      refetchDetails();
    } catch (err) {
      console.error("Error deleting media:", err);
      toast.error("Couldn't remove the media", err.message);
    }
  };

  const handleOpenExpiryModal = (item) => {
    const widgetId = getWidgetId(item);
    if (!widgetId) return;

    setSelectedWidgetForExpiry(item);
    // Initialize with existing values if available (assuming they might be in item properties)
    // Note: The API response might not include these by default unless we specifically ask for them
    // or if they are part of the widget object.
    // For now, we'll start empty or try to read from item.
    setExpiryFromDate(item.fromDt || "");
    setExpiryToDate(item.toDt || "");
    setDeleteOnExpiry(
      item.deleteOnExpiry === 1 || item.deleteOnExpiry === true
    );
    setExpiryModalOpen(true);
  };

  const handleUpdateExpiry = async (e) => {
    e.preventDefault();
    if (!selectedWidgetForExpiry) return;

    const widgetId = getWidgetId(selectedWidgetForExpiry);
    const playlistId =
      selectedPlaylist.playlistId ||
      selectedPlaylist.playlist_id ||
      selectedPlaylist.id ||
      selectedPlaylist.ID ||
      selectedPlaylist.PlaylistId;

    try {
      setUpdatingExpiry(true);
      const response = await fetch(
        `${API_BASE_URL}/playlists/${playlistId}/media/${widgetId}/expiry`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            fromDt: expiryFromDate,
            toDt: expiryToDate,
            deleteOnExpiry: deleteOnExpiry,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update expiry");
      }

      // Success
      setExpiryModalOpen(false);
      // Refresh playlist to show updated data (if we display it)
      refetchDetails();
      toast.success("Expiry updated");
    } catch (err) {
      console.error("Error updating expiry:", err);
      toast.error("Couldn't update the expiry", err.message);
    } finally {
      setUpdatingExpiry(false);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    const ok = await confirmDialog({
      title: "Delete this playlist?",
      body: "Any screen scheduled to play it will stop. The media inside stays in your library.",
      confirmLabel: "Delete playlist",
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.status === 409) {
        const data = await response.json();
        // 409 means the playlist is still referenced — tell the user why
        // rather than reporting a failure they can't act on.
        toast.error(
          data.message || "This playlist is still in use",
          data.details || "It is currently used by a layout or a schedule."
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
      refetchPlaylists();
    } catch (err) {
      console.error("Error deleting playlist:", err);
      toast.error("Couldn't delete the playlist", err.message);
    }
  };

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    return (
      mediaUrls.get(mediaId) ||
      (item.downloadUrl ? `${API_BASE_URL}${item.downloadUrl}` : null)
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Playlists
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
                  refetchDetails();
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
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                  <p className="text-red-700">{playlistError?.message || "Failed to load playlist details"}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const playlistId =
                    selectedPlaylist.playlistId ||
                    selectedPlaylist.playlist_id ||
                    selectedPlaylist.id;
                  if (playlistId) refetchDetails();
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
                    <th scope="col" className="relative px-6 py-3 w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagedMedia.map((item) => {
                    const mediaId = getMediaId(item);
                    const widgetId = getWidgetId(item);
                    const mediaUrl = getMediaUrl(item);
                    const mediaType =
                      item.mediaType ||
                      item.type ||
                      item.widgetType ||
                      item.moduleName ||
                      "";
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
                            className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100 cursor-pointer flex items-center justify-center"
                            onClick={() => handlePreview(item)}
                          >
                            <MediaThumbnail
                              url={mediaUrl}
                              type={mediaType}
                              name={
                                item.name ||
                                item.fileName ||
                                item.mediaName ||
                                "Media"
                              }
                              iconClassName="w-6 h-6"
                            />
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
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenExpiryModal(item);
                                }}
                                className="text-gray-400 hover:text-blue-600 transition-colors mr-2"
                                title="Schedule Expiration"
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
                                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMedia(widgetId);
                                }}
                                onMouseEnter={() =>
                                  setDeleteHoveredWidgetId(widgetId)
                                }
                                onMouseLeave={() =>
                                  setDeleteHoveredWidgetId(null)
                                }
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
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {mediaPageCount > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-600 px-4 py-3 border-t border-gray-200">
                  <span>
                    Showing {safeMediaPage * MEDIA_PAGE_SIZE + 1}–
                    {Math.min(
                      (safeMediaPage + 1) * MEDIA_PAGE_SIZE,
                      playlistMedia.length
                    )}{" "}
                    of {playlistMedia.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMediaPage((p) => Math.max(0, p - 1))}
                      disabled={safeMediaPage === 0}
                      className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-2">
                      {safeMediaPage + 1} / {mediaPageCount}
                    </span>
                    <button
                      onClick={() =>
                        setMediaPage((p) =>
                          Math.min(mediaPageCount - 1, p + 1)
                        )
                      }
                      disabled={safeMediaPage >= mediaPageCount - 1}
                      className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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

        {/* Expiry Modal */}
        {expiryModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => setExpiryModalOpen(false)}
              ></div>

              <span
                className="hidden sm:inline-block sm:align-middle sm:h-screen"
                aria-hidden="true"
              >
                &#8203;
              </span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handleUpdateExpiry}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Schedule Media Expiration
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500 mb-4">
                            Set the start and end dates for this media item in
                            the playlist.
                          </p>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                From Date
                              </label>
                              <input
                                type="datetime-local"
                                value={expiryFromDate}
                                onChange={(e) =>
                                  setExpiryFromDate(e.target.value)
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                To Date
                              </label>
                              <input
                                type="datetime-local"
                                value={expiryToDate}
                                onChange={(e) =>
                                  setExpiryToDate(e.target.value)
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                              />
                            </div>

                            <div className="flex items-center">
                              <input
                                id="deleteOnExpiry"
                                type="checkbox"
                                checked={deleteOnExpiry}
                                onChange={(e) =>
                                  setDeleteOnExpiry(e.target.checked)
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor="deleteOnExpiry"
                                className="ml-2 block text-sm text-gray-900"
                              >
                                Delete from playlist on expiry
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={updatingExpiry}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {updatingExpiry ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => setExpiryModalOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (loading && playlists.length === 0) {
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
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-red-700">{error?.message || "Failed to load playlists"}</p>
            </div>
          </div>
          <button
            onClick={() => refetchPlaylists()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // Searching + pagination are server-side: `playlists` is the current page and
  // `total` is the server's (filtered) total.
  const q = debouncedSearch;

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
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Playlists</h2>
            <p className="text-sm text-gray-500 mt-1">
              {total} {total === 1 ? "playlist" : "playlists"}
              {q ? " found" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search playlists…"
              className="w-56 pl-3 pr-8 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClear={() => setSearch("")}
            />
            <button
              onClick={() => refetchPlaylists()}
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
          q ? (
            <EmptyState
              icon={SearchX}
              title={`No playlists match “${q}”`}
              body="Try a different name, or clear the search to see them all."
              action={{ label: "Clear search", onClick: () => setSearch("") }}
            />
          ) : (
            <EmptyState
              icon={ListVideo}
              title="No playlists yet"
              body="A playlist is a set of media that plays in order. Build one here, then schedule it onto a screen."
              action={{
                label: "Add playlist",
                onClick: () => setShowCreateModal(true),
              }}
            />
          )
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
                      <ListVideo className="w-6 h-6 text-blue-500 shrink-0" />
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

        {pageCount > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-600 mt-6 pt-4 border-t border-gray-100">
            <span>
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2">
                {page + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
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

      {/* Expiry Modal */}
      {expiryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setExpiryModalOpen(false)}
            ></div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateExpiry}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Schedule Media Expiration
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500 mb-4">
                          Set the start and end dates for this media item in the
                          playlist.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              From Date
                            </label>
                            <input
                              type="datetime-local"
                              value={expiryFromDate}
                              onChange={(e) =>
                                setExpiryFromDate(e.target.value)
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              To Date
                            </label>
                            <input
                              type="datetime-local"
                              value={expiryToDate}
                              onChange={(e) => setExpiryToDate(e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            />
                          </div>

                          <div className="flex items-center">
                            <input
                              id="deleteOnExpiry"
                              type="checkbox"
                              checked={deleteOnExpiry}
                              onChange={(e) =>
                                setDeleteOnExpiry(e.target.checked)
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                              htmlFor="deleteOnExpiry"
                              className="ml-2 block text-sm text-gray-900"
                            >
                              Delete from playlist on expiry
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={updatingExpiry}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {updatingExpiry ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setExpiryModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
