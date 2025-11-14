"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function MediaContent() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaUrls, setMediaUrls] = useState(new Map());

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
          <button
            onClick={fetchMedia}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
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
    </section>
  );
}
