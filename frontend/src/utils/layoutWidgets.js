// Pure helpers for reading Xibo widget options/elements, extracted from
// LayoutDesign. They depend only on their arguments (no component state).

// Read a single option value from a widget's widgetOptions array.
export function getOptionValue(widget, optionName) {
  if (!widget?.widgetOptions || !Array.isArray(widget.widgetOptions)) return null;
  const option = widget.widgetOptions.find((o) => o.option === optionName);
  return option ? option.value : null;
}

// Extract the playlist id from a (sub)playlist widget.
export function getPlaylistId(widget) {
  // 1. Check for subPlaylists option (JSON string)
  const subPlaylistsStr = getOptionValue(widget, "subPlaylists");
  if (subPlaylistsStr) {
    try {
      const subs = JSON.parse(subPlaylistsStr);
      if (Array.isArray(subs) && subs.length > 0 && subs[0].playlistId) {
        return subs[0].playlistId;
      }
    } catch (e) {
      console.warn("Failed to parse subPlaylists JSON", e);
    }
  }

  // 2. Fallback to direct playlistId
  if (widget.playlistId) return widget.playlistId;

  return null;
}

// Extract the dataset id from a dataset widget.
export function getDatasetId(widget) {
  return getOptionValue(widget, "dataSetId");
}

// Extract text elements from a Canvas/Global widget's `elements` option.
export function extractTextElements(widget) {
  const elementsOption = getOptionValue(widget, "elements");
  if (!elementsOption) return [];

  try {
    const elementsData = JSON.parse(elementsOption);
    const textElements = [];

    // Navigate through the elements structure
    if (Array.isArray(elementsData)) {
      elementsData.forEach((page) => {
        if (page.elements && Array.isArray(page.elements)) {
          page.elements.forEach((element) => {
            // Check if this is a text element
            if (
              element.id === "text" ||
              element.type === "text" ||
              (element.properties &&
                element.properties.some((p) => p.id === "text"))
            ) {
              // Extract text value from properties
              const textProp = element.properties?.find((p) => p.id === "text");
              if (textProp && textProp.value) {
                textElements.push({
                  text: textProp.value.trim(),
                  elementId: element.elementId,
                  elementName: element.elementName || "Text Element",
                  fontSize:
                    element.properties?.find((p) => p.id === "fontSize")
                      ?.value || "12",
                  fontColor:
                    element.properties?.find((p) => p.id === "fontColor")
                      ?.value || "#000000",
                  position: {
                    left: element.left,
                    top: element.top,
                    width: element.width,
                    height: element.height,
                  },
                });
              }
            }
          });
        }
      });
    }

    return textElements;
  } catch (e) {
    console.error("Failed to parse elements JSON:", e);
    return [];
  }
}

// Summarize a region's widgets as e.g. "2 Image, 1 Video".
export function getRegionSummary(widgets) {
  if (!widgets || widgets.length === 0) return "Empty";

  const counts = widgets.reduce((acc, widget) => {
    const type = widget.moduleName;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(
      ([type, count]) =>
        `${count} ${type.charAt(0).toUpperCase() + type.slice(1)}`
    )
    .join(", ");
}
