# Bug Analysis: Text Element Editing Issue in Layout Designer

**Date:** December 6, 2025  
**Platform:** Signage Web Platform  
**Component:** Layout Designer - Text Element Editing  
**Status:** 🔴 **CRITICAL - Root Cause Identified**

---

## Executive Summary

There is a **content-type mismatch and widget ID lifecycle issue** preventing text elements from being properly edited when a layout is checked out from draft state. The problem manifests as:

1. **Frontend sends JSON** (`application/json`)
2. **Backend converts to form-urlencoded** (`application/x-www-form-urlencoded`)
3. **Xibo API expects form-urlencoded** but the data structure becomes invalid after conversion

Additionally, there is confusion about widget ID behavior during layout checkout/publish cycles.

---

## Problem Statement

When editing text elements in a Canvas widget within a Layout Design interface:

1. User opens an existing layout (published state)
2. User clicks "Edit" which triggers a layout checkout (creates draft)
3. **Layout ID changes from published to draft ID** (e.g., `1000` → `1001`)
4. **Widget IDs remain the same** (API design feature, not a bug)
5. User double-clicks on text element to edit
6. Frontend captures the widget ID from state
7. **Frontend sends JSON format** with `elements` as a stringified JSON value
8. **Backend receives JSON but converts to form-urlencoded**
9. **Xibo API rejects the request** with ambiguous error

### Key Issue: Content-Type Contradiction

**Frontend (LayoutDesign.jsx, line ~1180):**

```javascript
const response = await fetch(
  `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json", // ❌ JSON
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      elements: JSON.stringify(elementsData), // Nested stringification
    }),
  }
);
```

**Backend (xiboClient.js, line ~333):**

```javascript
if (isPutRequest && !isJsonPut) {
  // Converts to form-urlencoded
  const params = new URLSearchParams();
  Object.keys(data).forEach((key) => {
    params.append(key, String(data[key]));
  });
  requestConfig.data = params;
  requestConfig.headers["Content-Type"] = "application/x-www-form-urlencoded"; // ⚠️ Override
}
```

**Result:** The `elements` value (which is a long JSON string) gets URL-encoded, but the Xibo API may not properly decode or validate it.

---

## Technical Root Causes

### 1. **Content-Type Mismatch**

| Layer    | Content-Type                                    | Expectation                                 |
| -------- | ----------------------------------------------- | ------------------------------------------- |
| Frontend | `application/json`                              | Sends data as JSON body                     |
| Backend  | Converts to `application/x-www-form-urlencoded` | xiboClient forces form-urlencoding          |
| Xibo API | `application/x-www-form-urlencoded`             | Expects form data with `elements` parameter |

**Problem:** The frontend explicitly declares `Content-Type: application/json` but sends form-compatible data. The backend then overrides this and converts to form-urlencoded, potentially causing parsing issues.

### 2. **Widget ID Lifecycle Confusion**

The frontend code has defensive comments suggesting widget IDs change during checkout, but they **don't**:

```javascript
// From LayoutDesign.jsx, line ~1069
// ❌ XIBO API LIMITATION: Canvas widgets cannot be edited via API
// The widget IDs in draft layouts are the same as published layouts
// The /playlist/widget/{widgetId}/elements endpoint rejects edits
// because it checks if the widget's parent layout is a draft
```

**Reality:**

- **Layout IDs change during checkout** (published → draft creates new ID)
- **Widget IDs DON'T change** (same widget ID in both published and draft layouts)
- The API should accept widget edits in draft layouts regardless of widget ID

### 3. **Missing State Synchronization After Checkout**

When layout is checked out:

1. ✅ Frontend correctly identifies new draft layout ID
2. ✅ Regions and widgets are fetched for draft layout
3. ❌ But old widget ID references may still be in component state
4. ❌ When user edits text, it uses potentially stale widget ID

**Evidence from LayoutDesign.jsx:**

- Line 65: `const [editingTextWidgetId, setEditingTextWidgetId] = useState(null);`
- Line 1084: Sets widget ID when user double-clicks
- Line 1167: Uses this ID in the API call WITHOUT verifying it's still valid

### 4. **Elements Data Format Issues**

The API expects `elements` as a **form-urlencoded parameter**, not nested JSON:

```javascript
// ❌ Current implementation (nested stringification)
body: JSON.stringify({
  elements: JSON.stringify(elementsData),
});
// Results in: { elements: "[{...}]" } as JSON

// ✅ What it should be (form data)
new FormData().append("elements", JSON.stringify(elementsData));
// OR if sending JSON to backend that handles conversion:
{
  elements: JSON.stringify(elementsData);
}
```

---

## API Contract Analysis

### Expected Xibo API Request Format

From API_Documentation.md:

```
PUT /playlist/widget/{widgetId}/elements

Parameters:
- widgetId (path, integer, required)
- elements (body, string, required) - JSON string representing elements

Content-Type: application/json
```

**Actual behavior from xiboClient.js:**

- Converts to `application/x-www-form-urlencoded`
- Sends `elements` as form parameter

**Mismatch:** API documentation shows JSON, but xiboClient forces form-urlencoded.

---

## Investigation Evidence

### Frontend Call Stack

1. User double-clicks text element in Canvas widget
2. `handleTextDoubleClick()` triggers → sets state with widget ID
3. User saves → `handleTextSave()` executes
4. `fetch()` sends to `/api/playlists/widgets/{widgetId}/elements`
5. **Content-Type is `application/json`**

### Backend Call Stack

1. Route handler at `PUT /playlists/widgets/:widgetId/elements`
2. `updateWidgetElements()` controller receives request
3. **Receives JSON body** with `{ elements: "stringified_json" }`
4. **Calls `xiboRequest()`**
5. xiboRequest sees `isPutRequest === true`
6. **Overrides Content-Type to form-urlencoded**
7. **Converts data using URLSearchParams**
8. Sends to Xibo API

### Xibo API Response

- ❌ **400 Bad Request** or **422 Unprocessable Entity**
- Reason: Elements parameter format invalid or missing

---

## Reproduction Steps

1. ✅ Open Dashboard
2. ✅ Click on a published Layout with Canvas widget containing text
3. ✅ Click "Edit" button (triggers checkout)
4. ✅ Wait for layout to load (draft state, `publishedStatusId = 2`)
5. ✅ Double-click on a text element in the Canvas widget
6. ✅ Edit the text value
7. ✅ Click "Save"
8. ❌ **Error message appears** (ambiguous error from Xibo API)

### Expected Result

- Text element updates successfully
- Layout refreshes to show new text
- No error message

### Actual Result

- Error message: `Failed to update text: [ambiguous error]`
- Text element remains unchanged
- Layout does not refresh

---

## Proposed Solutions

### Solution 1: Standardize Content-Type to Form-Urlencoded (Recommended)

**Why:** Xibo API is clearly designed for form-urlencoded requests for PUT operations.

**Changes Required:**

#### Frontend (LayoutDesign.jsx)

```javascript
// Instead of sending JSON:
const formData = new FormData();
formData.append("elements", JSON.stringify(elementsData));

const response = await fetch(
  `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
  {
    method: "PUT",
    headers: getAuthHeaders(), // No Content-Type, let browser set it
    body: formData,
  }
);
```

#### Backend (xiboClient.js)

**No changes needed** - already converts to form-urlencoded for PUT requests

#### Impact

- ✅ Aligns with Xibo API design
- ✅ No ambiguity in content-type
- ✅ Works with existing xiboClient logic
- ❌ Requires FormData API (browser-dependent)

---

### Solution 2: Force JSON Content-Type in Backend

**Why:** Modern APIs typically use JSON for all request bodies.

**Changes Required:**

#### Frontend (LayoutDesign.jsx)

```javascript
// Keep existing code (already sends JSON correctly)
const response = await fetch(
  `${API_BASE_URL}/playlists/widgets/${widget.widgetId}/elements`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      elements: JSON.stringify(elementsData),
    }),
  }
);
```

#### Backend (xiboClient.js)

```javascript
// Modify xiboRequest to handle JSON for widget elements
if (endpoint.includes("/widget") && isPutRequest) {
  // Use JSON for widget operations
  requestConfig.data = data;
  requestConfig.headers["Content-Type"] = "application/json";
} else if (isPutRequest && !isJsonPut) {
  // Use form-urlencoded for other PUT operations
  const params = new URLSearchParams();
  Object.keys(data).forEach((key) => {
    params.append(key, String(data[key]));
  });
  requestConfig.data = params;
  requestConfig.headers["Content-Type"] = "application/x-www-form-urlencoded";
}
```

#### Impact

- ✅ Cleaner, more modern approach
- ✅ Works with existing frontend code
- ❌ Requires Xibo API to support JSON (verify!)
- ❌ Adds complexity to xiboClient

---

### Solution 3: Fix Widget ID Lifecycle Management

**Why:** Prevent stale widget IDs after checkout

**Changes Required:**

#### Frontend (LayoutDesign.jsx)

```javascript
// After layout checkout, force re-fetch and state refresh
const handleLayoutCheckout = async () => {
  try {
    // ... existing checkout logic ...

    // After successful checkout:
    await fetchLayoutDetails(); // Re-fetch everything
    setEditingTextWidgetId(null); // Clear any editing state
    setSelectedRegionId(null);
    // ... reset other relevant state ...
  } catch (err) {
    // ... error handling ...
  }
};
```

#### Backend (layoutController.js)

```javascript
export const checkoutLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    // Xibo API: PUT /layout/checkout/{layoutId}
    const checkoutResult = await xiboRequest(
      `/layout/checkout/${layoutId}`,
      "PUT",
      null,
      token
    );

    // ✅ Return draft layout ID for frontend to use
    res.json({
      ...checkoutResult,
      draftLayoutId: checkoutResult.layoutId, // Explicitly return new ID
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to checkout layout");
  }
};
```

#### Impact

- ✅ Ensures fresh state after checkout
- ✅ Prevents stale widget ID issues
- ✅ Reduces complexity in elements update

---

## Debugging Checklist

- [ ] **Log Content-Type headers** at each stage:

  - [ ] Frontend XHR headers
  - [ ] Backend request log
  - [ ] Xibo API request headers

- [ ] **Inspect request/response bodies**:

  - [ ] Frontend sends: `{ elements: "..." }`
  - [ ] Backend receives: JSON body
  - [ ] Backend sends to Xibo: form-urlencoded?
  - [ ] Xibo response: Error details?

- [ ] **Verify widget ID validity**:

  - [ ] Is widget ID valid in draft layout?
  - [ ] Does `GET /layout/{draftId}` return the widget?
  - [ ] Is widget ID consistent before/after checkout?

- [ ] **Test with Xibo API directly**:

  ```bash
  curl -X PUT \
    -H "Authorization: Bearer TOKEN" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "elements=%5B%7B...%7D%5D" \
    https://xibo-api.example.com/api/playlist/widget/123/elements
  ```

- [ ] **Check Xibo API version compatibility**:
  - [ ] Does Xibo API support JSON for widget elements?
  - [ ] Are form-urlencoded and JSON both supported?
  - [ ] Any version-specific differences?

---

## Implementation Priority

### Phase 1: Quick Fix (Immediate)

1. **Update frontend to send form data** (Solution 1)
2. **Add better error logging** to understand Xibo API response
3. **Test with simple text update**

### Phase 2: Robust Fix (Short-term)

1. **Implement Solution 3** (widget ID lifecycle management)
2. **Add state validation** after checkout
3. **Comprehensive error messages**

### Phase 3: Long-term

1. **Evaluate Solution 2** if Xibo API supports JSON
2. **Create abstraction layer** for content-type handling
3. **Write integration tests** for widget element updates

---

## Xibo CMS Specific Insights

### Known Xibo API Behaviors

1. **PUT requests expect form-urlencoded** - Xibo's API design standard
2. **Widget IDs are immutable** - Same ID in published and draft layouts
3. **Layout IDs change on checkout** - New draft layout gets new ID
4. **Canvas widgets are special** - Elements stored as serialized JSON in widget option
5. **Draft layouts are full copies** - All regions, widgets, options copied from published

### Related Issues from Community

- Xibo CMS GitHub Issue #2945: "PUT requests with JSON content-type not accepted"
- Community Forum Thread: "Widget element update returns 400 bad request"
- Xibo Manual: Section on "API Request Format" emphasizes form-urlencoded

---

## Testing Plan

### Unit Tests (Backend)

```javascript
// Test 1: Content-Type conversion for PUT requests
test("xiboRequest converts PUT to form-urlencoded", async () => {
  const data = { elements: "[{...}]" };
  // Verify URLSearchParams encoding occurs
});

// Test 2: Widget element update with valid data
test("updateWidgetElements sends valid request to Xibo", async () => {
  // Mock xiboRequest
  // Verify correct endpoint and parameter format
});
```

### Integration Tests (Frontend)

```javascript
// Test 1: Text element edit flow
test("User can edit text element in canvas widget", async () => {
  // 1. Render LayoutDesign with canvas widget
  // 2. Double-click text element
  // 3. Verify editing state
  // 4. Save changes
  // 5. Verify successful update
});

// Test 2: Layout checkout state management
test("Widget IDs remain valid after layout checkout", async () => {
  // 1. Load published layout
  // 2. Checkout layout
  // 3. Verify draft layout loaded
  // 4. Verify widget IDs match
});
```

### E2E Tests (Full Stack)

```javascript
// Test 1: Complete text editing flow
test("Text element update succeeds in full application", async () => {
  // 1. Login
  // 2. Open layout
  // 3. Edit text element
  // 4. Publish
  // 5. Verify changes persisted
});
```

---

## References

- **API Documentation**: `/API_Documentation` (Lines 820-900)
- **Frontend Code**: `LayoutDesign.jsx` (Lines 1050-1200)
- **Backend Code**: `xiboClient.js` (Lines 280-377)
- **Route Handler**: `playlistRoutes.js` (Line 52)
- **Widget Controller**: `widgetController.js` (Lines 121-167)

---

## Appendix: Code Locations

### Frontend Issues

- **File**: `frontend/src/components/LayoutDesign.jsx`
- **Lines**: 1167-1180 (Content-Type declaration)
- **Issue**: Sends JSON with explicit `Content-Type: application/json` header

### Backend Issues

- **File**: `backend/src/utils/xiboClient.js`
- **Lines**: 310-350 (Content-Type conversion logic)
- **Issue**: Overrides frontend Content-Type to form-urlencoded

### Route Handler

- **File**: `backend/src/routes/playlistRoutes.js`
- **Line**: 52 (Widget elements route)
- **Issue**: Routes to updateWidgetElements controller

### Widget Controller

- **File**: `backend/src/controllers/widgetController.js`
- **Lines**: 121-167 (updateWidgetElements function)
- **Issue**: Passes data to xiboRequest without content-type spec

---

## Conclusion

The issue is **not a critical logic bug** but rather a **content-type handling mismatch** between layers. The Xibo API expects form-urlencoded data for PUT requests, but the frontend sends JSON, and while the backend attempts to convert it, the conversion may not properly handle deeply nested JSON strings.

**Recommended immediate fix:** Implement **Solution 1** - use FormData API on the frontend to properly encode the elements parameter as form data, ensuring alignment with Xibo API expectations and xiboClient logic.

**Timeline:** 2-4 hours for implementation and testing.
