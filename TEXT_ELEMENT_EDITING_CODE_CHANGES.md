# Text Element Editing Fix - Exact Code Changes

## File 1: Frontend Changes

**Location:** `frontend/src/components/LayoutDesign.jsx` (Lines 1081-1211)

### Changed Section: `handleTextSave()` Function

```javascript
const handleTextSave = async (widget) => {
  try {
    console.log(
      "[handleTextSave] Widget details:",
      JSON.stringify(widget, null, 2)
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
              const textProp = element.properties?.find((p) => p.id === "text");
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
      `[Text Save] Updating widget ${widget.widgetId} with new text elements`
    );
    console.log(
      `[Text Save] Elements data:`,
      JSON.stringify(elementsData).substring(0, 300) + "..."
    );

    // ✅ SOLUTION 1: Use FormData API for proper form encoding
    // FormData automatically handles encoding of form fields correctly
    const formDataObj = new FormData();
    const elementsStr = JSON.stringify(elementsData);
    formDataObj.append("elements", elementsStr);

    console.log(
      `[Text Save] FormData prepared with elements (${elementsStr.length} chars)`
    );
    console.log(`[Text Save] Auth headers:`, Object.keys(getAuthHeaders()));

    const response = await fetch(
      `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
      {
        method: "PUT",
        // ⚠️ DO NOT set Content-Type - let FormData set it automatically with boundary
        // Browser will automatically set: Content-Type: multipart/form-data; boundary=...
        headers: {
          ...getAuthHeaders(),
        },
        body: formDataObj,
      }
    );

    console.log(
      `[Text Save] Response status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Text Save] ✗ API Error:`, errorData);
      throw new Error(
        errorData.message ||
          `API returned ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log(`[Text Save] ✓ Successfully updated widget ${widget.widgetId}`);
    console.log(`[Text Save] Response:`, result);

    // Refresh layout to show changes
    await fetchLayoutDetails();

    setEditingTextWidgetId(null);
    setEditingElementId(null);
    setEditingTextValue("");
    alert("✓ Text updated successfully!");
  } catch (err) {
    console.error("[handleTextSave] ✗ Error updating text:", err);
    console.error("[handleTextSave] Error details:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    // ⚠️ FALLBACK: Offer to redirect to Xibo CMS portal for manual editing
    const shouldRedirect = confirm(
      `Failed to update text through web interface:\n\n"${err.message}"\n\n` +
        `Would you like to open this layout in Xibo CMS (Portal) for manual editing?\n\n` +
        `Click OK to open Xibo CMS, or Cancel to dismiss.`
    );

    if (shouldRedirect) {
      const xiboUrl = `https://portal.signage-lab.com/layout/designer/${layoutId}`;
      console.log(`[handleTextSave] Redirecting to Xibo CMS: ${xiboUrl}`);
      window.open(xiboUrl, "_blank", "noopener,noreferrer");
    }
  } finally {
    setSavingText(false);
  }
};
```

---

## File 2: Backend Changes

**Location:** `backend/src/controllers/widgetController.js` (Lines 121-180)

### Changed Section: `updateWidgetElements()` Function

```javascript
/**
 * Update widget elements (for canvas/global widgets)
 * PUT /api/playlists/widgets/:widgetId/elements
 *
 * This endpoint handles updating the elements array within a widget
 * Used primarily for text editing in canvas widgets
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateWidgetElements = async (req, res) => {
  const { widgetId } = req.params;
  const { elements } = req.body;

  try {
    const { token } = getUserContext(req);

    if (!widgetId) {
      return res.status(400).json({ message: "Widget ID is required" });
    }

    if (!elements) {
      return res.status(400).json({ message: "Elements data is required" });
    }

    console.log(`[updateWidgetElements] Updating widget ${widgetId}`);
    console.log(
      `[updateWidgetElements] Request Content-Type:`,
      req.headers["content-type"]
    );
    console.log(`[updateWidgetElements] Elements type:`, typeof elements);
    console.log(`[updateWidgetElements] Elements length:`, elements?.length);

    // ✅ ENHANCED: Log data preview for debugging
    console.log(
      `[updateWidgetElements] Elements preview:`,
      typeof elements === "string"
        ? elements.substring(0, 300) + (elements.length > 300 ? "..." : "")
        : JSON.stringify(elements).substring(0, 300) + "..."
    );

    // ✅ IMPROVED: Log what we're sending to Xibo API
    console.log(`[updateWidgetElements] Preparing to send to Xibo API:`);
    console.log(`  - Endpoint: /playlist/widget/${widgetId}/elements`);
    console.log(`  - Method: PUT`);
    console.log(`  - Data keys:`, Object.keys({ elements }));

    // Xibo API expects form-urlencoded data
    // xiboRequest handles the conversion for PUT requests automatically
    // Send as form-urlencoded (Xibo API expects this for PUT requests)
    const result = await xiboRequest(
      `/playlist/widget/${widgetId}/elements`,
      "PUT",
      { elements }, // Pass as object - xiboClient will convert to form data
      token
      // Don't force JSON - let it use form-urlencoded for PUT
    );

    console.log(
      `[updateWidgetElements] ✓ Successfully updated widget ${widgetId}`
    );
    console.log(`[updateWidgetElements] Xibo response:`, result);
    res.json(result);
  } catch (err) {
    console.error(
      `[updateWidgetElements] ✗ Error updating widget ${widgetId}:`,
      err.message
    );

    // ✅ ENHANCED: Log full error details for debugging
    if (err.response) {
      console.error(
        `[updateWidgetElements] Response status:`,
        err.response.status
      );
      console.error(
        `[updateWidgetElements] Response statusText:`,
        err.response.statusText
      );
      console.error(
        `[updateWidgetElements] Response data (first 500 chars):`,
        typeof err.response.data === "string"
          ? err.response.data.substring(0, 500)
          : JSON.stringify(err.response.data).substring(0, 500)
      );
      console.error(`[updateWidgetElements] Response headers:`, {
        contentType: err.response.headers["content-type"],
        contentLength: err.response.headers["content-length"],
      });
    } else {
      console.error(
        `[updateWidgetElements] No response received:`,
        err.code || "Unknown error"
      );
      console.error(`[updateWidgetElements] Request config:`, {
        url: err.config?.url,
        method: err.config?.method,
        dataType: typeof err.config?.data,
      });
    }

    handleControllerError(res, err, "Failed to update widget elements");
  }
};
```

---

## Key Differences

### FormData vs URLSearchParams

**URLSearchParams (OLD):**

```javascript
const formData = new URLSearchParams();
formData.append("elements", JSON.stringify(elementsData));

fetch(url, {
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    ...getAuthHeaders(),
  },
  body: formData,
});
```

**FormData (NEW):**

```javascript
const formDataObj = new FormData();
formDataObj.append("elements", JSON.stringify(elementsData));

fetch(url, {
  headers: {
    ...getAuthHeaders(),
    // NO Content-Type header - browser sets it
  },
  body: formDataObj,
});
```

### Why FormData Works Better

| Aspect              | URLSearchParams                          | FormData                      |
| ------------------- | ---------------------------------------- | ----------------------------- |
| **Encoding**        | Manual application/x-www-form-urlencoded | Automatic multipart/form-data |
| **Boundary**        | Not needed                               | Browser generates boundary    |
| **Large Data**      | Can break                                | Handles well with multipart   |
| **File Support**    | No                                       | Yes (future-proof)            |
| **Browser Support** | All                                      | All (native API)              |

---

## Console Output Examples

### Success Case

```
[handleTextSave] Widget details: {...}
[Text Save] Updating widget 123 with new text elements
[Text Save] Elements data: [{"elements":[{"properties":[{"id":"text","value":"New Text"}]}]}]...
[Text Save] FormData prepared with elements (245 chars)
[Text Save] Auth headers: Authorization
[Text Save] Response status: 200 OK
[Text Save] ✓ Successfully updated widget 123
[Text Save] Response: {...}
✓ Text updated successfully!

[updateWidgetElements] Updating widget 123
[updateWidgetElements] Request Content-Type: multipart/form-data; boundary=----WebKit...
[updateWidgetElements] Elements type: string
[updateWidgetElements] Elements length: 245
[updateWidgetElements] Preparing to send to Xibo API:
  - Endpoint: /playlist/widget/123/elements
  - Method: PUT
  - Data keys: elements
[updateWidgetElements] ✓ Successfully updated widget 123
[updateWidgetElements] Xibo response: {...}
```

### Error Case (Before Fallback)

```
[handleTextSave] Widget details: {...}
[Text Save] Updating widget 123...
[Text Save] Response status: 400 Bad Request
[Text Save] ✗ API Error: {message: "Invalid elements format"}
[handleTextSave] ✗ Error updating text: Error: Invalid elements format
[handleTextSave] Error details: {name: "Error", message: "Invalid elements format", stack: "..."}

[Confirmation Dialog appears]
User clicks OK → Opens Xibo CMS portal in new tab
```

---

## No Changes to xiboClient

The `xiboClient.js` file **does not need changes** because it already:

1. ✅ Detects PUT requests
2. ✅ Converts data to URLSearchParams for form-urlencoded
3. ✅ Sets correct Content-Type header
4. ✅ Sends to Xibo API

The frontend fix (FormData) ensures proper encoding at the browser level before reaching the backend.

---

## Testing the Changes

### Test 1: Check FormData Encoding

```javascript
// Open browser console, run:
const fd = new FormData();
fd.append("elements", JSON.stringify({ test: "data" }));
console.log([...fd.entries()]);
// Output: [["elements", '{"test":"data"}']]
```

### Test 2: Verify Content-Type

```javascript
// In Network tab (DevTools), when saving text:
// Look at Request Headers:
// Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

### Test 3: Monitor Console Logs

```javascript
// Open DevTools Console tab
// Look for: [handleTextSave] and [updateWidgetElements] logs
// Should show: Response status: 200 OK or error details
```

---

## Rollback if Needed

```bash
# If the fix causes issues, revert:
git checkout frontend/src/components/LayoutDesign.jsx
git checkout backend/src/controllers/widgetController.js
```

---

**Implementation Complete:** December 6, 2025
