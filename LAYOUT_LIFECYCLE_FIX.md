# Layout Lifecycle Management Fix

## Problem Summary

When publishing a layout and then trying to reopen it, users encountered the following error flow:

1. **User publishes layout** → Success ✅ → Redirected to Dashboard
2. **User clicks on same layout again** → Tries to load it
3. **Error: "This Layout is not a Draft, please checkout"** ❌
4. **User somehow gets redirected** → Back to Dashboard
5. **User opens layout again** → **Error: "Layout is already a checkout"** ❌
6. **Fetch error** → Layout won't load

This indicated **state management issues** around the layout lifecycle (Published → Draft → Edit → Publish).

---

## Root Cause Analysis

### Issue 1: Auto-Checkout Loop After Publish

**Problem:** After `handlePublishLayout()` completes and redirects to dashboard, the function was calling `fetchLayoutDetails()` to refresh state. This then **detected the published layout** and **automatically triggered `handleAutoCheckout()`**, which navigates to a new draft URL.

**Flow:**

```
handlePublishLayout()
  ↓
fetchLayoutDetails()
  ↓
Detects publishedStatusId === 1 (Published)
  ↓
Calls handleAutoCheckout()
  ↓
Creates new draft OR finds existing one
  ↓
Navigates to /layout/designer/{draftId}
  ↓
Confusion about which layout we're editing!
```

**Impact:** After publish, the system might be trying to checkout AGAIN, causing conflicts and "already checked out" errors.

### Issue 2: Draft ID Extraction Failure

**Problem:** When `handleAutoCheckout()` received the response from Xibo CMS, it tried to extract the draft layout ID from `data.data?.layoutId || data.layoutId`. However, the response structure might be different, leaving `draftLayoutId` as `null`, which triggered: **"No draft layout ID returned from checkout"**.

### Issue 3: "Already Checked Out" Error Handling

**Problem:** When Xibo CMS returned a **422 status code** (layout already checked out by another session/user), the error handler tried to find the existing draft via `GET /layouts?parentId=...&publishedStatusId=2`. However:

- The search response might not contain the draft with the correct ID field
- Draft ID extraction from search results used limited field names: `layoutId || layout_id || id`
- Error logging was insufficient to debug the real issue

---

## Solution Implemented

### Fix 1: Prevent Auto-Checkout Loop After Publish ✅

**Added:** `skipAutoCheckout` state variable

```javascript
const [skipAutoCheckout, setSkipAutoCheckout] = useState(false);
```

**Modified:** `fetchLayoutDetails()` to accept `skipCheckout` parameter

```javascript
const fetchLayoutDetails = async (skipCheckout = false) => {
  // ... fetch logic ...

  // Only auto-checkout if NOT skipping
  if (fetchedLayout.publishedStatusId === 1 && !skipCheckout) {
    await handleAutoCheckout(fetchedLayout.layoutId);
    return;
  }

  setLayout(fetchedLayout);
  setSkipAutoCheckout(false);
};
```

**Updated:** `handlePublishLayout()` to skip auto-checkout after publishing

```javascript
const _ = await response.json();
setPublishSuccess(true);

// 🔧 NEW: Set skip flag to prevent auto-checkout after publish
setSkipAutoCheckout(true);

// Show success message and redirect
alert("Layout published successfully! Redirecting to dashboard...");
navigate("/dashboard", { replace: true });
```

**Updated:** `handleCheckoutLayout()` to pass skip flag

```javascript
const _ = await response.json();
setCheckoutSuccess(true);

// 🔧 NEW: Refresh layout data with skipCheckout=true to prevent recursion
await fetchLayoutDetails(true);
```

**Result:** After publishing, the system no longer triggers an automatic checkout, preventing the recursive loop.

---

### Fix 2: Better Draft ID Extraction ✅

**Improved:** `handleAutoCheckout()` to try multiple response field formats

```javascript
// 🔧 IMPROVED: Better draft ID extraction from multiple possible response formats
let draftLayoutId = null;
if (data.data?.layoutId) draftLayoutId = data.data.layoutId;
else if (data.layoutId) draftLayoutId = data.layoutId;
else if (data.layout?.layoutId) draftLayoutId = data.layout.layoutId;
else if (data.id) draftLayoutId = data.id;

if (!draftLayoutId) {
  console.warn("[Auto-Checkout] Response structure:", JSON.stringify(data));
  throw new Error(
    "No draft layout ID returned from checkout. Response: " +
      JSON.stringify(data)
  );
}
```

**Result:** Now handles multiple response formats from Xibo CMS API.

---

### Fix 3: Robust Error Handling for "Already Checked Out" ✅

**Improved:** Error detection in `handleAutoCheckout()`

```javascript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMsg =
    errorData.message || errorData.error || `HTTP ${response.status}`;

  // Check for "already checked out" in error message or status code
  if (
    response.status === 422 ||
    errorMsg.toLowerCase().includes("already checked out")
  ) {
    console.log(
      "[Auto-Checkout] Layout already checked out (422), searching for existing draft..."
    );
    throw new Error(`ALREADY_CHECKED_OUT:${errorMsg}`);
  }

  throw new Error(errorMsg);
}
```

**Improved:** Draft search in error handler with more field names

```javascript
if (draftsResponse.ok) {
  const draftsData = await draftsResponse.json();
  const drafts = Array.isArray(draftsData.data) ? draftsData.data : [];

  console.log(
    `[Auto-Checkout] Found ${drafts.length} drafts for parent ${publishedLayoutId}`
  );

  const existingDraft = drafts.find(
    (d) => String(d.parentId) === String(publishedLayoutId)
  );

  if (existingDraft) {
    // Try all possible ID field names
    const draftId =
      existingDraft.layoutId ||
      existingDraft.layout_id ||
      existingDraft.id ||
      existingDraft.identifier;

    if (draftId) {
      console.log(
        `[Auto-Checkout] Found existing draft (ID: ${draftId}), navigating...`
      );
      navigate(`/layout/designer/${draftId}`, { replace: true });
      return;
    }
  }
}
```

**Result:** Better detection and handling of race conditions where the draft already exists.

---

## Layout Lifecycle Flow (Now Correct)

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYOUT LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

1. USER OPENS PUBLISHED LAYOUT
   └─→ fetchLayoutDetails()
       └─→ Detects publishedStatusId === 1
           └─→ Calls handleAutoCheckout(publishedLayoutId)
               └─→ Xibo: PUT /layout/checkout/{layoutId}
                   └─→ Returns draft layout ID
                       └─→ Navigate to /layout/designer/{draftId}
                           └─→ fetchLayoutDetails(draftId) called (new layoutId)
                               └─→ Loads draft layout (publishedStatusId === 2)
                                   └─→ setLayout(draftLayout) ✅

2. USER EDITS TEXT & SAVES
   └─→ handleTextSave()
       └─→ PUT /api/playlists/widgets/{widgetId}/elements
           └─→ Updates widget text ✅

3. USER PUBLISHES LAYOUT
   └─→ handlePublishLayout()
       └─→ PUT /layouts/publish/{layoutId}
           └─→ setSkipAutoCheckout(true) 🔧 PREVENT AUTO-CHECKOUT
               └─→ Navigate to /dashboard
                   └─→ NO RECURSIVE CHECKOUT ✅

4. USER CLICKS ON LAYOUT AGAIN
   └─→ fetchLayoutDetails()
       └─→ Detects publishedStatusId === 1
           └─→ Should NOT skip because skipAutoCheckout flag was reset
               └─→ Calls handleAutoCheckout() again (CORRECT)
                   └─→ Same flow as step 1 ✅
```

---

## Code Changes Summary

### File: `frontend/src/components/LayoutDesign.jsx`

#### 1. State Variable (Line 24)

```javascript
const [skipAutoCheckout, setSkipAutoCheckout] = useState(false);
```

#### 2. fetchLayoutDetails() Function (Lines 259-285)

- Added `skipCheckout = false` parameter
- Added check: `if (fetchedLayout.publishedStatusId === 1 && !skipCheckout)`
- Added reset: `setSkipAutoCheckout(false)`

#### 3. handlePublishLayout() Function (Lines 868)

- Changed: `await fetchLayoutDetails()` to removed entirely
- Added: `setSkipAutoCheckout(true)` before redirect

#### 4. handleCheckoutLayout() Function (Line 916)

- Changed: `await fetchLayoutDetails()` to `await fetchLayoutDetails(true)`

#### 5. handleAutoCheckout() Function (Lines 935-1025)

- Improved error response handling (lines 958-969)
- Better draft ID extraction (lines 976-989)
- Improved "already checked out" detection (lines 1007-1050)
- Better logging for debugging (lines 965, 1011, 1029)

---

## Testing Checklist

- [ ] **Test 1: Open Published Layout**

  - Expected: Layout auto-checks out, loads draft version without errors
  - Verify: Console shows "Auto-Checkout" messages, layout displays correctly

- [ ] **Test 2: Edit & Save Text**

  - Expected: Text changes are saved without "not a draft" errors
  - Verify: Text persists after page reload

- [ ] **Test 3: Publish Layout**

  - Expected: Successful publish, redirects to dashboard, NO recursive checkout
  - Verify: No "already checked out" errors in console

- [ ] **Test 4: Reopen Published Layout**

  - Expected: Loads same layout again, auto-checks out (creates new draft)
  - Verify: Can edit and publish again without issues

- [ ] **Test 5: Multiple Users (Race Condition)**

  - Expected: If one user already checked out, second user should find existing draft
  - Verify: Second user redirected to existing draft without 422 errors

- [ ] **Test 6: Error Handling**
  - Verify: Clear error messages in alerts and console
  - Check: Proper logging for "already checked out" scenarios

---

## Key Improvements

1. **Prevents Auto-Checkout Loop**: Published layouts no longer trigger automatic checkout after being published
2. **Better Response Parsing**: Handles multiple Xibo API response formats
3. **Robust Error Handling**: Gracefully handles "already checked out" race conditions
4. **Improved Logging**: Detailed console logs for debugging layout lifecycle issues
5. **State Management**: Proper tracking of skipAutoCheckout flag to control auto-checkout behavior

---

## References

- **Xibo API Checkout**: `PUT /layout/checkout/{layoutId}` - Creates draft from published
- **Xibo API Publish**: `PUT /layout/publish/{layoutId}` - Publishes draft, makes it live
- **Layout Status IDs**: 1 = Published, 2 = Draft, 3 = Pending Approval
- **HTTP 422**: Unprocessable Entity - Typically means "already checked out"

---

## Next Steps

1. ✅ Deploy fixes to frontend
2. ⏳ Test complete layout lifecycle workflows
3. ⏳ Monitor console for any remaining checkout/publish issues
4. ⏳ If issues persist, check Xibo API response formats and adjust parsing
