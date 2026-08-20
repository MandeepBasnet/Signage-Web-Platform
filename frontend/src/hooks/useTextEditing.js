import { useRef, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";
import { API_BASE_URL } from "../config/api.js";
import { getOptionValue } from "../utils/layoutWidgets.js";
import { useToast } from "./useToast.js";

// Inline text editing for a widget on the layout canvas.
//
// Editing targets one widget, and optionally one element inside it — a canvas
// widget can hold several text elements, so `elementId` disambiguates which of
// them the edit applies to. Saving rewrites that element's text property inside
// the widget's serialised `elements` option and PUTs the whole widget back,
// which is why the save path is so much longer than the start path.
export function useTextEditing({ layout, layoutId, onRefetch }) {
  const toast = useToast();

  const [editingTextWidgetId, setEditingTextWidgetId] = useState(null);
  const [editingElementId, setEditingElementId] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [savingText, setSavingText] = useState(false);

  const onRefetchRef = useRef(onRefetch);
  onRefetchRef.current = onRefetch;

  const cancelEditing = () => {
    setEditingTextWidgetId(null);
    setEditingElementId(null);
    setEditingTextValue("");
  };

  const startEditing = (widget, currentText, elementId = null) => {
    // Enable direct text editing for all widgets
    setEditingTextWidgetId(String(widget.widgetId));
    setEditingElementId(elementId);
    setEditingTextValue(currentText);
  };

  const saveText = async (widget) => {
    try {
      console.log(
        "[handleTextSave] Widget details:",
        JSON.stringify(widget, null, 2),
      );
      setSavingText(true);

      // Parse current elements to find the text element
      const elementsOption = getOptionValue(widget, "elements");
      let elementsData = [];
      try {
        elementsData = JSON.parse(elementsOption || "[]");
      } catch (e) {
        console.error("Failed to parse elements JSON", e);
        throw new Error("Invalid elements data");
      }

      // Update the text value in the elements structure
      let updated = false;
      if (Array.isArray(elementsData)) {
        elementsData.forEach((page) => {
          if (page.elements && Array.isArray(page.elements)) {
            page.elements.forEach((element) => {
              // If editing a specific element, check ID. Otherwise check generic text type.
              const isTargetElement = editingElementId
                ? element.elementId === editingElementId ||
                  element.id === editingElementId
                : element.id === "text" ||
                  element.type === "text" ||
                  (element.properties &&
                    element.properties.some((p) => p.id === "text"));

              if (isTargetElement) {
                const textProp = element.properties?.find(
                  (p) => p.id === "text",
                );
                if (textProp) {
                  textProp.value = editingTextValue;
                  updated = true;
                }
              }
            });
          }
        });
      }

      if (!updated) {
        throw new Error("Could not find text element to update");
      }

      console.log(
        `[Text Save] Updating widget ${widget.widgetId} with new text elements`,
      );

      console.log(
        `[Text Save] CURRENT LAYOUT CONTEXT: ID=${layoutId}, Status=${layout?.publishedStatusId}`,
      );
      console.log(`[Text Save] Target Widget ID: ${widget.widgetId}`);

      console.log(
        `[Text Save] Elements data:`,
        JSON.stringify(elementsData).substring(0, 300) + "...",
      );

      // BLOCK EDITING IF NOT DRAFT
      // Status 1 = Published, 2 = Draft. Xibo requires Draft to edit.
      // If we are here and status is NOT 2, it means the Auto-Redirect failed or User is in a weird state.
      if (
        layout?.publishedStatusId &&
        String(layout.publishedStatusId) !== "2"
      ) {
        const msg = `Layout ${layoutId} is not a draft (publishedStatusId=${layout.publishedStatusId}); refusing to edit.`;
        toast.error(
          "This layout is read-only",
          "Reload the page to switch to the editable copy."
        );
        throw new Error(msg);
      }

      // ✅ SOLUTION: Use URLSearchParams for application/x-www-form-urlencoded
      // Xibo API v4 explicitly requires this content type for PUT requests
      const params = new URLSearchParams();

      // SANITIZATION: Filter out purely undefined properties, but ALLOW nulls (as per reference logs)
      // Use deep clone to avoid mutating original state
      let parsedElements =
        typeof elementsData === "string"
          ? JSON.parse(elementsData)
          : JSON.parse(JSON.stringify(elementsData));

      // Helper to clean properties recursively
      const cleanElementData = (data) => {
        if (Array.isArray(data)) {
          return data.map(cleanElementData);
        } else if (typeof data === "object" && data !== null) {
          const newData = { ...data };

          // If this is a widget options/properties object, filter only undefined items or truly invalid ones
          // Reference logs show "value": null is VALID.
          if (Array.isArray(newData.properties)) {
            newData.properties = newData.properties.filter(
              (prop) =>
                prop && typeof prop.id !== "undefined" && prop.id !== null,
              // ALLOW value: null or empty string
            );
          }
          // Check for 'elements' array inside (nested structure)
          if (Array.isArray(newData.elements)) {
            newData.elements = newData.elements.map(cleanElementData);
          }
          return newData;
        }
        return data;
      };

      parsedElements = cleanElementData(parsedElements);

      // Ensure elements is a string, not an object/array, when sending to Xibo
      const elementsStr = JSON.stringify(parsedElements);

      console.log(`[Text Save] Final elements JSON for Xibo:`, elementsStr);

      // We append it to params as usual, but backend will extract it to send as raw body if needed
      params.append("elements", elementsStr);

      console.log(
        `[Text Save] URLSearchParams prepared with elements (${elementsStr.length} chars)`,
      );

      const response = await fetch(
        `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            // Content-Type will be automatically set to application/x-www-form-urlencoded by the browser
            // when using URLSearchParams as body
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );

      console.log(
        `[Text Save] Response status: ${response.status} ${response.statusText}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Text Save] ✗ API Error:`, errorData);
        throw new Error(
          errorData.message ||
            `API returned ${response.status}: ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log(
        `[Text Save] ✓ Successfully updated widget ${widget.widgetId}`,
      );
      console.log(`[Text Save] Response:`, result);

      // Refresh layout to show changes
      await onRefetchRef.current?.();

      setEditingTextWidgetId(null);
      setEditingElementId(null);
      setEditingTextValue("");
      toast.success("Text updated");
    } catch (err) {
      console.error("[handleTextSave] ✗ Error updating text:", err);
      console.error("[handleTextSave] Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });

      toast.error("Couldn't save the text", err.message);
    } finally {
      setSavingText(false);
    }
  };

  return {
    editingTextWidgetId,
    editingElementId,
    editingTextValue,
    setEditingTextValue,
    savingText,
    startEditing,
    saveText,
    cancelEditing,
  };
}
