import { useEffect, useRef, useState } from "react";

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;

// Canvas sizing for the layout designer.
//
// The canvas auto-fits its container until the user zooms manually, at which
// point auto-fit switches off and stays off until they hit Fit or open a
// different layout. Attach the returned ref to the element the canvas should
// fit inside — it is measured with a ResizeObserver.
export function useCanvasZoom(layout) {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [canvasScale, setCanvasScale] = useState(0.1);
  const [autoFit, setAutoFit] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const calculateCanvasScale = () => {
    if (!layout?.width || !layout?.height) return 0.1;

    const { width: cw, height: ch } = containerSize;
    // Before the container is measured, fall back to a width-based estimate.
    if (!cw || !ch) return Math.min(800 / layout.width, 0.5);

    // Fit the layout inside the available area in BOTH dimensions so the canvas
    // matches the layout's true aspect (portrait fits height, landscape fits
    // width) instead of overflowing. Never upscale past 100%.
    const padding = 48;
    const availW = Math.max(cw - padding, 50);
    const availH = Math.max(ch - padding, 50);
    return Math.min(availW / layout.width, availH / layout.height, 1);
  };

  // Auto-fit the canvas to the viewport (unless the user has manually zoomed).
  useEffect(() => {
    if (layout && autoFit) {
      setCanvasScale(calculateCanvasScale());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, containerSize, autoFit]);

  // A newly loaded layout should re-enable auto-fit.
  useEffect(() => {
    setAutoFit(true);
  }, [layout?.layoutId]);

  const zoomBy = (factor) => {
    setAutoFit(false);
    setCanvasScale((s) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s * factor)));
  };

  const zoomFit = () => {
    setAutoFit(true);
    setCanvasScale(calculateCanvasScale());
  };

  return { containerRef, canvasScale, zoomBy, zoomFit };
}
