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

export default function MediaContent() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaUrls, setMediaUrls] = useState(new Map());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("1");
  const [uploadDuration, setUploadDuration] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [folderOptions, setFolderOptions] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [nameSuggestion, setNameSuggestion] = useState(null);

  // Helper functions
  const getMediaId = (item) => {
    return item.mediaId || item.media_id || item.id;
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

  useEffect(() => {
    fetchMedia();

    // Cleanup: revoke object URLs when component unmounts
    return () => {
      mediaUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/library`, {
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
      setMedia(data?.data || []);

      // Pre-fetch media URLs for images/videos/audio
      const mediaItems = data?.data || [];
      const urlMap = new Map();

      for (const item of mediaItems) {
        const mediaId = getMediaId(item);
        if (mediaId) {
          const mediaType = item.mediaType || item.type || "";
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
    } catch (err) {
      console.error("Error fetching media:", err);
      setError(err.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  const flattenFolders = (nodes = [], parentPath = []) => {
    const list = [];
    nodes.forEach((node) => {
      if (!node) return;
      const folderId = node.folderId || node.id;
      const label =
        node.folderName || node.text || node.name || `Folder ${folderId || ""}`;
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

  const openUploadModal = () => {
    setUploadError(null);
    setUploadProgress(null);
    setIsUploadOpen(true);
    if (!folderOptions.length) {
      fetchFolders();
    }
  };

  const closeUploadModal = () => {
    setIsUploadOpen(false);
    setUploadFile(null);
    setUploadName("");
    setUploadDuration(10);
    setUploadError(null);
    setUploadProgress(null);
    setNameSuggestion(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name);
      }
      setUploadError(null);
      setNameSuggestion(null);
    }
  };

  const validateMediaNameAvailability = async (nameToValidate) => {
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
        setNameSuggestion(errorData?.nameInfo || null);
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to validate media name: ${response.status}`
        );
      }

      setNameSuggestion(null);
      return true;
    } catch (err) {
      console.error("Error validating media name:", err);
      setUploadError(err.message || "Failed to validate media name");
      setNameSuggestion(null);
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
      const nameIsValid = await validateMediaNameAvailability(derivedName);
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

      console.log("Uploading file:", {
        name: uploadFile.name,
        type: uploadFile.type,
        size: uploadFile.size,
        folder: uploadFolder,
        duration: uploadDuration,
        targetName: derivedName,
      });

      setUploadProgress("Uploading to server...");

      const response = await fetch(`${API_BASE_URL}/library/upload`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const result = await response.json();
      console.log("Upload response:", result);

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Upload failed: ${response.status}`
        );
      }

      setUploadProgress("Upload successful!");

      // Show name change notification if applicable
      if (result.nameInfo?.wasChanged) {
        alert(
          `⚠️ Duplicate Name Detected\n\n` +
            `Your requested name: "${result.nameInfo.originalName}"\n\n` +
            `Already exists in your library.\n\n` +
            `File has been saved as: "${result.nameInfo.finalName}"`
        );
      }

      // Wait a moment to show success message
      setTimeout(() => {
        closeUploadModal();
        fetchMedia();
      }, 1000);
    } catch (err) {
      console.error("Error uploading media:", err);
      setUploadError(err.message || "Failed to upload media");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
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

  const getMediaUrl = (item) => {
    const mediaId = getMediaId(item);
    if (!mediaId) return null;
    // Use blob URL if available, otherwise use direct download URL
    return (
      mediaUrls.get(mediaId) || `${API_BASE_URL}/library/${mediaId}/download`
    );
  };

  if (loading) {
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
            onClick={fetchMedia}
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
            <h2 className="text-2xl font-semibold text-gray-900">
              Media Library
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {media.length} {media.length === 1 ? "file" : "files"} found
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openUploadModal}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Media
            </button>
            <button
              onClick={fetchMedia}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {media.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No media files found</p>
            <p className="text-gray-400 text-sm mt-2">
              Your media files will appear here once they are uploaded.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {media.map((item) => {
              const mediaId = getMediaId(item);
              const mediaUrl = getMediaUrl(item);
              const mediaType = item.mediaType || item.type || "";
              const isImageType = isImage(mediaType);
              const isVideoType = isVideo(mediaType);
              const isAudioType = isAudio(mediaType);

              return (
                <div
                  key={mediaId}
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
                      {item.mediaType && (
                        <span className="capitalize">
                          Type: {item.mediaType}
                        </span>
                      )}
                      {item.fileSize && (
                        <span>Size: {formatFileSize(item.fileSize)}</span>
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

      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Upload Media
                </h3>
                <p className="text-sm text-gray-500">
                  Select a file and destination folder
                </p>
              </div>
              <button
                onClick={closeUploadModal}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close upload modal"
                disabled={uploading}
              >
                ✕
              </button>
            </div>

            <form className="px-6 py-4 space-y-4" onSubmit={handleUploadSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Media File *
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
                    Selected: {uploadFile.name} (
                    {formatFileSize(uploadFile.size)})
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
                    setNameSuggestion(null);
                    setUploadError(null);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Optional name"
                  disabled={uploading}
                />
              </div>

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
                      {foldersLoading ? "Loading folders..." : "Root Folder"}
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

              {nameSuggestion?.suggestedName && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-800 space-y-2">
                  <p>
                    Suggested name:{" "}
                    <span className="font-semibold">
                      {nameSuggestion.suggestedName}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadName(nameSuggestion.suggestedName);
                      setNameSuggestion(null);
                      setUploadError(null);
                    }}
                    className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
                  >
                    Use suggested name
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                  disabled={uploading}
                >
                  Cancel
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
          </div>
        </div>
      )}
    </section>
  );
}
