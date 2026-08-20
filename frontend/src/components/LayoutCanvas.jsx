import CanvasControls from "./CanvasControls.jsx";
import { API_BASE_URL } from "../config/api.js";
import { getStoredToken } from "../utils/auth.js";

// The design surface. Two mutually exclusive renderings of the same layout:
// Xibo's own renderer in a reverse-proxied iframe (faithful, but opaque), or
// our own reconstruction from regions and widgets (editable, but approximate).
//
// The three render* callbacks still belong to LayoutDesign — they read a lot of
// its state. Passing them in keeps this extraction pure; folding them in here
// is a later step.
export default function LayoutCanvas({
  containerRef,
  layout,
  layoutId,
  canvasScale,
  zoomBy,
  zoomFit,
  useLivePreview,
  setUseLivePreview,
  bgImageUrl,
  renderGlobalElements,
  renderWidgetRegion,
  renderPlaylistRegion,
}) {
  return (
    <main
      className="flex-1 bg-gray-950 relative overflow-auto"
      ref={containerRef}
    >
      {/* Grid Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Centering, scrollable area: centers the canvas when it fits, and
          scrolls (vertical + horizontal) when zoomed beyond the viewport. */}
      <div className="min-w-full min-h-full flex items-center justify-center p-8">
        {/* Canvas Wrapper for Centering and Scaling */}
        <div
          className="relative"
          style={{
            background: "rgb(243, 248, 255)",
            padding: "20px",
            boxShadow: "0 0 50px rgba(0,0,0,0.5)",
          }}
        >
        {/* Main layout container with scaled dimensions */}
        <div
          className="layout-player relative mx-auto bg-black shadow-2xl overflow-hidden"
          style={{
            width: `${layout.width * canvasScale}px`,
            height: `${layout.height * canvasScale}px`,
            background: layout.backgroundColor || "#000",
            backgroundImage:
              !useLivePreview && bgImageUrl
                ? `url(${bgImageUrl})`
                : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {useLivePreview ? (
            /* Faithful preview: Xibo's own renderer at native resolution,
               scaled down to the canvas. Reverse-proxied via the backend so
               all sub-resources (media/JS/CSS) load through the web session. */
            <iframe
              key={`live-${layoutId}`}
              title="Layout preview"
              src={`${API_BASE_URL}/layouts/${layoutId}/live-preview?token=${getStoredToken()}`}
              style={{
                width: `${layout.width}px`,
                height: `${layout.height}px`,
                border: "none",
                transform: `scale(${canvasScale})`,
                transformOrigin: "top left",
              }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            /* Structure view: our reconstruction (region/widget overlays). */
            <div className="layout-live-preview relative w-full h-full">
              {/* Global elements layer (canvas region) */}
              {renderGlobalElements()}

              {/* Regular regions container */}
              <div className="regions-container relative w-full h-full">
                {layout.regions
                  ?.filter(
                    (region) =>
                      !region.regionPlaylist?.widgets?.some(
                        (w) => w.type === "canvas",
                      ),
                  )
                  .map((region) => {
                    const firstWidget = region.regionPlaylist?.widgets?.[0];

                    // Determine region type and render accordingly
                    if (!firstWidget) return null;

                    // Dataset, embedded content, or specific widget types use iframes
                    // Check both moduleName and type to be safe
                    const moduleName = (
                      firstWidget.moduleName || ""
                    ).toLowerCase();
                    const type = (firstWidget.type || "").toLowerCase();

                    if (
                      moduleName === "dataset" ||
                      moduleName === "embedded" ||
                      moduleName === "ticker" ||
                      type === "dataset" ||
                      type === "embedded" ||
                      type === "ticker"
                    ) {
                      return renderWidgetRegion(region);
                    }

                    // Playlist regions (images, videos, etc.) use preview HTML
                    return renderPlaylistRegion(region);
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Canvas info display */}
        <CanvasControls
          onZoomOut={() => zoomBy(0.8)}
          onZoomIn={() => zoomBy(1.25)}
          onZoomFit={zoomFit}
          scale={canvasScale}
          width={layout.width}
          height={layout.height}
          useLivePreview={useLivePreview}
          onTogglePreview={() => setUseLivePreview((v) => !v)}
        />
        </div>
      </div>
    </main>
  );
}
