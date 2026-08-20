// The info/zoom bar shown under the designer canvas: zoom out/in/fit, the
// current scale + layout dimensions, and the live-preview/structure toggle.
// Presentational — all state and handlers live in the parent.
export default function CanvasControls({
  onZoomOut,
  onZoomIn,
  onZoomFit,
  scale,
  width,
  height,
  useLivePreview,
  onTogglePreview,
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500 font-mono flex-wrap">
      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="w-7 h-7 flex items-center justify-center rounded-md text-base font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={onZoomIn}
          className="w-7 h-7 flex items-center justify-center rounded-md text-base font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={onZoomFit}
          className="px-2 h-7 flex items-center justify-center rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          title="Fit to screen"
          aria-label="Fit layout to screen"
        >
          Fit
        </button>
      </div>
      <p>
        {(scale * 100).toFixed(0)}% • {width} × {height}px
      </p>
      <button
        onClick={onTogglePreview}
        className="px-3 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
        title="Switch between Xibo's faithful preview and the editable structure view"
      >
        {useLivePreview ? "Show structure view" : "Show live preview"}
      </button>
    </div>
  );
}
