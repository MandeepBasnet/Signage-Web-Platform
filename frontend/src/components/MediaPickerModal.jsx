/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentMediaId,
  filterTypes = ["image", "video"], // Default to image and video
}) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
      setSelectedMediaId(null);
      setSearchQuery("");
    }
  }, [isOpen]);

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
        throw new Error(`Failed to fetch media: ${response.status}`);
      }

      const data = await response.json();
      const allMedia = data?.data || [];

      // Filter media by type (image/video)
      const filteredMedia = allMedia.filter((item) => {
        const mediaType = (item.mediaType || item.type || "").toLowerCase();
        return filterTypes.some((type) => mediaType.includes(type));
      });

      setMedia(filteredMedia);
    } catch (err) {
      console.error("Error fetching media:", err);
      setError(err.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedMediaId && onSelect) {
      onSelect(selectedMediaId);
    }
  };

  const handleClose = () => {
    setSelectedMediaId(null);
    setSearchQuery("");
    onClose();
  };

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

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  // Filter media based on search query
  const filteredMedia = media.filter((item) => {
    if (!searchQuery) return true;
    const name = (item.name || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-lg bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Select Media to Replace
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Choose a new image or video from your library
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search media by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-gray-400">Loading media...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-red-400 mb-4">⚠️ {error}</p>
                <button
                  onClick={fetchMedia}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                {searchQuery
                  ? "No media found matching your search"
                  : "No media files found"}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery
                  ? "Try a different search term"
                  : "Upload media files to see them here"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredMedia.map((item) => {
                const mediaId = getMediaId(item);
                const mediaType = item.mediaType || item.type || "";
                const isImageType = isImage(mediaType);
                const isVideoType = isVideo(mediaType);
                const isSelected = selectedMediaId === mediaId;
                const isCurrent = currentMediaId === mediaId;
                const token = localStorage.getItem("auth_token");
                const thumbnailUrl = `${API_BASE_URL}/library/${mediaId}/thumbnail?preview=1&width=300&height=200&token=${token}`;

                return (
                  <div
                    key={mediaId}
                    onClick={() => setSelectedMediaId(mediaId)}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : isCurrent
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gray-800 rounded-t-lg overflow-hidden">
                      {isImageType && (
                        <img
                          src={thumbnailUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      )}
                      {isVideoType && (
                        <div className="w-full h-full flex items-center justify-center">
                          <img
                            src={thumbnailUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                          <div className="hidden w-full h-full flex items-center justify-center text-gray-500 text-4xl">
                            🎬
                          </div>
                        </div>
                      )}
                      {/* Fallback */}
                      <div className="hidden w-full h-full flex items-center justify-center text-gray-500 text-4xl">
                        {isVideoType ? "🎬" : "🖼️"}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <p
                        className="text-sm text-white truncate font-medium"
                        title={item.name}
                      >
                        {item.name || "Unnamed Media"}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-400 capitalize">
                          {mediaType}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(item.fileSize)}
                        </p>
                      </div>
                    </div>

                    {/* Current Badge */}
                    {isCurrent && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
                        Current
                      </div>
                    )}

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full p-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-700 px-6 py-4">
          <div className="text-sm text-gray-400">
            {filteredMedia.length} media file{filteredMedia.length !== 1 ? "s" : ""}{" "}
            {searchQuery && "found"}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedMediaId}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                selectedMediaId
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
