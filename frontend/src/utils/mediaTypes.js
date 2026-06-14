// Shared media-type helpers used across the media/playlist UI.
// Type detection is substring-based against the Xibo mediaType/type string.

export function isImage(mediaType) {
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
}

export function isVideo(mediaType) {
  const type = mediaType?.toLowerCase() || "";
  return (
    type.includes("video") ||
    type.includes("mp4") ||
    type.includes("webm") ||
    type.includes("ogg") ||
    type.includes("mov") ||
    type.includes("avi")
  );
}

export function isAudio(mediaType) {
  const type = mediaType?.toLowerCase() || "";
  return (
    type.includes("audio") ||
    type.includes("mp3") ||
    type.includes("wav") ||
    type.includes("ogg") ||
    type.includes("m4a")
  );
}

export function getMediaIcon(mediaType) {
  const type = mediaType?.toLowerCase() || "";
  if (type.includes("image")) return "🖼️";
  if (type.includes("video")) return "🎬";
  if (type.includes("audio")) return "🎵";
  if (type.includes("pdf")) return "📄";
  return "📹";
}

export function formatFileSize(bytes) {
  if (!bytes) return "Unknown size";
  const kb = bytes / 1024;
  const mb = kb / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${kb.toFixed(2)} KB`;
}
