"use client";

import { useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

/**
 * AddMediaPlaylistButton Component
 *
 * Handles the "Add Media to Playlist" functionality including:
 * - Modal dialog for media selection
 * - Three tabs: Your Media, All Library, and Upload
 * - Media upload with name validation
 * - Attaching media to playlists
 */
export default function AddMediaPlaylistButton({
  playlistId,
  onMediaAdded,
  onClose,
  isOpen,
}) {
  // Modal state
  const [showModal, setShowModal] = useState(isOpen ?? false);
  const [currentTab, setCurrentTab] = useState("owned");

  // Media listing state
  const [ownedMediaOptions, setOwnedMediaOptions] = useState([]);
  const [allMediaOptions, setAllMediaOptions] = useState([]);
  const [mediaOptionsLoading, setMediaOptionsLoading] = useState(false);
  const [mediaOptionsError, setMediaOptionsError] = useState(null);
  const [attachingMediaId, setAttachingMediaId] = useState(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("1");
  const [uploadDuration, setUploadDuration] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadNameSuggestion, setUploadNameSuggestion] = useState(null);

  // Folder state
  const [folderOptions, setFolderOptions] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

  /**
   * Fetch media options based on scope
   * XIBO API: GET /library or GET /library/all
   */
  const fetchMediaOptions = async (scope = "owned") => {
    try {
      setMediaOptionsLoading(true);
      setMediaOptionsError(null);

      const endpoint = scope === "all" ? "/library/all" : "/library";

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
          errorData?.message || `Failed to fetch media: ${response.status}`
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

  /**
   * Fetch folder hierarchy for media upload
   * XIBO API: GET /library/folders
   */
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

      // Helper to flatten folder tree structure
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

  /**
   * Open modal and initialize data
   */
  const openModal = () => {
    setShowModal(true);
    setCurrentTab("owned");
    setMediaOptionsError(null);
    fetchMediaOptions("owned");
    if (!folderOptions.length) {
      fetchFolders();
    }
  };

  /**
   * Close modal and reset state
   */
  const closeModal = () => {
    setShowModal(false);
    setCurrentTab("owned");
    setMediaOptionsError(null);
    setOwnedMediaOptions([]);
    setAllMediaOptions([]);
    setMediaOptionsLoading(false);
    setAttachingMediaId(null);
    resetUploadState();
    if (onClose) {
      onClose();
    }
  };

  /**
   * Reset upload form state
   */
  const resetUploadState = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadDuration(10);
    setUploadFolder("1");
    setUploadError(null);
    setUploadProgress(null);
    setUploadNameSuggestion(null);
  };

  /**
   * Handle tab change in modal
   */
  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setMediaOptionsError(null);
    if (tab === "owned") {
      fetchMediaOptions("owned");
    } else if (tab === "all") {
      fetchMediaOptions("all");
    }
  };

  /**
   * Attach selected media to playlist
   * XIBO API: POST /playlist/library/assign/{playlistId}
   */
  const handleAttachMedia = async (mediaId) => {
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
          errorData?.message || `Failed to add media: ${response.status}`
        );
      }

      await response.json();

      // Refresh media list and trigger callback
      fetchMediaOptions(currentTab === "all" ? "all" : "owned");
      if (onMediaAdded) {
        onMediaAdded(mediaId);
      }
    } catch (err) {
      console.error("Error adding media to playlist:", err);
      setMediaOptionsError(err.message || "Failed to add media to playlist");
    } finally {
      setAttachingMediaId(null);
    }
  };

  /**
   * Handle file selection for upload
   */
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name);
      }
    }
  };

  /**
   * Validate media name before upload
   * XIBO API: POST /library/validate-name
   */
  const validateUploadMediaName = async (nameToValidate) => {
    try {
      const response = await fetch(`${API_BASE_URL}/library/validate-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: nameToValidate }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle duplicate name error with suggestion
        if (response.status === 409 && errorData?.nameInfo?.suggestedName) {
          setUploadNameSuggestion({
            originalName: errorData.nameInfo.originalName,
            suggestedName: errorData.nameInfo.suggestedName,
            reason: errorData.nameInfo.changeReason,
          });
          throw new Error(
            `Name conflict: ${errorData.message || "Use suggested name"}`
          );
        }

        throw new Error(
          errorData?.message || `Validation failed: ${response.status}`
        );
      }

      const data = await response.json();
      if (data.nameInfo?.wasChanged) {
        setUploadNameSuggestion(data.nameInfo);
      }

      return true;
    } catch (err) {
      console.error("Error validating media name:", err);
      throw err;
    }
  };

  /**
   * Handle media upload
   * XIBO API: POST /library/upload
   */
  const handleUploadSubmit = async (event) => {
    event.preventDefault();

    if (!uploadFile || !uploadName.trim()) {
      setUploadError("Please select a file and enter a name");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress({ loaded: 0, total: uploadFile.size });

      // Validate name first
      await validateUploadMediaName(uploadName.trim());

      // Prepare upload form data
      const formData = new FormData();
      formData.append("media", uploadFile);
      formData.append("name", uploadName.trim());
      formData.append("folderId", uploadFolder);
      formData.append("duration", uploadDuration);

      // Upload media
      const uploadResponse = await fetch(`${API_BASE_URL}/library/upload`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Upload failed: ${uploadResponse.status}`
        );
      }

      const uploadedData = await uploadResponse.json();
      const uploadedMediaId = uploadedData?.data?.files?.[0]?.mediaId;

      if (uploadedMediaId) {
        // Auto-attach to playlist if upload succeeds
        await handleAttachMedia(uploadedMediaId);
        resetUploadState();
        setCurrentTab("owned");
        fetchMediaOptions("owned");
      }
    } catch (err) {
      console.error("Error uploading media:", err);
      setUploadError(err.message || "Failed to upload media");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  /**
   * Render media item in grid
   */
  const renderMediaItem = (item) => {
    const mediaId = item.mediaId || item.id;
    const isAttaching = attachingMediaId === mediaId;
    const name = item.name || item.fileName || `Media ${mediaId}`;

    return (
      <div
        key={mediaId}
        className="rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-sm text-gray-900 truncate">{name}</p>
          <button
            onClick={() => handleAttachMedia(mediaId)}
            disabled={isAttaching || uploading}
            className="ml-2 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isAttaching ? "Adding..." : "Add"}
          </button>
        </div>
        <p className="text-xs text-gray-500">ID: {mediaId}</p>
      </div>
    );
  };

  /**
   * Render media grid
   */
  const renderMediaGrid = (items = []) => {
    if (!items || items.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">No media found</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => renderMediaItem(item))}
      </div>
    );
  };

  return (
    <>
      {/* Button to open modal */}
      <button
        onClick={openModal}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        + Add Media
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl">
            {/* Header */}
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
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b px-6 py-3">
              {[
                { key: "owned", label: "Your Media" },
                { key: "all", label: "All Library" },
                { key: "upload", label: "Upload" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentTab === tab.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              {currentTab !== "upload" && (
                <>
                  {/* Error message */}
                  {mediaOptionsError && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <p>{mediaOptionsError}</p>
                      <button
                        onClick={() => fetchMediaOptions(currentTab)}
                        className="mt-2 text-xs font-medium text-red-700 underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Loading state */}
                  {mediaOptionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p>Loading media...</p>
                      </div>
                    </div>
                  ) : (
                    renderMediaGrid(
                      currentTab === "all" ? allMediaOptions : ownedMediaOptions
                    )
                  )}
                </>
              )}

              {/* Upload tab */}
              {currentTab === "upload" && (
                <form className="space-y-4" onSubmit={handleUploadSubmit}>
                  {uploadError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {uploadError}
                    </div>
                  )}

                  {uploadNameSuggestion && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      <p className="font-medium">
                        {uploadNameSuggestion.reason}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadName(uploadNameSuggestion.suggestedName);
                          setUploadNameSuggestion(null);
                        }}
                        className="mt-2 text-xs font-medium text-amber-700 underline"
                      >
                        Use suggested name: {uploadNameSuggestion.suggestedName}
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Media File <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={handleFileChange}
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
                            {foldersLoading ? "Loading folders..." : "Root"}
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
                        {foldersLoading ? "Refreshing..." : "Refresh folders"}
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
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Uploading...</span>
                        <span>
                          {Math.round(
                            (uploadProgress.loaded / uploadProgress.total) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              (uploadProgress.loaded / uploadProgress.total) *
                              100
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={!uploadFile || uploading}
                      className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {uploading ? "Uploading..." : "Upload & Add to Playlist"}
                    </button>
                    <button
                      type="button"
                      onClick={resetUploadState}
                      disabled={uploading}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
