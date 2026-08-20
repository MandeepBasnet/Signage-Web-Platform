import MediaTypeIcon from "./MediaTypeIcon.jsx";
import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
import LayoutElement from "./LayoutElement.jsx";
import { BarChart3, ListVideo, FileText } from "lucide-react";
import { API_BASE_URL } from "../config/api.js";
import { getStoredToken } from "../utils/auth.js";
import { formatFileSize } from "../utils/mediaTypes.js";
import {
  getOptionValue,
  getPlaylistId,
  getDatasetId,
  extractTextElements,
} from "../utils/layoutWidgets.js";

// One region's card in the designer sidebar: its widgets, and everything you
// can do to them — preview, replace, delete, edit text inline, add rows to a
// data source.
//
// The long prop list is deliberate. This block reached into 21 values in
// LayoutDesign's scope, and passing them through unchanged keeps the
// extraction verifiable as pure motion. Grouping them (a `textEditing` object,
// a `widgetData` object) is the obvious next step and is now a local change to
// two files instead of a search across 1,200 lines.
export default function LayoutRegionPanel({
  region,
  rIdx,
  playlistData,
  datasetData,
  loadingWidgetData,
  editingTextWidgetId,
  editingElementId,
  editingTextValue,
  setEditingTextValue,
  savingText,
  startEditing,
  saveText,
  cancelEditing,
  handleWidgetClick,
  handleMediaPreview,
  handleDeletePlaylistMedia,
  handleDeleteRow,
  setAddMediaModalState,
  setAddRowModalState,
  setReplaceMediaModalState,
  deletingMediaId,
  deletingRowId,
  replacingWidget,
}) {
  return (
    <div className="space-y-3">
      {/* Region Header */}
      <div className="flex items-center justify-between text-sm text-gray-200 font-medium border-b border-gray-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
            {rIdx + 1}
          </div>
          <span>{region.name || `Region ${rIdx + 1}`}</span>
        </div>
        <span className="text-xs text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
          {region.width}x{region.height}
        </span>
      </div>

      {/* Widgets List */}
      <div className="space-y-3 pl-2">
        {region.widgets && region.widgets.length > 0 ? (
          region.widgets
            .flatMap((widget) => {
              // If it's a Canvas widget, split into elements
              if (
                widget.moduleName?.toLowerCase() === "canvas" ||
                widget.moduleName?.toLowerCase() === "global"
              ) {
                const textElements = extractTextElements(widget);
                const elementsOption = getOptionValue(
                  widget,
                  "elements",
                );
                let mediaElements = [];
                try {
                  const elementsData = JSON.parse(
                    elementsOption || "[]",
                  );
                  if (Array.isArray(elementsData)) {
                    elementsData.forEach((page) => {
                      page.elements?.forEach((element) => {
                        if (
                          element.mediaId ||
                          element.id?.includes("image") ||
                          element.id?.includes("video")
                        ) {
                          mediaElements.push({
                            ...element,
                            type: element.id?.includes("video")
                              ? "video"
                              : "image",
                            name: element.elementName || element.id,
                          });
                        }
                      });
                    });
                  }
                } catch { /* ignore */ }

                const allElements = [
                  ...textElements.map((el) => ({
                    ...el,
                    type: "text",
                    isElement: true,
                  })),
                  ...mediaElements.map((el) => ({
                    ...el,
                    type: el.type || "image",
                    isElement: true,
                  })),
                ];

                if (allElements.length === 0) {
                  return [{ ...widget, isElement: false }];
                }

                return allElements.map((el, elIdx) => ({
                  ...widget,
                  ...el,
                  uniqueKey: `${widget.widgetId}-${
                    el.elementId || elIdx
                  }`,
                  displayName:
                    el.elementName ||
                    el.name ||
                    `Element ${elIdx + 1}`,
                  displayType: el.type,
                  isElement: true,
                }));
              }
              return [
                {
                  ...widget,
                  uniqueKey: widget.widgetId,
                  isElement: false,
                },
              ];
            })
            .map((widget) => {
              const moduleName = (
                widget.displayType || widget.moduleName
              )?.toLowerCase();
              return (
                <div
                  key={widget.uniqueKey}
                  className="bg-gray-800/40 hover:bg-gray-800 rounded-lg p-3 cursor-pointer transition-all border border-gray-700/50 hover:border-blue-500/30 group relative overflow-hidden"
                  onClick={() => {
                    if (
                      widget.isElement &&
                      widget.displayType === "text"
                    ) {
                      startEditing(
                        widget,
                        widget.text,
                        widget.elementId,
                      );
                    } else if (
                      widget.isElement &&
                      (widget.displayType === "image" ||
                        widget.displayType === "video")
                    ) {
                      if (widget.mediaId) {
                        handleMediaPreview({
                          mediaId: widget.mediaId,
                          name: widget.displayName,
                          type: widget.displayType,
                        });
                      }
                    } else {
                      handleWidgetClick(widget);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    {/* Left: Thumbnail or Icon */}
                    <div className="shrink-0 w-16 h-16 bg-gray-900 rounded-md border border-gray-700 flex items-center justify-center overflow-hidden">
                      {(widget.mediaIds?.length > 0 ||
                        widget.mediaId) &&
                      moduleName !== "text" &&
                      moduleName !== "canvas" ? (
                        <img
                          src={`${API_BASE_URL}/library/${
                            widget.mediaId || widget.mediaIds?.[0]
                          }/thumbnail?width=100&height=100&token=${getStoredToken()}`}
                          alt={widget.displayName || widget.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display =
                              "flex";
                          }}
                        />
                      ) : null}

                      {/* Fallback Icon (shown if no image or error) */}
                      <div
                        className={`w-full h-full flex items-center justify-center ${
                          (widget.mediaIds?.length > 0 ||
                            widget.mediaId) &&
                          moduleName !== "text" &&
                          moduleName !== "canvas"
                            ? "hidden"
                            : "flex"
                        }`}
                      >
                        {moduleName === "text" ? (
                          <span className="text-2xl">T</span>
                        ) : moduleName === "dataset" ? (
                          <BarChart3 className="w-6 h-6" />
                        ) : moduleName === "playlist" ||
                          moduleName === "subplaylist" ? (
                          <ListVideo className="w-6 h-6" />
                        ) : (
                          <FileText className="w-6 h-6" />
                        )}
                      </div>
                    </div>

                    {/* Right: Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                            moduleName === "text"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : moduleName === "dataset"
                                ? "bg-purple-500/10 text-purple-400"
                                : "bg-blue-500/10 text-blue-400"
                          }`}
                        >
                          {moduleName}
                        </span>
                        {!widget.isElement && (
                          <span className="text-gray-500 text-xs ml-auto flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {widget.duration}s
                          </span>
                        )}
                      </div>

                      <h4
                        className="text-sm font-medium text-gray-200 truncate"
                        title={widget.displayName || widget.name}
                      >
                        {widget.displayName ||
                          widget.name ||
                          "Untitled Widget"}
                      </h4>

                      {/* Extra Info based on type */}
                      <div className="text-xs text-gray-500 mt-1">
                        {moduleName === "text" ||
                        moduleName === "canvas" ? (
                          String(editingTextWidgetId) ===
                            String(widget.widgetId) &&
                          (!widget.isElement ||
                            widget.elementId ===
                              editingElementId) ? (
                            <div
                              className="mt-2 space-y-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <textarea
                                value={editingTextValue}
                                onChange={(e) =>
                                  setEditingTextValue(
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-gray-900 text-gray-200 text-xs p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-y min-h-[80px]"
                                placeholder="Enter text content..."
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={cancelEditing}
                                  className="px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                                  disabled={savingText}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() =>
                                    saveText(widget)
                                  }
                                  className="px-2 py-1 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors flex items-center gap-1"
                                  disabled={savingText}
                                >
                                  {savingText ? (
                                    <>
                                      <svg
                                        className="animate-spin h-3 w-3"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                          fill="none"
                                        ></circle>
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                      </svg>
                                      Saving...
                                    </>
                                  ) : (
                                    "Save"
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span
                                className="text-base font-medium text-gray-100 cursor-text hover:text-yellow-300 transition-colors leading-snug"
                                title="Double click to edit"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  // Use pre-extracted text if available (for elements), otherwise check options
                                  let text =
                                    widget.text ||
                                    getOptionValue(widget, "text");

                                  // Fallback: try to parse elements if not found (legacy support)
                                  if (!text) {
                                    try {
                                      const elements = JSON.parse(
                                        getOptionValue(
                                          widget,
                                          "elements",
                                        ) || "[]",
                                      );
                                      elements.forEach((page) => {
                                        page.elements?.forEach(
                                          (el) => {
                                            if (
                                              el.id === "text" ||
                                              el.type === "text"
                                            ) {
                                              text =
                                                el.properties?.find(
                                                  (p) =>
                                                    p.id === "text",
                                                )?.value;
                                            }
                                          },
                                        );
                                      });
                                    } catch { /* ignore */ }
                                  }

                                  const cleanText =
                                    text?.replace(/<[^>]*>/g, "") ||
                                    "";
                                  startEditing(
                                    widget,
                                    cleanText,
                                    widget.elementId,
                                  );
                                }}
                              >
                                {(() => {
                                  let text =
                                    widget.text ||
                                    getOptionValue(widget, "text");

                                  if (!text) {
                                    try {
                                      const elements = JSON.parse(
                                        getOptionValue(
                                          widget,
                                          "elements",
                                        ) || "[]",
                                      );
                                      elements.forEach((page) => {
                                        page.elements?.forEach(
                                          (el) => {
                                            if (
                                              el.id === "text" ||
                                              el.type === "text"
                                            ) {
                                              text =
                                                el.properties?.find(
                                                  (p) =>
                                                    p.id === "text",
                                                )?.value;
                                            }
                                          },
                                        );
                                      });
                                    } catch { /* ignore */ }
                                  }
                                  return (
                                    text?.replace(/<[^>]*>/g, "") ||
                                    "Text Content"
                                  );
                                })()}
                              </span>
                              <button
                                className="text-[10px] text-blue-400 hover:text-blue-300 self-start underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let text =
                                    widget.text ||
                                    getOptionValue(widget, "text");

                                  if (!text) {
                                    try {
                                      const elements = JSON.parse(
                                        getOptionValue(
                                          widget,
                                          "elements",
                                        ) || "[]",
                                      );
                                      elements.forEach((page) => {
                                        page.elements?.forEach(
                                          (el) => {
                                            if (
                                              el.id === "text" ||
                                              el.type === "text"
                                            ) {
                                              text =
                                                el.properties?.find(
                                                  (p) =>
                                                    p.id === "text",
                                                )?.value;
                                            }
                                          },
                                        );
                                      });
                                    } catch { /* ignore */ }
                                  }

                                  const cleanText =
                                    text?.replace(/<[^>]*>/g, "") ||
                                    "";
                                  startEditing(
                                    widget,
                                    cleanText,
                                    widget.elementId,
                                  );
                                }}
                              >
                                Edit Text
                              </button>
                            </div>
                          )
                        ) : (moduleName === "image" ||
                            moduleName === "video" ||
                            moduleName ===
                              "global_library_image") &&
                          (widget.mediaIds?.length > 0 ||
                            widget.mediaId) ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-400">
                              Media ID:{" "}
                              {widget.mediaId ||
                                widget.mediaIds?.[0] ||
                                "N/A"}
                            </span>
                            <button
                              className="text-[10px] text-blue-400 hover:text-blue-300 self-start underline flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentMediaId =
                                  widget.mediaId ||
                                  widget.mediaIds?.[0];
                                setReplaceMediaModalState({
                                  isOpen: true,
                                  widgetId: widget.widgetId,
                                  elementId:
                                    widget.elementId || null, // Pass elementId if it's a Global element
                                  currentMediaId: currentMediaId,
                                });
                              }}
                              disabled={
                                replacingWidget === widget.widgetId
                              }
                            >
                              {replacingWidget ===
                              widget.widgetId ? (
                                <>
                                  <svg
                                    className="animate-spin h-3 w-3"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                  Replacing...
                                </>
                              ) : (
                                <>
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                  </svg>
                                  Replace Media
                                </>
                              )}
                            </button>
                          </div>
                        ) : moduleName === "playlist" ||
                          moduleName === "subplaylist" ? (
                          (() => {
                            const plId = getPlaylistId(widget);
                            const plData = playlistData.get(
                              String(plId),
                            );
                            const isLoading = loadingWidgetData.has(
                              `playlist-${plId}`,
                            );

                            if (isLoading)
                              return <span>Loading media...</span>;
                            if (!plData)
                              return (
                                <span>Playlist ID: {plId}</span>
                              );

                            // Helper to robustly get media ID
                            const getMediaId = (item) => {
                              // Check mediaIds array first (primary field in API response)
                              if (
                                item.mediaIds &&
                                Array.isArray(item.mediaIds) &&
                                item.mediaIds.length > 0
                              ) {
                                return item.mediaIds[0];
                              }
                              // Fallback to other possible field names
                              return (
                                item.mediaId ||
                                item.media_id ||
                                item.id ||
                                item.media?.mediaId ||
                                item.media?.media_id ||
                                item.media?.id
                              );
                            };

                            // Robust media type checkers from MediaContent.jsx
                            const isImage = (mediaType) => {
                              const type = (
                                mediaType || ""
                              ).toLowerCase();
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
                              const type = (
                                mediaType || ""
                              ).toLowerCase();
                              return (
                                type.includes("video") ||
                                type.includes("mp4") ||
                                type.includes("webm") ||
                                type.includes("ogg") ||
                                type.includes("mov") ||
                                type.includes("avi")
                              );
                            };

                            return (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1 flex justify-between items-center">
                                  <span>
                                    {plData.playlist.name ||
                                      `Playlist ${plId}`}{" "}
                                    - {plData.media.length} items
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddMediaModalState({
                                        isOpen: true,
                                        playlistId: plId,
                                      });
                                    }}
                                    className="p-1 hover:bg-blue-500/20 rounded text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Add Media to Playlist"
                                    aria-label="Add media to this playlist"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3.5 w-3.5"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                {/* Increased max-height as requested */}
                                <div className="space-y-1 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                  {plData.media.map(
                                    (media, idx) => {
                                      const mediaId =
                                        getMediaId(media);
                                      const mediaType =
                                        media.mediaType ||
                                        media.type ||
                                        "";
                                      const hasThumbnail =
                                        isImage(mediaType) ||
                                        isVideo(mediaType);

                                      return (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded border border-gray-800 hover:bg-gray-800 transition-colors group relative"
                                        >
                                          {/* Thumbnail - Clickable for preview */}
                                          <div
                                            className="w-8 h-8 bg-gray-800 rounded overflow-hidden shrink-0 border border-gray-700 flex items-center justify-center relative cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMediaPreview(
                                                media,
                                              );
                                            }}
                                            title={`Click to preview: ${media.name}`}
                                          >
                                            {hasThumbnail &&
                                            mediaId ? (
                                              <img
                                                src={`${API_BASE_URL}/library/${mediaId}/thumbnail?preview=1&width=50&height=50&token=${getStoredToken()}`}
                                                className="w-full h-full object-cover absolute inset-0"
                                                alt={media.name}
                                                onError={(e) => {
                                                  // Hide image and show fallback
                                                  e.target.style.display =
                                                    "none";
                                                  if (
                                                    e.target
                                                      .nextSibling
                                                  )
                                                    e.target.nextSibling.style.display =
                                                      "flex";
                                                }}
                                              />
                                            ) : null}

                                            {/* Fallback Icon */}
                                            <div
                                              className={`w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 ${
                                                hasThumbnail &&
                                                mediaId
                                                  ? "hidden"
                                                  : "flex"
                                              }`}
                                            >
                                              <MediaTypeIcon
                                                type={mediaType}
                                                className="w-6 h-6"
                                              />
                                            </div>
                                          </div>

                                          {/* Details - Clickable for preview */}
                                          <div
                                            className="min-w-0 flex-1 cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMediaPreview(
                                                media,
                                              );
                                            }}
                                            title={`Click to preview: ${media.name}`}
                                          >
                                            <div
                                              className="text-[10px] text-gray-300 truncate font-medium"
                                              title={media.name}
                                            >
                                              {media.name}
                                            </div>
                                            <div className="text-[9px] text-gray-500 flex justify-between">
                                              <span>
                                                {formatFileSize(
                                                  media.fileSize,
                                                )}
                                              </span>
                                              <span>
                                                {media.duration}s
                                              </span>
                                            </div>
                                          </div>

                                          {/* Delete Button - Inline */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const widgetId =
                                                media.widgetId ||
                                                media.widget_id ||
                                                media.id;
                                              handleDeletePlaylistMedia(
                                                plId,
                                                widgetId,
                                                media.name,
                                              );
                                            }}
                                            disabled={
                                              deletingMediaId ===
                                              (media.widgetId ||
                                                media.widget_id ||
                                                media.id)
                                            }
                                            className={`shrink-0 p-1 rounded transition-colors ${
                                              deletingMediaId ===
                                              (media.widgetId ||
                                                media.widget_id ||
                                                media.id)
                                                ? "text-gray-500 cursor-not-allowed"
                                                : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                            }`}
                                            title={`Delete ${media.name}`}
                                          >
                                            {deletingMediaId ===
                                            (media.widgetId ||
                                              media.widget_id ||
                                              media.id) ? (
                                              <svg
                                                className="animate-spin h-3.5 w-3.5"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                ></circle>
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                              </svg>
                                            ) : (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-3.5 w-3.5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : moduleName === "dataset" ? (
                          (() => {
                            const dsId = getDatasetId(widget);
                            const dsData = datasetData.get(
                              String(dsId),
                            );
                            const isLoading = loadingWidgetData.has(
                              `dataset-${dsId}`,
                            );

                            if (isLoading)
                              return (
                                <span>Loading data source…</span>
                              );
                            if (!dsData)
                              return (
                                <span>Data source unavailable</span>
                              );

                            return (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1 flex justify-between items-center">
                                  <span>
                                    Data source: {dsData.columns.length}{" "}
                                    columns × {dsData.rows.length}{" "}
                                    rows
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAddRowModalState({
                                        isOpen: true,
                                        datasetId: dsId,
                                        columns: dsData.columns,
                                      });
                                    }}
                                    className="p-1 hover:bg-blue-500/20 rounded text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Add Row"
                                    aria-label="Add a row to this data source"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3.5 w-3.5"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                {/* Dataset Table - Increased max-height for better visibility */}
                                <div className="max-h-96 overflow-auto pr-1 custom-scrollbar">
                                  <table className="w-full text-[10px] border-collapse">
                                    <thead className="sticky top-0 bg-gray-900 z-10">
                                      <tr>
                                        <th className="px-1.5 py-1 text-left font-semibold text-gray-300 border-b border-gray-700 bg-gray-800">
                                          #
                                        </th>
                                        {dsData.columns.map(
                                          (col, idx) => (
                                            <th
                                              key={idx}
                                              className="px-1.5 py-1 text-left font-semibold text-gray-300 border-b border-gray-700 bg-gray-800 truncate max-w-[100px]"
                                              title={col.heading}
                                            >
                                              {col.heading}
                                            </th>
                                          ),
                                        )}
                                        <th className="px-1.5 py-1 text-right font-semibold text-gray-300 border-b border-gray-700 bg-gray-800 w-8"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dsData.rows.map(
                                        (row, rowIdx) => (
                                          <tr
                                            key={rowIdx}
                                            className="hover:bg-gray-800/50 transition-colors border-b border-gray-800/50"
                                          >
                                            <td className="px-1.5 py-1.5 text-gray-500 font-mono">
                                              {rowIdx + 1}
                                            </td>
                                            {dsData.columns.map(
                                              (col, colIdx) => {
                                                const cellValue =
                                                  row[
                                                    col.heading
                                                  ] ||
                                                  row[
                                                    `col_${col.dataSetColumnId}`
                                                  ] ||
                                                  "-";
                                                return (
                                                  <td
                                                    key={colIdx}
                                                    className="px-1.5 py-1.5 text-gray-300 truncate max-w-[100px]"
                                                    title={
                                                      cellValue
                                                    }
                                                  >
                                                    {cellValue}
                                                  </td>
                                                );
                                              },
                                            )}
                                            <td className="px-1.5 py-1.5 text-right">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteRow(
                                                    dsId,
                                                    row.id,
                                                  );
                                                }}
                                                disabled={
                                                  deletingRowId ===
                                                  row.id
                                                }
                                                className={`p-0.5 rounded transition-colors ${
                                                  deletingRowId ===
                                                  row.id
                                                    ? "text-gray-600 cursor-not-allowed"
                                                    : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                }`}
                                                title="Delete Row"
                                                aria-label="Delete this row"
                                              >
                                                {deletingRowId ===
                                                row.id ? (
                                                  <svg
                                                    className="animate-spin h-3 w-3"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <circle
                                                      className="opacity-25"
                                                      cx="12"
                                                      cy="12"
                                                      r="10"
                                                      stroke="currentColor"
                                                      strokeWidth="4"
                                                    ></circle>
                                                    <path
                                                      className="opacity-75"
                                                      fill="currentColor"
                                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    ></path>
                                                  </svg>
                                                ) : (
                                                  <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-3 w-3"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                  >
                                                    <path
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                      strokeWidth={
                                                        2
                                                      }
                                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                  </svg>
                                                )}
                                              </button>
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                  </table>
                                  {dsData.rows.length === 0 && (
                                    <div className="text-center py-4 text-gray-500 text-xs italic">
                                      No data rows available
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : moduleName === "canvas" ||
                          moduleName === "global" ? (
                          (() => {
                            const textElements =
                              extractTextElements(widget);
                            const elementsOption = getOptionValue(
                              widget,
                              "elements",
                            );
                            let mediaElements = [];

                            // Extract media elements from the elements JSON
                            if (elementsOption) {
                              try {
                                const elementsData =
                                  JSON.parse(elementsOption);
                                if (Array.isArray(elementsData)) {
                                  elementsData.forEach((page) => {
                                    if (
                                      page.elements &&
                                      Array.isArray(page.elements)
                                    ) {
                                      page.elements.forEach(
                                        (element) => {
                                          // Check for image/media elements
                                          if (
                                            element.mediaId ||
                                            element.id?.includes(
                                              "image",
                                            ) ||
                                            element.id?.includes(
                                              "video",
                                            )
                                          ) {
                                            mediaElements.push({
                                              mediaId:
                                                element.mediaId,
                                              elementId:
                                                element.elementId,
                                              elementName:
                                                element.elementName ||
                                                element.id ||
                                                "Media Element",
                                              type: element.id?.includes(
                                                "video",
                                              )
                                                ? "video"
                                                : "image",
                                              position: {
                                                left: element.left,
                                                top: element.top,
                                                width:
                                                  element.width,
                                                height:
                                                  element.height,
                                              },
                                            });
                                          }
                                        },
                                      );
                                    }
                                  });
                                }
                              } catch (e) {
                                console.error(
                                  "Failed to parse elements for media:",
                                  e,
                                );
                              }
                            }

                            const totalElements =
                              mediaElements.length +
                              textElements.length;

                            if (totalElements === 0) {
                              return <span>No elements found</span>;
                            }

                            return (
                              <div className="mt-2 space-y-2">
                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1">
                                  Canvas Elements: {totalElements}
                                </div>
                                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                  {/* Media Elements */}
                                  {mediaElements.map(
                                    (mediaEl, idx) => (
                                      <div
                                        key={`media-${idx}`}
                                        className="bg-gray-900/50 p-2 rounded border border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (mediaEl.mediaId) {
                                            handleMediaPreview({
                                              mediaId:
                                                mediaEl.mediaId,
                                              name: mediaEl.elementName,
                                              type: mediaEl.type,
                                            });
                                          }
                                        }}
                                        title={
                                          mediaEl.mediaId
                                            ? `Click to preview: ${mediaEl.elementName}`
                                            : mediaEl.elementName
                                        }
                                      >
                                        <div className="flex items-center gap-2">
                                          {/* Media Thumbnail */}
                                          <div className="shrink-0 w-12 h-12 bg-gray-800 rounded overflow-hidden border border-gray-700 flex items-center justify-center">
                                            {mediaEl.mediaId ? (
                                              <img
                                                src={`${API_BASE_URL}/library/${
                                                  mediaEl.mediaId
                                                }/thumbnail?width=100&height=100&token=${getStoredToken()}`}
                                                alt={
                                                  mediaEl.elementName
                                                }
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                  e.target.style.display =
                                                    "none";
                                                  e.target.nextSibling.style.display =
                                                    "flex";
                                                }}
                                              />
                                            ) : null}
                                            <div
                                              className={`w-full h-full flex items-center justify-center text-gray-500 ${
                                                mediaEl.mediaId
                                                  ? "hidden"
                                                  : "flex"
                                              }`}
                                            >
                                              <MediaTypeIcon
                                                type={mediaEl.type}
                                                className="w-6 h-6"
                                              />
                                            </div>
                                          </div>
                                          {/* Media Details */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-green-500/10 text-green-400">
                                                {mediaEl.type}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-gray-300 font-medium truncate mt-0.5">
                                              {mediaEl.elementName}
                                            </div>
                                            {mediaEl.mediaId && (
                                              <div className="text-[9px] text-gray-500 mt-0.5">
                                                Media ID:{" "}
                                                {mediaEl.mediaId}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ),
                                  )}

                                  {/* Text Elements */}
                                  {textElements.map(
                                    (textEl, idx) => (
                                      <div
                                        key={`text-${idx}`}
                                        className="bg-gray-900/50 p-2 rounded border border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer group"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          // Enable editing for this text element
                                          startEditing(
                                            widget,
                                            textEl.text,
                                            textEl.elementId,
                                          );
                                        }}
                                        title="Double click to edit text"
                                      >
                                        <div className="flex items-start gap-2">
                                          {/* Text Icon */}
                                          <div className="shrink-0 w-12 h-12 bg-yellow-500/10 rounded flex items-center justify-center text-yellow-400 text-lg font-bold border border-gray-700">
                                            T
                                          </div>
                                          {/* Text Content */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-yellow-500/10 text-yellow-400">
                                                TEXT
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-gray-300 font-medium break-words">
                                              {textEl.text}
                                            </div>
                                            <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                              <span className="flex items-center gap-1">
                                                <span
                                                  className="w-3 h-3 rounded-sm border border-gray-600"
                                                  style={{
                                                    backgroundColor:
                                                      textEl.fontColor,
                                                  }}
                                                ></span>
                                                {textEl.fontColor}
                                              </span>
                                              <span>•</span>
                                              <span>
                                                Size:{" "}
                                                {textEl.fontSize}px
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : widget.mediaIds?.length > 0 ? (
                          <span className="truncate">
                            Media ID: {widget.mediaIds[0]}
                          </span>
                        ) : (
                          <span>No media attached</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="text-xs text-gray-600 italic pl-1 py-2 border-l-2 border-gray-800 ml-1">
            No widgets in this region
          </div>
        )}
      </div>
    </div>
  );
}
