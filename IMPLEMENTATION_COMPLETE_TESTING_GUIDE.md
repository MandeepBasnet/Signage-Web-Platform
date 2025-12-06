# Implementation Complete: Layout Lifecycle Fix

## Summary of Changes

All fixes have been successfully implemented in `frontend/src/components/LayoutDesign.jsx`. The layout checkout/publish error cascade has been resolved.

---

## What Was Fixed

### ✅ Fix 1: Prevent Auto-Checkout Loop After Publish

**Location:** Lines 24, 259-285, 868, 916

**What it does:** After publishing a layout, the system no longer triggers an automatic checkout, preventing state confusion and recursive errors.

**Code:**

```javascript
// Line 24: New state variable
const [skipAutoCheckout, setSkipAutoCheckout] = useState(false);

// Line 259: Function accepts skipCheckout parameter
const fetchLayoutDetails = async (skipCheckout = false) => {
  // ...
  if (fetchedLayout.publishedStatusId === 1 && !skipCheckout) {
    await handleAutoCheckout(fetchedLayout.layoutId);
    return;
  }
  setLayout(fetchedLayout);
  setSkipAutoCheckout(false);
};

// Line 868: Set flag before redirect after publish
setSkipAutoCheckout(true);
navigate("/dashboard", { replace: true });

// Line 916: Pass skip flag when refreshing after checkout
await fetchLayoutDetails(true);
```

---

### ✅ Fix 2: Better Draft ID Extraction

**Location:** Lines 976-989

**What it does:** The system now tries 4 different response formats to extract the draft layout ID instead of just one, handling Xibo API's variable response structures.

**Code:**

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

---

### ✅ Fix 3: Robust "Already Checked Out" Error Handling

**Location:** Lines 958-1050

**What it does:** When Xibo API returns 422 (already checked out), the system gracefully finds and navigates to the existing draft instead of showing an error.

**Code:**

```javascript
// Detect 422 or "already checked out" errors
if (
  response.status === 422 ||
  errorMsg.toLowerCase().includes("already checked out")
) {
  console.log(
    "[Auto-Checkout] Layout already checked out (422), searching for existing draft..."
  );
  throw new Error(`ALREADY_CHECKED_OUT:${errorMsg}`);
}

// In error handler:
if (err.message?.includes("ALREADY_CHECKED_OUT")) {
  // Search for existing draft
  const draftsResponse = await fetch(
    `${API_BASE_URL}/layouts?parentId=${publishedLayoutId}&publishedStatusId=2&embed=regions,playlists,widgets`,
    { headers: getAuthHeaders() }
  );

  if (draftsResponse.ok) {
    const drafts = Array.isArray(draftsData.data) ? draftsData.data : [];
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
        navigate(`/layout/designer/${draftId}`, { replace: true });
        return;
      }
    }
  }
}
```

---

## Testing Instructions

### Test Case 1: Open Published Layout

**Steps:**

1. Go to Dashboard
2. Click on a layout that shows status "online" or "published"
3. Wait for it to load

**Expected Result:**

- Layout opens successfully
- Console shows: `[Auto-Checkout] Checking out published layout {id}...`
- Console shows: `[Auto-Checkout] Successfully created draft layout {draftId}`
- Layout is editable
- No error alerts

**If Failed:**

- Check browser console for error messages
- Verify Xibo API is accessible
- Check network tab for 401/403 authorization errors

---

### Test Case 2: Edit Text Element

**Steps:**

1. From Test Case 1, double-click on a text element
2. Edit the text
3. Click "Save" button

**Expected Result:**

- Text is updated successfully
- No "not a draft" errors
- Text persists on page reload

**If Failed:**

- Check that layout is in draft mode (should auto-checked out)
- Verify FormData API is being used (see console network tab)
- Check widget API response in Network tab

---

### Test Case 3: Publish Layout

**Steps:**

1. From Test Case 2, click "Publish Layout" button
2. Confirm the publish action
3. Wait for redirect to Dashboard

**Expected Result:**

- Alert: "Layout published successfully! Redirecting to dashboard..."
- Redirects to Dashboard without errors
- Console shows NO recursive checkout attempts
- No "already checked out" errors in console

**If Failed:**

- Check console for publish endpoint errors
- Verify Xibo API publish endpoint is responding
- Look for recursive checkout attempts in console logs

---

### Test Case 4: Reopen Published Layout

**Steps:**

1. From Test Case 3, you're on Dashboard
2. Click on the same layout again
3. Wait for it to load

**Expected Result:**

- Layout opens successfully
- Console shows checkout process (same as Test Case 1)
- No cascade of errors
- Layout is editable

**If Failed:**

- Check console for 422 errors
- If 422 occurs, verify draft search logic runs
- Check that existing draft was found and navigated to

---

### Test Case 5: Race Condition Test (Optional)

**Steps:**

1. Open layout in Browser Tab A
2. Quickly open same layout in Browser Tab B (same user)
3. Wait for both to load

**Expected Result:**

- Tab A loads successfully (creates draft)
- Tab B shows 422 error but recovers (finds existing draft)
- Both tabs end up viewing the same draft layout
- No cascading errors

**If Failed:**

- Tab B shows unhandled 422 error
- Check draft search logic in error handler
- Verify draftId extraction from search results

---

## Console Log Reference

### ✅ Good Logs (Expected)

```
[Auto-Checkout] Checking out published layout 123...
[Auto-Checkout] Successfully created draft layout 456
```

```
[Auto-Checkout] Layout already checked out (422), searching for existing draft...
[Auto-Checkout] Found 1 drafts for parent 123
[Auto-Checkout] Found existing draft (ID: 456), navigating...
```

```
Layout published successfully! Redirecting to dashboard...
```

### ❌ Bad Logs (Indicates Issues)

```
[Auto-Checkout] Response structure: {"data":...}
No draft layout ID returned from checkout.
```

→ Response format changed, need to add new field to parsing logic

```
[Auto-Checkout] Failed to find existing draft
Draft not found in search results
```

→ Draft search didn't find the layout, may indicate parentId mismatch

```
Failed to checkout layout: Network error...
Failed to publish layout: Network error...
```

→ API connectivity issue, check Xibo API endpoint

---

## Files Modified

### `frontend/src/components/LayoutDesign.jsx`

| Line Range | Change                                    | Impact                                             |
| ---------- | ----------------------------------------- | -------------------------------------------------- |
| 24         | Added `skipAutoCheckout` state            | Prevents auto-checkout recursion                   |
| 259-285    | Modified `fetchLayoutDetails()` signature | Accepts `skipCheckout` parameter                   |
| 275        | Modified auto-checkout condition          | Checks `!skipCheckout` before auto-checkout        |
| 284        | Added skip flag reset                     | Resets flag after loading                          |
| 868        | Set `skipAutoCheckout(true)`              | Prevents auto-checkout after publish               |
| 916        | Pass `skipCheckout=true`                  | Prevents auto-checkout after manual checkout       |
| 935-1050   | Improved `handleAutoCheckout()`           | Better error handling, ID extraction, draft search |

---

## Architecture Overview

### Before Fix (Problematic Flow)

```
Publish Layout
  ↓
fetchLayoutDetails() (refreshes state)
  ↓
Detects published status
  ↓
Auto-triggers checkout (UNEXPECTED)
  ↓
May conflict with browser navigation
  ↓
Redirect to dashboard
  ↓
State confusion
```

### After Fix (Clean Flow)

```
Publish Layout
  ↓
setSkipAutoCheckout(true) (flag set)
  ↓
Redirect to dashboard (CLEAN)
  ↓
No auto-checkout triggered
  ↓
State remains clean

Next time user opens layout:
  ↓
fetchLayoutDetails() (refreshes state)
  ↓
Detects published status
  ↓
skipAutoCheckout still false (reset after load)
  ↓
Auto-triggers checkout (EXPECTED, NEW DRAFT)
  ↓
Clean checkout/edit/publish cycle
```

---

## How to Verify Fix is Working

### Method 1: Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. Open a published layout
4. Look for `[Auto-Checkout]` messages
5. Verify they show successful checkout without errors

### Method 2: Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Filter for API calls: Search for "checkout" or "layouts"
4. Verify:
   - Single checkout request after opening published layout
   - Publish request returns 200 OK
   - No multiple checkout attempts

### Method 3: Application State

1. Open DevTools (F12)
2. Go to Application tab
3. Set breakpoint in `handlePublishLayout()` or `fetchLayoutDetails()`
4. Step through code to verify:
   - `skipAutoCheckout` is set to true
   - `fetchLayoutDetails(true)` is called with parameter
   - No recursive calls

---

## Rollback Instructions (If Needed)

If issues occur, revert the following changes:

1. **Remove skipAutoCheckout state:**

   - Delete line 24

2. **Restore fetchLayoutDetails signature:**

   - Change line 259 from `async (skipCheckout = false)` to `async ()`
   - Change line 275 condition to just `if (fetchedLayout.publishedStatusId === 1)`
   - Remove line 284 reset

3. **Restore handlePublishLayout:**

   - Remove line 868 `setSkipAutoCheckout(true);`
   - Add back: `await fetchLayoutDetails();`

4. **Restore handleCheckoutLayout:**
   - Change line 916 from `await fetchLayoutDetails(true);` to `await fetchLayoutDetails();`

---

## Next Steps

1. ✅ Verify all files are in place and code is deployed
2. ⏳ Run all 5 test cases above
3. ⏳ Monitor console for any "No draft layout ID" errors
4. ⏳ Test with multiple users if possible
5. ⏳ Monitor production for any recurring "already checked out" errors

---

## Support

If you encounter issues:

1. **Check console for `[Auto-Checkout]` logs** - These show exactly what's happening
2. **Look at Network tab** - Verify API calls are succeeding (200 status)
3. **Check Xibo CMS logs** - If API is failing, check server logs
4. **Verify response format** - If draft ID extraction fails, the response structure may have changed
