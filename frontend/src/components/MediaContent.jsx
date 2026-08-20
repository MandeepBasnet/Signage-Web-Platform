/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "../utils/auth.js";

import { API_BASE_URL } from "../config/api.js";
import {
  isImage,
  isVideo,
  isAudio,
  formatFileSize,
} from "../utils/mediaTypes.js";
import SearchBar from "./SearchBar.jsx";
import MediaPreviewModal from "./MediaPreviewModal";
import MediaThumbnail from "./MediaThumbnail.jsx";
import { AlertTriangle, FolderOpen, SearchX } from "lucide-react";
import UploadMediaModal from "./UploadMediaModal.jsx";
import { useFolders } from "../hooks/queries/useFolders.js";
import { useMedia, ITEMS_PER_PAGE } from "../hooks/queries/useMedia.js";
import { useToast } from "../hooks/useToast.js";
import { useConfirm } from "../hooks/useConfirm.js";
import EmptyState from "./ui/EmptyState.jsx";
import InfoHint from "./ui/InfoHint.jsx";

const EMPTY_ARRAY = [];

export default function MediaContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [nameChangeNotice, setNameChangeNotice] = useState(null);
  const [deleteHoveredMediaId, setDeleteHoveredMediaId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Selected library folder (per-user library). null = not resolved yet.
  const [libraryFolder, setLibraryFolder] = useState(null);

  // Preview state
  const [previewMedia, setPreviewMedia] = useState(null);

  // Folder list + home folder (cached); resolves the default folder view below.
  const {
    data: foldersData,
    isFetching: foldersLoading,
    isError: foldersError,
    refetch: refetchFolders,
  } = useFolders();
  const folderOptions = foldersData?.folders ?? EMPTY_ARRAY;

  // Cached, server-paginated media for the selected folder/search. Gated until
  // the default folder is resolved (libraryFolder !== null).
  const {
    data: mediaData,
    isLoading: loading,
    error,
  } = useMedia(
    { folder: libraryFolder, page: currentPage, search: debouncedSearch },
    { enabled: libraryFolder !== null }
  );
  const media = mediaData?.media ?? EMPTY_ARRAY;
  const total = mediaData?.total ?? 0;

  // Helper functions
  const getMediaId = (item) => {
    return item.mediaId || item.media_id || item.id;
  };

  const handlePreview = (item) => {
    // Use the backend-signed download URL (no token in the URL).
    const previewUrl = item.downloadUrl
      ? `${API_BASE_URL}${item.downloadUrl}`
      : null;

    setPreviewMedia({
      ...item,
      previewUrl,
    });
  };

  // Thumbnail URLs for the current page's images/videos, from the backend-signed
  // `thumbnailUrl` on each item (no token in the URL).
  const mediaUrls = useMemo(() => {
    const map = new Map();
    for (const item of media) {
      const mediaId = item.mediaId || item.media_id || item.id;
      if (!mediaId || !item.thumbnailUrl) continue;
      const mediaType = item.mediaType || item.type || "";
      if (isImage(mediaType) || isVideo(mediaType)) {
        map.set(mediaId, `${API_BASE_URL}${item.thumbnailUrl}`);
      }
    }
    return map;
  }, [media]);

  // Resolve the default folder once folders load (or fall back to "all" on
  // error). Treat root ("1") as "All folders". Don't override a user choice.
  useEffect(() => {
    if (libraryFolder !== null) return;
    if (foldersData) {
      const home =
        foldersData.homeFolderId != null
          ? String(foldersData.homeFolderId)
          : null;
      setLibraryFolder(home && home !== "1" ? home : "all");
    } else if (foldersError) {
      setLibraryFolder("all");
    }
  }, [foldersData, foldersError, libraryFolder]);

  // Debounce the search box — searching is done server-side.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A new search or folder selection starts back at the first page.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, libraryFolder]);

  // Reload from the first page after upload/delete or an explicit refresh:
  // invalidate the cached media pages so they refetch.
  const reloadMedia = () => {
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: ["media"] });
  };

  const openUploadModal = () => {
    setIsUploadOpen(true);
    if (!folderOptions.length) {
      refetchFolders();
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

    const ok = await confirmDialog({
      title: "Delete this media?",
      body: "It will be removed from the library permanently. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`${API_BASE_URL}/library/${mediaId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (response.status === 409) {
        const data = await response.json();
        // 409 is not a failure — it's the server telling the user why this
        // can't happen yet, which is the most useful thing on screen.
        toast.error(
          data.message || "This media is still in use",
          data.details || "It is currently assigned to a playlist or layout."
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
      toast.error("Couldn't delete the media", err.message);
    }
  };

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    // Signed thumbnail if present, else the backend-signed download URL.
    return (
      mediaUrls.get(mediaId) ||
      (item.downloadUrl ? `${API_BASE_URL}${item.downloadUrl}` : null)
    );
  };

  // Only take over the whole panel on the first load; paging/searching keeps the
  // existing rows visible until the next page arrives (no spinner flash). Treat
  // the pre-resolution window (default folder not picked yet) as loading too.
  if ((loading || libraryFolder === null) && media.length === 0) {
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
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-red-700">{error?.message || "Failed to load media"}</p>
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
            <InfoHint label="About folders">
              You only see media in folders you have access to. If something is
              missing, ask an admin to share its folder with you.
            </InfoHint>
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
          debouncedSearch ? (
            <EmptyState
              icon={SearchX}
              title={`No media matches “${debouncedSearch}”`}
              body="Try a different name, or clear the search to see everything in this folder."
              action={{ label: "Clear search", onClick: () => setSearch("") }}
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="Nothing in this folder yet"
              body="Upload images and video here, then add them to a playlist or drop them straight onto a layout."
              action={{ label: "Add media", onClick: openUploadModal }}
            />
          )
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
                          className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100 cursor-pointer flex items-center justify-center"
                          onClick={() => handlePreview(item)}
                        >
                          <MediaThumbnail
                            url={mediaUrl}
                            type={mediaType}
                            name={item.name}
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
          onRefreshFolders={refetchFolders}
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
