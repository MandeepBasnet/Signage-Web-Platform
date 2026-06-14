/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

import { API_BASE_URL } from "../config/api.js";
import {
  isImage,
  isVideo,
  isAudio,
  getMediaIcon,
  formatFileSize,
} from "../utils/mediaTypes.js";
import { flattenFolders } from "../utils/folderUtils.js";
import SearchBar from "./SearchBar.jsx";
import MediaPreviewModal from "./MediaPreviewModal";
import UploadMediaModal from "./UploadMediaModal.jsx";

export default function MediaContent() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaUrls, setMediaUrls] = useState(new Map());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [folderOptions, setFolderOptions] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [nameChangeNotice, setNameChangeNotice] = useState(null);
  const [deleteHoveredMediaId, setDeleteHoveredMediaId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef(0);
  // Selected library folder (per-user library). null = not resolved yet.
  const [libraryFolder, setLibraryFolder] = useState(null);
  const ITEMS_PER_PAGE = 8;

  // Preview state
  const [previewMedia, setPreviewMedia] = useState(null);

  // Helper functions
  const getMediaId = (item) => {
    return item.mediaId || item.media_id || item.id;
  };

  const handlePreview = (item) => {
    const mediaId = getMediaId(item);
    const token = localStorage.getItem("auth_token");
    const previewUrl = `${API_BASE_URL}/library/${mediaId}/download?preview=1&token=${token}`;

    setPreviewMedia({
      ...item,
      previewUrl,
    });
  };

  // On mount: load the folder list, which also resolves the user's home folder
  // and sets the default library view (see fetchFolders).
  useEffect(() => {
    fetchFolders();

    // Cleanup: revoke object URLs when component unmounts
    return () => {
      mediaUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the current page whenever folder, page, debounced search, or an
  // explicit refresh changes.
  useEffect(() => {
    if (libraryFolder !== null) fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryFolder, currentPage, debouncedSearch, refreshKey]);

  // Debounce the search box — searching is done server-side.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A new search or folder selection starts back at the first page.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, libraryFolder]);

  const fetchMedia = async (
    folderId = libraryFolder,
    pageArg = currentPage,
    searchArg = debouncedSearch
  ) => {
    const reqId = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        start: String((pageArg - 1) * ITEMS_PER_PAGE),
        length: String(ITEMS_PER_PAGE),
      });
      if (folderId && folderId !== "all") params.append("folderId", folderId);
      if (searchArg) params.append("search", searchArg);

      const response = await fetch(
        `${API_BASE_URL}/library?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch media: ${response.status}`
        );
      }

      const data = await response.json();
      if (reqId !== requestRef.current) return; // superseded by a newer request
      const mediaItems = data?.data || [];
      setMedia(mediaItems);
      setTotal(Number(data?.total) || 0);

      // Pre-fetch media URLs for images/videos/audio
      const urlMap = new Map();

      for (const item of mediaItems) {
        const mediaId = getMediaId(item);
        if (mediaId) {
          const mediaType = item.mediaType || item.type || "";
          const isImageType = isImage(mediaType);
          const isVideoType = isVideo(mediaType);
          const isAudioType = isAudio(mediaType);

          // Use the new thumbnail endpoint for previews
          if (isImageType || isVideoType) {
            // For images and videos, use the thumbnail endpoint with query param token
            // This allows the browser to handle caching and parallel loading
            const token = localStorage.getItem("auth_token"); // Correct key from auth.js
            urlMap.set(
              mediaId,
              `${API_BASE_URL}/library/${mediaId}/thumbnail?preview=1&width=300&height=200&token=${token}`
            );
          } else if (isAudioType) {
            // For audio, we might still want the download URL or a specific icon
            // Keeping download URL for audio for now if it's used for playback
            // But for previewing in a grid, we usually just show an icon.
            // If there's a waveform thumbnail, we could use that.
            // For now, let's stick to the pattern but maybe just use the icon logic in render.
          }
        }
      }

      setMediaUrls(urlMap);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      console.error("Error fetching media:", err);
      setError(err.message || "Failed to load media");
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  };

  // Reload from the first page (after upload/delete or an explicit refresh).
  const reloadMedia = () => {
    setCurrentPage(1);
    setRefreshKey((k) => k + 1);
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
      const flat = flattenFolders(data?.folders || []);
      setFolderOptions(flat);
      // Default the library view to the user's home folder; treat root ("1") as
      // "All folders". Only set if not already chosen (don't override the user).
      const home =
        data?.homeFolderId != null ? String(data.homeFolderId) : null;
      setLibraryFolder((prev) =>
        prev ?? (home && home !== "1" ? home : "all")
      );
    } catch (err) {
      console.error("Error fetching folders:", err);
      // Don't block the library if folders fail — show everything.
      setLibraryFolder((prev) => prev ?? "all");
    } finally {
      setFoldersLoading(false);
    }
  };

  const openUploadModal = () => {
    setIsUploadOpen(true);
    if (!folderOptions.length) {
      fetchFolders();
    }
  };

  // After a successful upload: surface any name-change notice and reload.
  const handleUploaded = (nameInfo) => {
    if (nameInfo?.wasChanged) {
      setNameChangeNotice({
        entity: "media",
        originalName: nameInfo.originalName,
        finalName: nameInfo.finalName,
        changeReason:
          nameInfo.changeReason ||
          "The media name was adjusted to keep it unique.",
      });
    }
    reloadMedia();
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!mediaId) return;

    if (!confirm("Are you sure you want to delete this media?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/library/${mediaId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.status === 409) {
        const data = await response.json();
        alert(
          `Cannot delete media:\n\n${data.message}\n\nDetails: ${
            data.details || "It is currently assigned to a playlist or layout."
          }`
        );
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message || `Failed to delete media: ${response.status}`
        );
      }

      // Refresh media list
      reloadMedia();
    } catch (err) {
      console.error("Error deleting media:", err);
      alert(`Failed to delete media: ${err.message}`);
    }
  };

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    // Use blob URL if available, otherwise use direct download URL
    return (
      mediaUrls.get(mediaId) || `${API_BASE_URL}/library/${mediaId}/download`
    );
  };

  // Only take over the whole panel on the first load; paging/searching keeps the
  // existing rows visible until the next page arrives (no spinner flash).
  if (loading && media.length === 0) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-600">Loading media...</p>
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
            onClick={reloadMedia}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // Pagination + search are server-side: `media` is the current page and
  // `total` is the server's (filtered) total.
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  return (
    <section className="flex flex-col gap-5 relative p-4">
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Media Library
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {total} {total === 1 ? "file" : "files"}
              {debouncedSearch ? " found" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={libraryFolder ?? "all"}
              onChange={(e) => setLibraryFolder(e.target.value)}
              className="px-2 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              title="Filter library by folder"
            >
              <option value="all">All folders</option>
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path || f.label}
                </option>
              ))}
            </select>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search media…"
              className="w-56 pl-3 pr-8 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClear={() => setSearch("")}
            />
            <button
              onClick={openUploadModal}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Media
            </button>
            <button
              onClick={reloadMedia}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {media.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {debouncedSearch
                ? "No media matches your search"
                : "No media files found"}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {debouncedSearch
                ? "Try a different name or clear the search."
                : "Your media files will appear here once they are uploaded."}
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
                    Size
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Modified Date
                  </th>
                  <th scope="col" className="relative px-6 py-3 w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {media.map((item) => {
                  const mediaId = getMediaId(item);
                  const mediaUrl = getMediaUrl(item);
                  const mediaType = item.mediaType || item.type || "";
                  const isImageType = isImage(mediaType);
                  const isVideoType = isVideo(mediaType);
                  const isAudioType = isAudio(mediaType);

                  const isDeleteHovered = deleteHoveredMediaId === mediaId;

                  return (
                    <tr
                      key={mediaId}
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
                                  alt={item.name}
                                  loading="lazy"
                                  decoding="async"
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
                                  preload="none"
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                    e.target.nextSibling.style.display = "flex";
                                  }}
                                />
                              )}
                              {!isImageType && !isVideoType && (
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
                          {formatFileSize(item.fileSize)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {item.modifiedDt
                            ? new Date(item.modifiedDt).toLocaleDateString()
                            : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {mediaId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMedia(mediaId);
                            }}
                            onMouseEnter={() =>
                              setDeleteHoveredMediaId(mediaId)
                            }
                            onMouseLeave={() => setDeleteHoveredMediaId(null)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete media"
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

        {total > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage >= totalPages}
                className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isUploadOpen && (
        <UploadMediaModal
          onClose={() => setIsUploadOpen(false)}
          folderOptions={folderOptions}
          foldersLoading={foldersLoading}
          onRefreshFolders={fetchFolders}
          onUploaded={handleUploaded}
        />
      )}

      {nameChangeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {nameChangeNotice.entity === "media"
                ? "Media Name Updated"
                : "Name Updated"}
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
        mediaName={previewMedia?.name || previewMedia?.mediaName}
      />
    </section>
  );
}
