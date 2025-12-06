# Text Element Editing - API Limitation Discovery

**Date:** December 6, 2025  
**Status:** ⚠️ Xibo API Limitation Confirmed  
**Issue:** 422 "Invalid element JSON"

---

## Current Situation

### What's Working ✅
1. ✅ FormData is being sent correctly from frontend
2. ✅ Multer is parsing the multipart/form-data correctly
3. ✅ Backend receives the elements data properly
4. ✅ Data is converted to form-urlencoded for Xibo API
5. ✅ Request reaches Xibo API successfully

### What's Failing ❌
**Xibo API Response:**
```
Status: 422 Unprocessable Entity
Message: "Invalid element JSON"
Property: "body"
```

---

## Root Cause Analysis

### Research Findings

According to Xibo CMS documentation:
> **"Elements cannot be added via the API directly"**  
> **"canvas : These are for elements and are not yet available via the API"**

Source: Xibo official documentation

### What This Means

1. The `/playlist/widget/{widgetId}/elements` endpoint exists
2. BUT it has **strict validation** on the JSON structure
3. Canvas/Global widget elements may have **limited API support**
4. The endpoint might be for **internal use only** or **specific widget types**

---

## Technical Details

### Request Being Sent

**Endpoint:** `PUT /api/playlist/widget/19892/elements`  
**Content-Type:** `application/x-www-form-urlencoded` (after backend conversion)  
**Data:**
```
elements=[{"elements":[{"id":"global_library_image",...}]}]
```

**Data Structure:**
- Array with 1 object
- Object has "elements" property
- Elements array contains 3 items (image + 2 text elements)

### Xibo API Expectation

The API might be expecting:
1. Different JSON structure (flatter?)
2. Different property names
3. Specific widget type compatibility
4. Additional metadata fields

---

## Possible Solutions

### Option 1: Try Alternative JSON Structure

The current structure is:
```json
[{"elements":[...]}]  // Array wrapping object
```

Try sending just:
```json
{"elements":[...]}  // Direct object
```

Or even:
```json
[...]  // Just the elements array
```

### Option 2: Use Widget Properties Endpoint

Instead of `/playlist/widget/{id}/elements`, try:
```
PUT /playlist/widget/{id}
```

With elements as a property:
```
properties: {
  elements: JSON.stringify([...])
}
```

### Option 3: Accept the Limitation

**Recommendation:** Based on Xibo documentation stating elements cannot be added via API, we should:

1. **Re-enable the blocking alert** with updated message
2. **Provide "Edit in Xibo CMS" button** that opens the official interface
3. **Document this as a known limitation**
4. **Focus on other widget types** that DO support API editing

---

## Implementation Decision

### Recommended Approach: Hybrid Solution

1. **Keep the FormData implementation** (it's correct)
2. **Add detection for Canvas/Global widgets**
3. **Show informative message** with link to Xibo CMS
4. **Allow editing for other widget types** (if they work)

### Code Changes Needed

```javascript
// In LayoutDesign.jsx - handleTextDoubleClick
const handleTextDoubleClick = (widget, currentText, elementId = null) => {
  // Check if this is a Canvas/Global widget
  if (widget.type === "canvas" || widget.type === "global" || widget.type === "core-canvas") {
    // Show informative dialog with option to open Xibo CMS
    const openXibo = confirm(
      "⚠️ Canvas Widget Editing Limitation\n\n" +
      "Due to Xibo API restrictions, Canvas/Global widget elements cannot be edited through this interface.\n\n" +
      "Would you like to open this layout in the official Xibo CMS to make your changes?\n\n" +
      "Click OK to open Xibo CMS, or Cancel to stay here."
    );
    
    if (openXibo) {
      const xiboUrl = `https://portal.signage-lab.com/layout/designer/${layoutId}`;
      window.open(xiboUrl, '_blank');
    }
    return;
  }
  
  // For other widget types, proceed with editing
  setEditingTextWidgetId(String(widget.widgetId));
  setEditingElementId(elementId);
  setEditingTextValue(currentText);
};
```

---

## Alternative: Try Direct Xibo API Test

Before giving up, let's test the exact format Xibo expects:

### Test 1: Simplified Structure
```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'elements={"elements":[...]}' \
  https://portal.signage-lab.com/api/playlist/widget/19892/elements
```

### Test 2: Just Array
```bash
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'elements=[...]' \
  https://portal.signage-lab.com/api/playlist/widget/19892/elements
```

### Test 3: Check Widget Type Support
Maybe only certain widget types support element editing via API.

---

## Next Steps

1. **Try simplified JSON structure** (remove outer array wrapper)
2. **If that fails, implement hybrid solution** (block Canvas, allow others)
3. **Document the limitation** clearly for users
4. **Provide seamless Xibo CMS integration** for Canvas editing

---

## User Impact

### Current Behavior
- User can double-click text
- Edit dialog appears
- Save fails with error message

### Proposed Behavior
- User double-clicks text in Canvas widget
- Informative dialog appears
- Option to open in Xibo CMS
- Seamless transition to official editor

---

**Status:** Awaiting decision on next approach  
**Recommendation:** Try simplified JSON structure first, then implement hybrid solution
