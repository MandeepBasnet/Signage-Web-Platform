import { Play } from "lucide-react";
import { isVideo } from "../utils/mediaTypes.js";
import MediaTypeIcon from "./MediaTypeIcon.jsx";

// Shared media thumbnail, used by the Library (Media) page and the Add-Media
// picker so a media item is represented identically in both places.
//
// Xibo's thumbnail endpoint returns a POSTER IMAGE for videos too (a cover
// frame), so both images and videos render as <img> — a <video> tag can't
// display that PNG (the old code pointed <video src> at the poster URL, which
// failed and showed an icon). Videos get a play badge. Falls back to a type
// icon when there's no url or the image fails to load.
//
// The parent container must be `relative` (for the play badge), sized, and
// `overflow-hidden`.
export default function MediaThumbnail({ url, type, name, iconClassName = "w-8 h-8" }) {
  const hasImage = !!url;

  return (
    <>
      {hasImage && (
        <img
          src={url}
          alt={name || "media"}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide the broken image and reveal the icon fallback next to it.
            e.currentTarget.style.display = "none";
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = "flex";
            }
          }}
        />
      )}

      {/* Icon fallback: shown when there's no image, or revealed on image error. */}
      <div
        className={`${
          hasImage ? "hidden" : "flex"
        } items-center justify-center w-full h-full text-gray-400`}
      >
        <MediaTypeIcon type={type} className={iconClassName} />
      </div>

      {hasImage && isVideo(type) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <Play className="w-6 h-6 text-white drop-shadow" fill="currentColor" />
        </div>
      )}
    </>
  );
}
