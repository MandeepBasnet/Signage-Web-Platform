# Text Element Editing Fix - Implementation Task

**Created:** December 6, 2025  
**Priority:** 🔴 CRITICAL  
**Status:** Ready for Implementation  
**Estimated Time:** 4-6 hours

---

## Executive Summary

This task addresses the persistent issue where text elements in Canvas/Global widgets cannot be saved after a layout is checked out to draft status. The root cause has been identified as a **content-type mismatch** between the frontend, backend, and Xibo CMS API, combined with potential widget ID lifecycle management issues.

### Core Problem

1. **Frontend** sends `Content-Type: application/json` with JSON body
2. **Backend** converts to `application/x-www-form-urlencoded` (Xibo API requirement)
3. **Data transformation** during conversion causes the `elements` parameter to become malformed
4. **Xibo API** rejects the request with ambiguous error messages

### Key Findings from Research

Based on Xibo CMS documentation and community resources:

- ✅ **All PUT requests to Xibo CMS API MUST use `application/x-www-form-urlencoded`** [Confirmed]
- ✅ **Widget IDs remain the same** between published and draft layouts (not a bug, by design)
- ✅ **Canvas/Global widget elements** have limited API support but CAN be edited via `/playlist/widget/{widgetId}/elements`
- ⚠️ **Direct element manipulation** has known limitations in Xibo API

---

## Root Cause Analysis

### Issue 1: Content-Type Handling Mismatch

**Location:** `frontend/src/components/LayoutDesign.jsx` (Lines 1163-1175)

```javascript
// ❌ CURRENT: Frontend sends JSON
const response = await fetch(
  `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",  // ← Frontend declares JSON
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      elements: JSON.stringify(elementsData),  // ← Nested stringification
    }),
  }
);
```

**Location:** `backend/src/utils/xiboClient.js` (Lines 309-319)

```javascript
// Backend converts to form-urlencoded
if (isPutRequest && !isJsonPut) {
  const params = new URLSearchParams();
  Object.keys(data).forEach((key) => {
    params.append(key, String(data[key]));  // ← Converts JSON string to URL-encoded
  });
  requestConfig.data = params;
  requestConfig.headers["Content-Type"] = "application/x-www-form-urlencoded";
}
```

**Problem:** The `elements` value (a long JSON string) gets URL-encoded, but the structure becomes invalid for Xibo API parsing.

### Issue 2: Widget ID Lifecycle Confusion

**Location:** `frontend/src/components/LayoutDesign.jsx` (Lines 1069-1082)

The code has defensive comments suggesting widget IDs change during checkout, but research confirms they **don't change**. However, there may be stale references in component state after checkout.

---

## Implementation Plan

### Phase 1: Fix Content-Type Handling (IMMEDIATE - 2 hours)

#### Option A: Use FormData API (RECOMMENDED)

**Why:** Aligns with Xibo API design, works with existing backend logic.

**Changes Required:**

##### 1.1 Update Frontend - `LayoutDesign.jsx`

**File:** `frontend/src/components/LayoutDesign.jsx`  
**Function:** `handleTextSave` (Lines 1089-1197)

```javascript
// ✅ SOLUTION: Use FormData instead of JSON
const handleTextSave = async (widget) => {
  try {
    // ... existing validation code ...

    // Parse and update elements
    const elementsOption = getOptionValue(widget, "elements");
    let elementsData = [];
    try {
      elementsData = JSON.parse(elementsOption || "[]");
    } catch (e) {
      console.error("Failed to parse elements JSON", e);
      throw new Error("Invalid elements data");
    }

    // Update the text value in elements structure
    // ... existing update logic ...

    console.log(`[Text Save] Updating widget ${widget.widgetId} with new text elements`);

    // ✅ NEW: Create FormData instead of JSON
    const formData = new FormData();
    formData.append("elements", JSON.stringify(elementsData));

    const response = await fetch(
      `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
      {
        method: "PUT",
        headers: getAuthHeaders(), // ❌ REMOVE Content-Type header - let browser set it
        body: formData, // ✅ Send FormData instead of JSON
      }
    );

    // ... rest of the function ...
  } catch (err) {
    console.error("Error updating text:", err);
    alert(`Failed to update text: ${err.message}`);
  } finally {
    setSavingText(false);
  }
};
```

**Key Changes:**
- Replace `JSON.stringify(body)` with `FormData`
- Remove explicit `Content-Type: application/json` header
- Let browser automatically set `Content-Type: multipart/form-data` with boundary

##### 1.2 Verify Backend Handling - `widgetController.js`

**File:** `backend/src/controllers/widgetController.js`  
**Function:** `updateWidgetElements` (Lines 117-165)

**Current code is CORRECT** - no changes needed. The backend already:
- Accepts `elements` from request body
- Passes to `xiboRequest` which handles form-urlencoded conversion
- Logs appropriately

##### 1.3 Test with Direct API Call

Before implementing, test the Xibo API directly:

```bash
# Test 1: Verify endpoint accepts form-urlencoded
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "elements=%5B%7B%22elements%22%3A%5B%7B%22id%22%3A%22text%22%2C%22properties%22%3A%5B%7B%22id%22%3A%22text%22%2C%22value%22%3A%22Test%22%7D%5D%7D%5D%7D%5D" \
  https://portal.signage-lab.com/api/playlist/widget/WIDGET_ID/elements

# Test 2: Verify widget ID is valid in draft layout
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://portal.signage-lab.com/api/layout/DRAFT_LAYOUT_ID?embed=regions,playlists,widgets
```

---

### Phase 2: Improve State Management (SHORT-TERM - 2 hours)

#### 2.1 Ensure Fresh Widget IDs After Checkout

**File:** `frontend/src/components/LayoutDesign.jsx`  
**Function:** `handleAutoCheckout` (Lines 947-1067)

**Current behavior:** Forces full page reload after checkout ✅ (This is GOOD)

**Verify:** The `window.location.href` redirect ensures complete component re-mount with fresh data.

**Additional safeguard:** Add state reset before save operations

```javascript
const handleTextSave = async (widget) => {
  try {
    // ✅ DEFENSIVE: Verify widget belongs to current layout
    const currentWidget = layout?.regions
      ?.flatMap(r => r.regionPlaylist?.widgets || [])
      ?.find(w => String(w.widgetId) === String(widget.widgetId));

    if (!currentWidget) {
      throw new Error(
        `Widget ${widget.widgetId} not found in current layout. ` +
        `This may indicate stale state. Please refresh the page.`
      );
    }

    // Use currentWidget instead of passed widget to ensure fresh data
    const elementsOption = getOptionValue(currentWidget, "elements");
    
    // ... rest of save logic ...
  }
};
```

#### 2.2 Add Better Error Logging

**File:** `backend/src/controllers/widgetController.js`

```javascript
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
    console.log(`[updateWidgetElements] Elements type:`, typeof elements);
    console.log(`[updateWidgetElements] Elements length:`, elements?.length);
    
    // ✅ NEW: Log the actual data being sent to Xibo
    console.log(`[updateWidgetElements] Elements preview:`, 
      typeof elements === 'string' 
        ? elements.substring(0, 200) 
        : JSON.stringify(elements).substring(0, 200)
    );

    const result = await xiboRequest(
      `/playlist/widget/${widgetId}/elements`,
      "PUT",
      { elements },
      token
    );

    console.log(`[updateWidgetElements] ✓ Successfully updated widget ${widgetId}`);
    res.json(result);
  } catch (err) {
    console.error(`[updateWidgetElements] ✗ Error updating widget ${widgetId}:`, err.message);
    
    // ✅ NEW: Log full error details
    if (err.response) {
      console.error(`[updateWidgetElements] Response status:`, err.response.status);
      console.error(`[updateWidgetElements] Response data:`, err.response.data);
      console.error(`[updateWidgetElements] Response headers:`, err.response.headers);
    }
    
    handleControllerError(res, err, "Failed to update widget elements");
  }
};
```

---

### Phase 3: Enhanced Error Handling (SHORT-TERM - 1 hour)

#### 3.1 User-Friendly Error Messages

**File:** `frontend/src/components/LayoutDesign.jsx`

```javascript
const handleTextSave = async (widget) => {
  try {
    // ... save logic ...

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // ✅ NEW: Provide specific error messages based on status
      let errorMessage = "Failed to update text";
      
      if (response.status === 422) {
        errorMessage = 
          "Layout is not in draft state. Please ensure the layout is checked out before editing.";
      } else if (response.status === 404) {
        errorMessage = 
          "Widget not found. The layout may have been modified. Please refresh the page.";
      } else if (response.status === 400) {
        errorMessage = 
          `Invalid request: ${errorData.message || 'The elements data format is incorrect.'}`;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
      
      throw new Error(errorMessage);
    }

    // ... success handling ...
  } catch (err) {
    console.error("Error updating text:", err);
    
    // ✅ NEW: Show detailed error in development
    if (import.meta.env.DEV) {
      console.error("Full error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response
      });
    }
    
    alert(`Failed to update text: ${err.message}`);
  } finally {
    setSavingText(false);
  }
};
```

---

### Phase 4: Testing & Validation (2 hours)

#### 4.1 Unit Tests

**File:** `backend/src/controllers/__tests__/widgetController.test.js` (NEW)

```javascript
import { updateWidgetElements } from '../widgetController.js';
import { xiboRequest } from '../../utils/xiboClient.js';

jest.mock('../../utils/xiboClient.js');

describe('widgetController - updateWidgetElements', () => {
  test('should send form-urlencoded data to Xibo API', async () => {
    const mockReq = {
      params: { widgetId: '123' },
      body: { elements: '[{"elements":[]}]' },
      header: jest.fn(() => 'Bearer token123')
    };
    const mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };

    xiboRequest.mockResolvedValue({ success: true });

    await updateWidgetElements(mockReq, mockRes);

    expect(xiboRequest).toHaveBeenCalledWith(
      '/playlist/widget/123/elements',
      'PUT',
      { elements: '[{"elements":[]}]' },
      'token123'
    );
  });
});
```

#### 4.2 Integration Tests

**Test Scenarios:**

1. ✅ **Checkout published layout** → Verify draft created with correct widget IDs
2. ✅ **Edit text in Canvas widget** → Verify save succeeds
3. ✅ **Edit text in Global widget** → Verify save succeeds
4. ✅ **Refresh page after save** → Verify changes persist
5. ✅ **Publish draft** → Verify published layout shows updated text
6. ✅ **Checkout again** → Verify can edit text in new draft

#### 4.3 Manual Testing Checklist

- [ ] Open published layout with Canvas widget containing text
- [ ] Click "Edit" to checkout layout
- [ ] Verify "DRAFT" badge appears
- [ ] Double-click text element
- [ ] Edit text value
- [ ] Click "Save"
- [ ] Verify success message appears
- [ ] Verify text updates in canvas preview
- [ ] Refresh browser page
- [ ] Verify text change persists
- [ ] Check browser console for errors
- [ ] Check backend logs for request details
- [ ] Publish layout
- [ ] Verify published layout shows updated text

---

## Debugging Steps (If Issue Persists)

### Step 1: Verify Content-Type at Each Layer

**Frontend (Browser DevTools):**
```javascript
// In Network tab, check the request:
// - Method: PUT
// - URL: /api/playlists/widgets/{widgetId}/elements
// - Request Headers: Content-Type should be multipart/form-data
// - Request Payload: Should show elements as form field
```

**Backend (Console Logs):**
```javascript
// Add to widgetController.js
console.log('[updateWidgetElements] Request headers:', req.headers);
console.log('[updateWidgetElements] Request body:', req.body);
console.log('[updateWidgetElements] Elements type:', typeof req.body.elements);
```

**Xibo API (xiboClient.js):**
```javascript
// Add to xiboClient.js before axios call
console.log('[xiboRequest] Final request config:', {
  method: requestConfig.method,
  url: requestConfig.url,
  headers: requestConfig.headers,
  dataType: typeof requestConfig.data,
  dataPreview: String(requestConfig.data).substring(0, 200)
});
```

### Step 2: Test Xibo API Directly

Use Postman or curl to test the Xibo API endpoint directly:

```bash
# Get access token
curl -X POST https://portal.signage-lab.com/api/authorize/access_token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=client_credentials"

# Test widget elements update
curl -X PUT https://portal.signage-lab.com/api/playlist/widget/WIDGET_ID/elements \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'elements=[{"elements":[{"id":"text","properties":[{"id":"text","value":"Test"}]}]}]'
```

### Step 3: Check Xibo CMS Version Compatibility

**Verify Xibo CMS version:**
```bash
curl https://portal.signage-lab.com/api/about \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

**Check if widget elements endpoint is supported:**
- Xibo CMS 3.x: Full support for widget editing via API
- Xibo CMS 2.x: Limited support, may require different approach
- Xibo CMS 1.x: Canvas widgets not supported via API

### Step 4: Inspect Widget Structure

**Get full widget details:**
```javascript
// In browser console on layout designer page
console.log('Current layout:', layout);
console.log('All widgets:', layout?.regions?.flatMap(r => r.regionPlaylist?.widgets));
console.log('Canvas widget:', layout?.regions?.find(r => 
  r.regionPlaylist?.widgets?.some(w => w.type === 'canvas' || w.type === 'global')
)?.regionPlaylist?.widgets?.find(w => w.type === 'canvas' || w.type === 'global'));
```

---

## Alternative Solutions (If Primary Fix Fails)

### Alternative 1: Use Xibo CMS Web Interface

If API limitations prevent text editing:

1. Add a "Edit in Xibo CMS" button that opens the layout in the official Xibo interface
2. Provide deep link: `https://portal.signage-lab.com/layout/designer/{layoutId}`
3. Show informational message about API limitations

**Implementation:**
```javascript
// In LayoutDesign.jsx
const handleEditInXibo = () => {
  const xiboUrl = `https://portal.signage-lab.com/layout/designer/${layoutId}`;
  window.open(xiboUrl, '_blank');
  alert('Opening layout in Xibo CMS. After making changes there, refresh this page to see updates.');
};
```

### Alternative 2: Use Widget Update Endpoint Instead

If `/playlist/widget/{widgetId}/elements` doesn't work, try updating the entire widget:

```javascript
// Instead of updating elements, update the whole widget
const response = await fetch(
  `${API_BASE_URL}/playlists/widgets/${widget.widgetId}`,
  {
    method: "PUT",
    headers: getAuthHeaders(),
    body: formData // Include all widget properties + updated elements
  }
);
```

### Alternative 3: Disable Text Editing for Canvas Widgets

If no solution works, disable the feature with clear messaging:

```javascript
const handleTextDoubleClick = (widget, currentText, elementId = null) => {
  if (widget.type === "core-canvas" || widget.type === "canvas" || widget.type === "global") {
    alert(
      "⚠️ Text Editing Limitation\n\n" +
      "Text elements in Canvas/Global widgets cannot be edited through this interface due to Xibo API limitations.\n\n" +
      "To edit this text:\n" +
      "1. Click 'Edit in Xibo CMS' button above\n" +
      "2. Make your changes in the official Xibo interface\n" +
      "3. Return here and refresh the page\n\n" +
      "We apologize for the inconvenience."
    );
    return;
  }
  
  // ... existing code for other widget types ...
};
```

---

## Success Criteria

- [ ] Text elements in Canvas widgets can be edited and saved
- [ ] Text elements in Global widgets can be edited and saved
- [ ] Changes persist after page refresh
- [ ] Changes persist after publish/checkout cycle
- [ ] No console errors during save operation
- [ ] Backend logs show successful Xibo API calls
- [ ] User receives clear success/error messages
- [ ] No regression in other widget editing functionality

---

## Rollback Plan

If the fix causes issues:

1. **Immediate rollback:** Revert `LayoutDesign.jsx` changes
2. **Re-enable blocking alert:** Keep the "Canvas widgets cannot be edited" message
3. **Document the issue:** Update API_Documentation with known limitations
4. **Alternative workflow:** Guide users to Xibo CMS web interface

---

## Documentation Updates

After successful implementation:

1. **Update API_Documentation:**
   - Add section on widget elements endpoint
   - Document content-type requirements
   - Add example requests/responses

2. **Update README:**
   - Add note about text editing capabilities
   - Document any limitations discovered

3. **Create user guide:**
   - How to edit text in layouts
   - Troubleshooting common issues

---

## References

- **Bug Analysis:** `BUG_ANALYSIS_TEXT_ELEMENT_EDITING.md`
- **API Documentation:** `API_Documentation` (Lines 800-950)
- **Frontend Code:** `frontend/src/components/LayoutDesign.jsx` (Lines 1089-1197)
- **Backend Code:** `backend/src/controllers/widgetController.js` (Lines 117-165)
- **Xibo Client:** `backend/src/utils/xiboClient.js` (Lines 283-376)
- **Xibo CMS API Docs:** https://xibosignage.com/docs/api
- **Xibo Community Forum:** https://community.xibo.org.uk/

---

## Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Fix Content-Type Handling | 2 hours | ⏳ Pending |
| 2 | Improve State Management | 2 hours | ⏳ Pending |
| 3 | Enhanced Error Handling | 1 hour | ⏳ Pending |
| 4 | Testing & Validation | 2 hours | ⏳ Pending |
| **Total** | | **7 hours** | |

---

## Next Steps

1. ✅ Review this task document
2. ⏳ Implement Phase 1 (Content-Type fix)
3. ⏳ Test with real Xibo API
4. ⏳ Implement Phase 2 if needed
5. ⏳ Comprehensive testing
6. ⏳ Deploy to production

---

**Last Updated:** December 6, 2025  
**Assignee:** Development Team  
**Reviewer:** Technical Lead
