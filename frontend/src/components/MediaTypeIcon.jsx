import { Image, Film, Music, FileText, File } from "lucide-react";
import { isImage, isVideo, isAudio } from "../utils/mediaTypes.js";

// Renders the line icon for a media item's type (image / video / audio / pdf /
// other). Used wherever a media thumbnail can't show a preview image.
export default function MediaTypeIcon({ type, className = "w-8 h-8" }) {
  const t = (type || "").toLowerCase();
  const Icon = isImage(type)
    ? Image
    : isVideo(type)
    ? Film
    : isAudio(type)
    ? Music
    : t.includes("pdf")
    ? FileText
    : File;
  return <Icon className={className} aria-hidden="true" />;
}
