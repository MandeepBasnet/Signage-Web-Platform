import DOMPurify from "dompurify";
import { API_BASE_URL } from "../config/api.js";

// Renders a single global/canvas element preview (image or text) scaled to the
// canvas. Presentational — depends only on the element and the canvas scale.
export default function LayoutElement({ element, canvasScale }) {
  if (element.elementType === "global_library_image") {
    return (
      <div style={{ all: "initial", display: "block", width: 0, height: 0 }}>
        <div
          className="element-content"
          style={{
            width: `${element.width}px`,
            height: `${element.height}px`,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="global-elements-image img-container"
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={`${API_BASE_URL}/library/download/${element.mediaId}?preview=1`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center middle",
                opacity: "100%",
                position: "absolute",
                top: 0,
                left: 0,
              }}
              alt=""
            />
          </div>
        </div>
      </div>
    );
  }

  if (element.elementType === "text") {
    // Extract text properties
    const text = element.text || "";
    const fontSize = element.fontSize || 40;
    const fontColor = element.fontColor || "#ffffff";
    const textAlign = element.horizontalAlign || "center";
    const verticalAlign = element.verticalAlign || "center";

    return (
      <div style={{ all: "initial", display: "block", width: 0, height: 0 }}>
        <div
          className="element-content"
          style={{
            width: `${element.width}px`,
            height: `${element.height}px`,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="global-elements-text"
            style={{
              display: "flex",
              fontSize: `${fontSize}px`,
              color: fontColor,
              overflow: "visible",
              justifyContent: textAlign,
              textAlign: textAlign,
              alignItems: verticalAlign,
              whiteSpace: "break-spaces",
              lineHeight: 1.2,
              width: "100%",
              height: "100%",
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  // Unknown element type — render nothing.
  return null;
}
