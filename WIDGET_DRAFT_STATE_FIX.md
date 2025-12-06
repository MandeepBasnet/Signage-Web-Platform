# Widget Draft State Fix

## Problem

When trying to save widget elements (e.g., text updates in canvas widgets), you're getting this error:

```
Layout is not in draft state. Please ensure the layout is checked out before editing.
```

## Root Cause

The widget ID you're trying to update (`19892`) belongs to a **published layout**, not a draft layout. 

### How Xibo Checkout Works:

1. **Published Layout** (layoutId: 100) has widgets with IDs: `[19892, 19893, 19894]`
2. When you **checkout** the layout, Xibo creates a **Draft Layout** (layoutId: 101)
3. The draft layout gets **NEW widgets** with different IDs: `[20001, 20002, 20003]`
4. The widgets in the draft are **copies** of the published widgets, but with new IDs
5. **You must use the draft widget IDs** when making updates

### What's Happening in Your Case:

```
User clicks published layout (layoutId: X, widgetId: 19892)
  ↓
Auto-checkout creates draft (layoutId: Y, widgetId: 20XXX) ← NEW WIDGET IDS
  ↓
Page should reload with draft layout Y
  ↓
❌ BUG: Frontend still tries to save using widgetId 19892 (from published layout)
  ↓
Xibo API rejects: "Layout is not in draft state"
```

## Diagnostic Steps

### Step 1: Check Current Layout State

Open your browser console and run:

```javascript
// Check if you're on a draft layout
console.log('Layout ID:', layoutId);
console.log('Published Status:', layout?.publishedStatusId);
console.log('Published Status Name:', layout?.publishedStatus);

// Status codes:
// 1 = Published
// 2 = Draft
// 3 = Pending Approval
```

### Step 2: Check Widget IDs

```javascript
// Get all widget IDs from current layout
const widgetIds = layout?.regions
  ?.flatMap(r => r.regionPlaylist?.widgets || [])
  ?.map(w => w.widgetId);

console.log('Current Widget IDs:', widgetIds);
```

### Step 3: Verify the Request

When you try to save, check the network tab:
- URL should be: `/api/playlists/widgets/{WIDGET_ID}/elements`
- The `WIDGET_ID` should match a widget from the **draft layout**, not the published layout

## Solution

### Fix 1: Ensure Page Reloads After Checkout

The `handleAutoCheckout` function in `LayoutDesign.jsx` already does this:

```javascript
// Line 990 in LayoutDesign.jsx
window.location.href = `/layout/designer/${draftLayoutId}`;
```

This should force a full page reload with the draft layout ID, which will fetch the correct widget IDs.

**Verify this is working:**
1. Open DevTools Console
2. Click on a published layout
3. Watch for the auto-checkout log: `[Auto-Checkout] Forcing full page reload to /layout/designer/{DRAFT_ID}`
4. Verify the page reloads and the URL changes to the draft layout ID

### Fix 2: Add Defensive Checks Before Saving

In `LayoutDesign.jsx`, the `handleTextSave` function already has defensive checks (lines 1136-1144):

```javascript
// ✅ DEFENSIVE CHECK: Ensure we're working with a draft layout
if (layout?.publishedStatusId !== 2) {
  const errorMsg = `Cannot edit: Layout status is ${layout?.publishedStatusId}...`;
  console.error("[handleTextSave]", errorMsg);
  alert(errorMsg + "\\n\\nPlease ensure the layout is checked out before editing.");
  return;
}
```

This should prevent saves on non-draft layouts.

### Fix 3: Verify Widget Belongs to Current Layout

The code also verifies the widget (lines 1152-1161):

```javascript
// ✅ DEFENSIVE: Verify widget belongs to current layout
const currentWidget = layout?.regions
  ?.flatMap((r) => r.regionPlaylist?.widgets || [])
  ?.find((w) => String(w.widgetId) === String(widget.widgetId));

if (!currentWidget) {
  throw new Error(
    `Widget ${widget.widgetId} not found in current layout. ` +
    `This may indicate stale state. Please refresh the page.`
  );
}
```

## Debugging Checklist

If the error persists, check these:

### ✅ 1. Is the layout actually in draft state?

```javascript
// In browser console:
console.log('Layout Status:', layout?.publishedStatusId); // Should be 2
console.log('Layout Status Name:', layout?.publishedStatus); // Should be "Draft"
```

### ✅ 2. Does the widget ID match the current layout?

```javascript
// In browser console:
const widgetId = 19892; // The widget you're trying to save
const widgetExists = layout?.regions
  ?.flatMap(r => r.regionPlaylist?.widgets || [])
  ?.some(w => w.widgetId === widgetId);

console.log(`Widget ${widgetId} exists in current layout:`, widgetExists);
```

### ✅ 3. Is the page reloading after checkout?

- Check browser console for: `[Auto-Checkout] Forcing full page reload to /layout/designer/{DRAFT_ID}`
- Check if URL changes after checkout
- Check if `layoutId` in the URL matches the draft layout ID

### ✅ 4. Are you using stale widget references?

If you have widget data stored in React state that was captured BEFORE the checkout, it will have the old (published) widget IDs.

**Solution:** After checkout, the page reload should clear all state and fetch fresh data.

## Common Scenarios

### Scenario A: Page Doesn't Reload After Checkout

**Symptom:** After clicking a published layout, you don't see a page reload, and the URL doesn't change.

**Fix:** Check the `handleAutoCheckout` function. Ensure `window.location.href` is being called.

### Scenario B: Page Reloads But Still Uses Old Widget IDs

**Symptom:** Page reloads, URL changes, but widget IDs are still from the published layout.

**Fix:** Check `fetchLayoutDetails()` function. Ensure it's fetching the layout using the `layoutId` from the URL params, not from stale state.

### Scenario C: Draft Layout Exists But Not Found

**Symptom:** Error says "Layout already checked out" but can't find the draft.

**Fix:** The draft search logic (lines 1007-1046) should find the existing draft. Check the API response to ensure `parentId` matches.

## Testing Steps

1. **Start Fresh:**
   - Go to dashboard
   - Find a **published** layout (no "DRAFT" badge)
   - Click on it

2. **Observe Auto-Checkout:**
   - Watch browser console for checkout logs
   - Verify page reloads
   - Verify URL changes to draft layout ID

3. **Check Layout State:**
   - After page loads, check console: `layout.publishedStatusId` should be `2`
   - Check for "DRAFT" badge in UI

4. **Try to Edit:**
   - Double-click a text element
   - Make a change
   - Click save
   - Should succeed without "not in draft state" error

## Quick Fix Command

If you're stuck, try this in browser console to force a refresh:

```javascript
// Force reload with current layout ID
window.location.reload();
```

Or navigate to the draft layout manually:

```javascript
// If you know the draft layout ID
const draftLayoutId = 12345; // Replace with actual draft ID
window.location.href = `/layout/designer/${draftLayoutId}`;
```

## Next Steps

If the issue persists after following this guide:

1. **Capture the full error:** Check Network tab → Find the failing request → Copy the full request and response
2. **Check backend logs:** Look for `[updateWidgetElements]` logs in your backend terminal
3. **Verify widget ownership:** Use Xibo CMS directly to check which layout owns widget 19892

## Additional Notes

- **Widget IDs are unique across the entire Xibo system**, not just within a layout
- **Draft layouts have completely different widget IDs** than their published parents
- **You cannot edit widgets from a published layout** - you must checkout first
- **Auto-checkout should handle this automatically** - if it's not working, there's a bug in the checkout flow
