/* eslint-disable no-unused-vars */
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { getAuthHeaders, getStoredToken } from "../utils/auth.js";
import MediaPreviewModal from "./MediaPreviewModal";
import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
import AddRowModal from "./AddRowModal";
import MediaPickerModal from "./MediaPickerModal";
import CheckoutPrompt from "./CheckoutPrompt.jsx";
import LoadingOverlay from "./LoadingOverlay.jsx";
import LayoutToolbar from "./LayoutToolbar.jsx";
import LayoutCanvas from "./LayoutCanvas.jsx";
import LayoutRegionPanel from "./LayoutRegionPanel.jsx";
import LayoutElement from "./LayoutElement.jsx";
import MediaTypeIcon from "./MediaTypeIcon.jsx";
import { BarChart3, ListVideo, FileText } from "lucide-react";
import { useToast } from "../hooks/useToast.js";
import { useConfirm } from "../hooks/useConfirm.js";
import InfoHint from "./ui/InfoHint.jsx";
import { useLayoutCheckout } from "../hooks/useLayoutCheckout.js";
import { useWidgetData } from "../hooks/useWidgetData.js";
import { useCanvasZoom } from "../hooks/useCanvasZoom.js";
import { useTextEditing } from "../hooks/useTextEditing.js";

import { API_BASE_URL } from "../config/api.js";
import { formatFileSize } from "../utils/mediaTypes.js";
import {
  getOptionValue,
  getPlaylistId,
  getDatasetId,
  extractTextElements,
  getRegionSummary,
} from "../utils/layoutWidgets.js";

export default function LayoutDesign() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { layoutId } = useParams();
  const navigate = useNavigate();

  // State
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bgImageUrl, setBgImageUrl] = useState(null);
  // Faithful live preview (iframe proxy of Xibo's own renderer) vs. our
  // structure reconstruction. Defaults on; toggle falls back if unavailable.
  const [useLivePreview, setUseLivePreview] = useState(true);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Add Media Modal State
  const [addMediaModalState, setAddMediaModalState] = useState({
    isOpen: false,
    playlistId: null,
  });

  // Add Row Modal State
  const [addRowModalState, setAddRowModalState] = useState({
    isOpen: false,
    datasetId: null,
    columns: [],
  });
  const [addingRow, setAddingRow] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState(null);

  // Playlist & dataset contents for the widgets on this layout.
  const {
    playlistData,
    datasetData,
    loadingWidgetData,
    fetchPlaylistMedia,
    fetchDatasetData,
  } = useWidgetData();

  // Delete Media State
  const [deleteHoveredMediaId, setDeleteHoveredMediaId] = useState(null);
  const [deletingMediaId, setDeletingMediaId] = useState(null);

  // Xibo's draft/live model lives in its own hook — see useLayoutCheckout.
  // onRefetch is wrapped in an arrow because fetchLayoutDetails is declared
  // further down; the arrow defers the lookup until it is actually called.
  const {
    publishing,
    publishSuccess,
    publishLayout,
    checkingOut,
    checkoutSuccess,
    checkoutLayout,
  } = useLayoutCheckout({
    layoutId,
    layout,
    onRefetch: () => fetchLayoutDetails(),
  });

  // Inline text editing on the canvas — see useTextEditing.
  const {
    editingTextWidgetId,
    editingElementId,
    editingTextValue,
    setEditingTextValue,
    savingText,
    startEditing,
    saveText,
    cancelEditing,
  } = useTextEditing({
    layout,
    layoutId,
    onRefetch: () => fetchLayoutDetails(),
  });

  // Checkout Prompt State
  const [showCheckoutPrompt, setShowCheckoutPrompt] = useState(false);

  // Replace Media State
  const [replaceMediaModalState, setReplaceMediaModalState] = useState({
    isOpen: false,
    widgetId: null,
    elementId: null, // Track if editing a Global widget element
    currentMediaId: null,
  });
  const [replacingWidget, setReplacingWidget] = useState(null);

  // Canvas Rendering State
  // When true, the canvas auto-fits the viewport; manual zoom turns it off.
  const [selectedRegionId, setSelectedRegionId] = useState(null); // Currently selected region

  // Refs
  const sidebarRef = useRef(null); // Ref to sidebar for auto-scrolling

  // Canvas sizing: auto-fits until the user zooms, then stays put.
  const { containerRef, canvasScale, zoomBy, zoomFit } = useCanvasZoom(layout);

  useEffect(() => {
    // Show prompt if layout is published (Status ID 1)
    if (layout?.publishedStatusId === 1 && !checkingOut) {
      setShowCheckoutPrompt(true);
    } else {
      setShowCheckoutPrompt(false);
    }
  }, [layout, checkingOut]);

  // Initial data fetch
  useEffect(() => {
    fetchLayoutDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId]);

  // Fetch Background Image
  useEffect(() => {
    if (layout?.backgroundImageId) {
      fetchBackgroundImage(layout.backgroundImageId);
    }
  }, [layout]);

  // Auto-fetch Playlist and Dataset data when layout loads
  useEffect(() => {
    if (!layout?.regions) return;

    const playlistIds = new Set();
    const datasetIds = new Set();

    layout.regions.forEach((region) => {
      region.widgets?.forEach((widget) => {
        const moduleName = widget.moduleName?.toLowerCase();

        // Check for playlist types
        if (moduleName === "playlist" || moduleName === "subplaylist") {
          const plId = getPlaylistId(widget);
          if (plId) playlistIds.add(plId);
        }
        // Check for dataset types
        else if (moduleName === "dataset") {
          const dsId = getDatasetId(widget);
          if (dsId) datasetIds.add(dsId);
        }
      });
    });

    console.log(
      `Found ${playlistIds.size} playlists and ${datasetIds.size} datasets to fetch`,
    );

    playlistIds.forEach((id) => fetchPlaylistMedia(id));
    datasetIds.forEach((id) => fetchDatasetData(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const fetchLayoutDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/layouts/${layoutId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch layout details");
      }

      const data = await response.json();

      // AUTO-REDIRECT TO DRAFT IF EXISTS
      // If we opened a published layout but a draft exists, redirect to the draft to avoid "Not a Draft" errors
      if (
        data.existingDraftId &&
        String(data.existingDraftId) !== String(layoutId)
      ) {
        console.log(
          `[LayoutDesign] Found existing draft ${data.existingDraftId}. Redirecting...`,
        );
        navigate(`/layout/designer/${data.existingDraftId}`, { replace: true });
        return; // Stop processing this read-only layout
      }

      const fetchedLayout = data.layout;

      console.log(
        `[LayoutDesign] Fetched Layout: ID=${fetchedLayout.layoutId}, Status=${fetchedLayout.publishedStatusId}`,
      );

      setLayout(fetchedLayout);
    } catch (err) {
      console.error("Error fetching layout:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackgroundImage = async (mediaId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/library/${mediaId}/download`,
        {
          headers: getAuthHeaders(),
        },
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBgImageUrl(url);
      }
    } catch (err) {
      console.error("Failed to fetch background image", err);
    }
  };

  const handleWidgetClick = (widget) => {
    const moduleName = widget.moduleName?.toLowerCase();

    // Handle media widgets
    if (widget.mediaIds && widget.mediaIds.length > 0) {
      const mediaId = widget.mediaIds[0];
      const token = getStoredToken();
      const mediaUrl = `${API_BASE_URL}/library/${mediaId}/download?token=${token}`;

      setPreviewMedia({
        url: mediaUrl,
        type: widget.moduleName,
        name: widget.name || `Media ${mediaId}`,
      });
      setPreviewModalOpen(true);
    }
    // Handle playlist widgets
    else if (moduleName === "playlist" || moduleName === "subplaylist") {
      const plId = getPlaylistId(widget);

      if (!plId) {
        // Keep the widget dump in the console where it's useful; the user
        // gets the consequence and the fix instead.
        console.error("[LayoutDesign] Playlist widget has no playlist ID", {
          module: widget.moduleName,
          type: widget.type,
          options: widget.widgetOptions,
        });
        toast.error(
          "This playlist widget isn't linked to a playlist",
          "Remove it from the layout and add it again."
        );
        return;
      }

      const plData = playlistData.get(String(plId));

      if (!plData) {
        toast.info("Loading playlist…");
        fetchPlaylistMedia(plId);
        return;
      }

      // The items themselves are already listed in the sidebar, so the
      // toast only has to confirm which playlist was opened and its size.
      const itemCount = plData.media.length;
      toast.info(
        widget.name || plData.playlist.name,
        `${itemCount} item${
          itemCount === 1 ? "" : "s"
        } in this playlist — thumbnails are in the sidebar.`
      );
    }
    // Handle dataset widgets
    else if (moduleName === "dataset") {
      const dsId = getDatasetId(widget);

      if (!dsId) {
        console.error("[LayoutDesign] Dataset widget has no dataset ID", {
          module: widget.moduleName,
          type: widget.type,
          options: widget.widgetOptions,
        });
        toast.error(
          "This widget isn't linked to a data source",
          "Remove it from the layout and add it again."
        );
        return;
      }

      const dsData = datasetData.get(String(dsId));

      if (!dsData) {
        toast.info("Loading data source…");
        fetchDatasetData(dsId);
        return;
      }

      const { columns, rows } = dsData;
      toast.info(
        widget.name || "Data source",
        `${columns.length} column${columns.length === 1 ? "" : "s"}, ` +
          `${rows.length} row${rows.length === 1 ? "" : "s"}.`
      );
    }
    // Handle other widgets
    else {
      // Skip preview/alert for text and canvas widgets as they have inline editing
      if (moduleName === "text" || moduleName === "canvas") return;

      // For other widgets, do nothing (no alert)
      console.log(`Clicked widget: ${widget.moduleName} - ${widget.name}`);
    }
  };

  const handleMediaPreview = (item) => {
    const mediaId =
      item.mediaIds?.[0] || item.mediaId || item.media_id || item.id;
    const token = localStorage.getItem("auth_token");
    const previewUrl = `${API_BASE_URL}/library/${mediaId}/download?preview=1&token=${token}`;

    setPreviewMedia({
      url: previewUrl,
      type: item.type || item.moduleName || item.mediaType,
      name: item.name || `Media ${mediaId}`,
    });
    setPreviewModalOpen(true);
  };

  const handleDeletePlaylistMedia = async (playlistId, widgetId, mediaName) => {
    const ok = await confirmDialog({
      title: `Remove "${mediaName}" from the playlist?`,
      body: "The file stays in your library — it just stops playing here.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    try {
      setDeletingMediaId(widgetId);
      const response = await fetch(
        `${API_BASE_URL}/playlists/${playlistId}/media/${widgetId}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        },
      );

      if (response.status === 403) {
        toast.error(
          "You don't have permission to change this playlist",
          "Ask an admin to share it with you."
        );
        return;
      }

      if (response.status === 404) {
        toast.error(
          "That media is already gone",
          "It may have been deleted by someone else."
        );
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete media");
      }

      // Refresh playlist data
      await fetchPlaylistMedia(playlistId, true);

      // Reload the entire layout to ensure consistency
      await fetchLayoutDetails();

      console.log(`Successfully removed media from playlist ${playlistId}`);
      toast.success("Media removed");
    } catch (err) {
      console.error("Error deleting media from playlist:", err);
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")
      ) {
        toast.error(
          "Network problem",
          "Check your connection and try again."
        );
      } else {
        toast.error("Couldn't remove the media", err.message);
      }
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleMediaAdded = async (mediaId) => {
    console.log("Media added to playlist, refreshing...", mediaId);
    if (addMediaModalState.playlistId) {
      await fetchPlaylistMedia(addMediaModalState.playlistId, true);
      await fetchLayoutDetails();
    }
  };

  const handleAddRow = async (formData) => {
    const { datasetId } = addRowModalState;
    if (!datasetId) return;

    try {
      setAddingRow(true);
      const response = await fetch(
        `${API_BASE_URL}/datasets/data/${datasetId}`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(formData),
        },
      );

      if (!response.ok) throw new Error("Failed to add row");

      // Refresh dataset data
      await fetchDatasetData(datasetId, true);

      // Refresh layout
      await fetchLayoutDetails();

      toast.success("Row added");
      setAddRowModalState((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error("Error adding row:", err);
      toast.error("Couldn't add the row", err.message);
    } finally {
      setAddingRow(false);
    }
  };

  const handleDeleteRow = async (datasetId, rowId) => {
    const ok = await confirmDialog({
      title: "Delete this row?",
      body: "The row is removed from the data source. This can't be undone.",
      confirmLabel: "Delete row",
      destructive: true,
    });
    if (!ok) return;

    try {
      setDeletingRowId(rowId);
      const response = await fetch(
        `${API_BASE_URL}/datasets/data/${datasetId}/${rowId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) throw new Error("Failed to delete row");

      // Refresh dataset data
      await fetchDatasetData(datasetId, true);

      // Refresh layout
      await fetchLayoutDetails();

      console.log(
        `Successfully deleted row ${rowId} from dataset ${datasetId}`,
      );
    } catch (err) {
      console.error("Error deleting row:", err);
      toast.error("Couldn't delete the row", err.message);
    } finally {
      setDeletingRowId(null);
    }
  };

  const handleReplaceMedia = async (newMediaId) => {
    const { widgetId, elementId } = replaceMediaModalState;
    if (!widgetId || !newMediaId) return;

    try {
      setReplacingWidget(widgetId);

      // DEBUG: Log the state values
      console.log(`[DEBUG] Replace Media State:`, {
        widgetId,
        elementId,
        hasElementId: !!elementId,
        newMediaId,
      });

      console.log(
        `Replacing media for widget ${widgetId} ${elementId ? `(Element: ${elementId})` : ""} with media ${newMediaId}`,
      );

      let payload = {};

      // SCENARIO 1: Global/Canvas Widget Element (The fix for your bug)
      if (elementId) {
        console.log(`[DEBUG] Taking Global Widget path (elementId present)`);

        // 1. Find the widget in the current layout state
        let targetWidget = null;
        layout.regions.forEach((r) => {
          r.regionPlaylist?.widgets?.forEach((w) => {
            if (String(w.widgetId) === String(widgetId)) targetWidget = w;
          });
        });

        if (!targetWidget) throw new Error("Widget not found in local state");

        console.log(
          `[DEBUG] Found widget:`,
          targetWidget.type,
          targetWidget.moduleName,
        );

        // 2. Parse the existing elements JSON
        const elementsOption = getOptionValue(targetWidget, "elements");
        let elementsData = [];
        try {
          elementsData = JSON.parse(elementsOption || "[]");
        } catch (e) {
          throw new Error("Failed to parse widget elements structure");
        }

        console.log(
          `[DEBUG] Parsed elements, searching for elementId:`,
          elementId,
        );

        // 3. Find the specific element and update its mediaId
        let updated = false;
        const updateRecursive = (data) => {
          if (Array.isArray(data)) {
            data.forEach((item) => updateRecursive(item));
          } else if (typeof data === "object" && data !== null) {
            // Check if this is our target element
            if (data.id === elementId || data.elementId === elementId) {
              console.log(
                `[DEBUG] Found matching element! Old mediaId: ${data.mediaId}, New: ${newMediaId}`,
              );
              // Update the mediaId
              data.mediaId = parseInt(newMediaId); // Xibo expects int usually
              updated = true;
            }
            // Continue deep search
            if (data.elements) updateRecursive(data.elements);
          }
        };

        updateRecursive(elementsData);

        if (!updated) {
          console.error(`[DEBUG] Could not find element with id:`, elementId);
          throw new Error("Could not find the specific element to update");
        }

        // 4. STRICTLY send ONLY elements (not mediaIds)
        // Xibo prioritizes mediaIds over elements, so we must exclude it
        payload = { elements: JSON.stringify(elementsData) };
        console.log("Preparing Elements Update Payload (elements only)");
        console.log(
          `[DEBUG] Payload preview:`,
          payload.elements.substring(0, 200),
        );
      } else {
        // SCENARIO 2: Standard Image/Video Widget (Existing logic)
        payload = { mediaIds: [newMediaId] };
        console.log("Preparing Standard Media Payload");
      }

      // Call backend
      const response = await fetch(`${API_BASE_URL}/widgets/${widgetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to replace media");
      }

      console.log("Media replaced successfully");

      // Close modal
      setReplaceMediaModalState({
        isOpen: false,
        widgetId: null,
        elementId: null,
        currentMediaId: null,
      });

      // Refresh layout to show new media
      await fetchLayoutDetails();
      toast.success("Media replaced");
    } catch (err) {
      console.error("Error replacing media:", err);
      toast.error("Couldn't replace the media", err.message);
    } finally {
      setReplacingWidget(null);
    }
  };

  // ===== CANVAS RENDERING FUNCTIONS =====

  // Render widget content directly (Client-Side Rendering)
  const renderWidgetContent = (widget, width, height) => {
    try {
      if (!widget) return null;

      const moduleName = widget.moduleName?.toLowerCase();
      const type = widget.type?.toLowerCase();

      // 1. Image
      if (moduleName === "image" || type === "image") {
        const mediaId = widget.mediaIds?.[0];
        if (mediaId) {
          return (
            <img
              src={`${API_BASE_URL}/library/thumbnail/${mediaId}`}
              alt={widget.name}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => {
                e.target.src = "https://placehold.co/100x100?text=Image";
              }}
            />
          );
        }
      }

      // 2. Text
      if (moduleName === "text" || type === "text") {
        // Try to extract text content
        let textContent = "Text Widget";
        let style = { color: "#ffffff", fontSize: "14px", textAlign: "center" };

        try {
          let options = widget.widgetOptions || [];
          if (typeof options === "string") {
            try {
              options = JSON.parse(options);
            } catch (e) {
              options = [];
            }
          }

          if (Array.isArray(options)) {
            const textOpt = options.find((o) => o.option === "text");
            if (textOpt) textContent = textOpt.value;
          }

          // Also check elements for more complex text
          const textElements = extractTextElements(widget);
          if (textElements.length > 0) {
            // Just show the first one for preview
            textContent = textElements[0].text;
            style.color = textElements[0].fontColor;
            // Scale font size roughly
            style.fontSize = `${
              parseInt(textElements[0].fontSize) * canvasScale
            }px`;
          }
        } catch (e) {
          console.warn("Error parsing text widget options", e);
        }

        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              overflow: "hidden",
              ...style,
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(textContent) }}
            />
          </div>
        );
      }

      // 3. Video
      if (moduleName === "video" || type === "video") {
        return (
          <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white">
            <i className="fas fa-video text-2xl mb-1"></i>
            <span className="text-xs truncate px-1">{widget.name}</span>
          </div>
        );
      }

      // 4. Dataset
      if (moduleName === "dataset" || type === "dataset") {
        return (
          <div className="flex flex-col items-center justify-center w-full h-full bg-blue-900/50 text-white border border-blue-500/30">
            <i className="fas fa-table text-2xl mb-1"></i>
            <span className="text-xs font-bold">Dataset</span>
            <span className="text-[10px] truncate px-1">{widget.name}</span>
          </div>
        );
      }

      // 5. Clock
      if (moduleName === "clock") {
        return (
          <div className="flex items-center justify-center w-full h-full bg-gray-800 text-white font-mono">
            <span className="text-sm">
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        );
      }

      // Default / Fallback
      return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-gray-800/80 text-gray-400 border border-gray-700">
          <i className="fas fa-cube text-xl mb-1"></i>
          <span className="text-[10px] truncate px-1 max-w-full">
            {widget.name || moduleName}
          </span>
        </div>
      );
    } catch (err) {
      console.error("Error rendering widget content:", err, widget);
      return <div className="text-red-500 text-xs">Error</div>;
    }
  };

  // Handle widget click from canvas - scroll to widget in sidebar
  const handleWidgetClickFromCanvas = (widgetId) => {
    console.log("Widget clicked from canvas:", widgetId);

    // Scroll to widget in sidebar
    const widgetElement = document.getElementById(`widget-${widgetId}`);
    if (widgetElement && sidebarRef.current) {
      widgetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight widget briefly
      widgetElement.classList.add("ring-2", "ring-blue-500");
      setTimeout(() => {
        widgetElement.classList.remove("ring-2", "ring-blue-500");
      }, 2000);
    }
  };

  // ===== END CANVAS RENDERING FUNCTIONS =====

  // ===== RENDER FUNCTIONS =====

  const renderGlobalElements = () => {
    if (!layout?.regions) return null;

    // Find the canvas region (global elements overlay)
    const canvasRegion = layout.regions.find(
      (r) =>
        r.type === "canvas" ||
        r.regionPlaylist?.widgets?.some(
          (w) => w.type === "canvas" || w.type === "global",
        ),
    );

    if (!canvasRegion) return null;

    // The widget type is 'global' in the dump, but could be 'canvas' in other contexts. Check both.
    const canvasWidget = canvasRegion.regionPlaylist.widgets.find(
      (w) => w.type === "canvas" || w.type === "global",
    );
    if (!canvasWidget) return null;

    // Parse elements from widgetOptions
    let elements = [];
    try {
      // widgetOptions is already an object/array in our state, not a string
      let options = canvasWidget.widgetOptions;
      if (typeof options === "string") {
        options = JSON.parse(options);
      }

      const elementsOpt = options.find((opt) => opt.option === "elements");
      if (elementsOpt?.value) {
        const pages =
          typeof elementsOpt.value === "string"
            ? JSON.parse(elementsOpt.value)
            : elementsOpt.value;
        // The structure is Array<{ elements: Array<Element> }>
        if (Array.isArray(pages)) {
          elements = pages
            .flatMap((page) => page.elements || [])
            .map((el) => ({
              ...el,
              elementType: el.id, // Map 'id' to 'elementType'
              // Ensure numeric values are numbers
              width: Number(el.width),
              height: Number(el.height),
              top: Number(el.top),
              left: Number(el.left),
            }));
        }
      }
    } catch (error) {
      console.error("Error parsing global elements:", error);
      return null;
    }

    return (
      <div
        className="designer-region-canvas"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents: "none", // Allow clicks to pass through to regions below
        }}
      >
        {elements.map((element, idx) => (
          <div
            key={`element-${idx}`}
            className="designer-element"
            style={{
              position: "absolute",
              width: `${element.width * canvasScale}px`,
              height: `${element.height * canvasScale}px`,
              top: `${element.top * canvasScale}px`,
              left: `${element.left * canvasScale}px`,
              zIndex: element.layer || 0,
              pointerEvents: "auto", // Re-enable pointer events for elements
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleWidgetClickFromCanvas(canvasWidget.widgetId);
            }}
          >
            <LayoutElement element={element} canvasScale={canvasScale} />
          </div>
        ))}
      </div>
    );
  };

  const renderPlaylistRegion = (region) => {
    const scaledDimensions = {
      width: region.width * canvasScale,
      height: region.height * canvasScale,
      top: region.top * canvasScale,
      left: region.left * canvasScale,
    };

    // Get the first widget to display as preview
    const firstWidget = region.regionPlaylist?.widgets?.[0];

    return (
      <div
        key={`region-${region.regionId}`}
        className={`designer-region designer-region-playlist ${
          selectedRegionId === region.regionId ? "selected" : ""
        }`}
        style={{
          position: "absolute",
          width: `${scaledDimensions.width}px`,
          height: `${scaledDimensions.height}px`,
          top: `${scaledDimensions.top}px`,
          left: `${scaledDimensions.left}px`,
          zIndex: region.zIndex || 0,
          border:
            selectedRegionId === region.regionId
              ? "2px solid #3b82f6"
              : "1px solid rgba(255, 255, 255, 0.2)",
          cursor: "pointer",
          backgroundColor: "rgba(0,0,0,0.2)", // Slight background to see empty regions
        }}
        onClick={() => handleWidgetClickFromCanvas(firstWidget?.widgetId)}
      >
        {firstWidget ? (
          <div className="w-full h-full overflow-hidden">
            {renderWidgetContent(
              firstWidget,
              scaledDimensions.width,
              scaledDimensions.height,
            )}

            {/* Badge for multiple widgets */}
            {region.regionPlaylist?.widgets?.length > 1 && (
              <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
                +{region.regionPlaylist.widgets.length - 1}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-600">
            <span className="text-[10px]">Empty</span>
          </div>
        )}
      </div>
    );
  };

  const renderWidgetRegion = (region) => {
    // For now, renderWidgetRegion and renderPlaylistRegion are basically the same
    // since we are manually rendering content.
    // We can just forward to renderPlaylistRegion or keep separate if we want specific styling.
    return renderPlaylistRegion(region);
  };

  // ===== END RENDER FUNCTIONS =====

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 animate-pulse">
            Loading Layout Designer...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="p-8 bg-gray-800 rounded-lg border border-red-500/30 shadow-xl max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Failed to Load Layout
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!layout) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      <LayoutToolbar
        layout={layout}
        onBack={() => navigate(-1)}
        checkoutLayout={checkoutLayout}
        checkingOut={checkingOut}
        checkoutSuccess={checkoutSuccess}
        publishLayout={publishLayout}
        publishing={publishing}
        publishSuccess={publishSuccess}
      />

      <div className="flex-1 flex overflow-hidden">
        <LayoutCanvas
          containerRef={containerRef}
          layout={layout}
          layoutId={layoutId}
          canvasScale={canvasScale}
          zoomBy={zoomBy}
          zoomFit={zoomFit}
          useLivePreview={useLivePreview}
          setUseLivePreview={setUseLivePreview}
          bgImageUrl={bgImageUrl}
          renderGlobalElements={renderGlobalElements}
          renderWidgetRegion={renderWidgetRegion}
          renderPlaylistRegion={renderPlaylistRegion}
        />

        {/* Right Panel: Layout Details Sidebar */}
        <aside className="w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col shadow-xl z-10">
          <div className="p-5 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
            <h2 className="font-semibold text-white text-lg">
              Layout Structure
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Regions & Widgets Configuration
            </p>
          </div>

          <div className="flex-1 p-4 space-y-8">
            {layout.regions &&
              layout.regions.map((region, rIdx) => (
                  <LayoutRegionPanel
                    key={region.regionId}
                    region={region}
                    rIdx={rIdx}
                    playlistData={playlistData}
                    datasetData={datasetData}
                    loadingWidgetData={loadingWidgetData}
                    editingTextWidgetId={editingTextWidgetId}
                    editingElementId={editingElementId}
                    editingTextValue={editingTextValue}
                    setEditingTextValue={setEditingTextValue}
                    savingText={savingText}
                    startEditing={startEditing}
                    saveText={saveText}
                    cancelEditing={cancelEditing}
                    handleWidgetClick={handleWidgetClick}
                    handleMediaPreview={handleMediaPreview}
                    handleDeletePlaylistMedia={handleDeletePlaylistMedia}
                    handleDeleteRow={handleDeleteRow}
                    setAddMediaModalState={setAddMediaModalState}
                    setAddRowModalState={setAddRowModalState}
                    setReplaceMediaModalState={setReplaceMediaModalState}
                    deletingMediaId={deletingMediaId}
                    deletingRowId={deletingRowId}
                    replacingWidget={replacingWidget}
                  />
              ))}
          </div>
        </aside>
      </div>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        mediaUrl={previewMedia?.url}
        mediaType={previewMedia?.type}
        mediaName={previewMedia?.name}
      />

      {/* Add Media Modal */}
      <AddMediaPlaylistButton
        isOpen={addMediaModalState.isOpen}
        playlistId={addMediaModalState.playlistId}
        onClose={() =>
          setAddMediaModalState({ isOpen: false, playlistId: null })
        }
        onMediaAdded={handleMediaAdded}
        hideTrigger={true}
      />

      {/* Add Row Modal */}
      <AddRowModal
        isOpen={addRowModalState.isOpen}
        onClose={() =>
          setAddRowModalState((prev) => ({ ...prev, isOpen: false }))
        }
        columns={addRowModalState.columns}
        onSave={handleAddRow}
      />

      {/* Checkout Prompt Modal */}
      {showCheckoutPrompt && (
        <CheckoutPrompt
          onGoBack={() => navigate("/dashboard")}
          onCheckout={checkoutLayout}
          checkingOut={checkingOut}
        />
      )}

      {/* Checkout Loading Overlay */}
      {checkingOut && (
        <LoadingOverlay
          title="Preparing your copy…"
          subtitle="Your screens keep playing the current version"
        />
      )}

      {/* Media Picker Modal for Replace Media */}
      <MediaPickerModal
        isOpen={replaceMediaModalState.isOpen}
        onClose={() =>
          setReplaceMediaModalState({
            isOpen: false,
            widgetId: null,
            currentMediaId: null,
          })
        }
        onSelect={handleReplaceMedia}
        currentMediaId={replaceMediaModalState.currentMediaId}
        filterTypes={["image", "video"]}
      />
    </div>
  );
}
