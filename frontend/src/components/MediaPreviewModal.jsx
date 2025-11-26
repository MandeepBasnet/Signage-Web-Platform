"use client";

import { useEffect } from "react";

export default function MediaPreviewModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  mediaName,
}) {
  if (!isOpen) return null;

  const isImage = (type) => {
    const t = type?.toLowerCase() || "";
    return (
      t.includes("image") ||
      t.includes("jpg") ||
      t.includes("jpeg") ||
      t.includes("png") ||
      t.includes("gif") ||
      t.includes("webp") ||
      t.includes("svg")
    );
  };

  const isVideo = (type) => {
    const t = type?.toLowerCase() || "";
    return (
      t.includes("video") ||
      t.includes("mp4") ||
      t.includes("webm") ||
      t.includes("ogg") ||
      t.includes("mov") ||
      t.includes("avi")
    );
  };

  const isAudio = (type) => {
    const t = type?.toLowerCase() || "";
    return (
      t.includes("audio") ||
      t.includes("mp3") ||
      t.includes("wav") ||
      t.includes("ogg") ||
      t.includes("m4a")
    );
  };

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[110]"
        aria-label="Close preview"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-8 h-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {isImage(mediaType) && (
          <div className="ekko-lightbox-item fade in show w-full h-full flex items-center justify-center">
            <img
              src={mediaUrl}
              alt={mediaName || "Media Preview"}
              className="img-fluid object-contain max-h-full max-w-full"
              style={{ width: "auto", height: "auto", maxHeight: "100vh", maxWidth: "100vw" }}
            />
          </div>
        )}

        {isVideo(mediaType) && (
          <div className="ekko-lightbox-item fade in show w-full h-full flex items-center justify-center">
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="img-fluid object-contain max-h-full max-w-full"
              style={{ width: "auto", height: "auto", maxHeight: "100vh", maxWidth: "100vw" }}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {isAudio(mediaType) && (
          <div className="ekko-lightbox-item fade in show w-full h-full flex flex-col items-center justify-center text-white">
            <div className="mb-8 p-8 bg-gray-800 rounded-full">
              <span className="text-6xl">🎵</span>
            </div>
            <h3 className="text-xl mb-4 font-semibold">{mediaName}</h3>
            <audio
              src={mediaUrl}
              controls
              autoPlay
              className="w-full max-w-md"
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        )}

        {!isImage(mediaType) && !isVideo(mediaType) && !isAudio(mediaType) && (
          <div className="text-white text-center">
            <p className="text-xl mb-4">Preview not available for this file type.</p>
            <a
              href={mediaUrl}
              download
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
