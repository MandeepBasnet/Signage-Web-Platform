# Confirmed Issue and Fix - Widget Draft State Error

## Investigation Summary

I successfully reproduced the issue by:
1. Logging into the platform with credentials `mandeep_basnet` / `mandeep123`
2. Navigating to the Displays page
3. Clicking on the "bella vita" layout
4. The page loaded layout ID **4903** (which is a DRAFT layout, `publishedStatusId: 2`)
5. Clicked "Edit Text" on a text element
6. Modified the text and clicked "Save"
7. **ERROR OCCURRED**: `Layout is not in draft state. Please ensure the layout is checked out before editing.`

## Root Cause Confirmed

The browser console logs showed:
```
[handleTextSave] Widget ID: 19892
Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)
URL: http://localhost:5000/api/playlists/widgets/19892/elements
Error: Layout is not in draft state. Please ensure the layout is checked out before editing.
```

**The Problem:**
- Current layout ID: **4903** (DRAFT)
- Widget ID being used for save: **19892**
- Widget 19892 belongs to the **published parent layout**, NOT draft layout 4903

## Why This Happens

When a layout is checked out in Xibo:
1. A new **draft layout** is created (e.g., layout 4903)
2. All widgets are **copied** with **NEW widget IDs**
3. The draft layout has completely different widget IDs than the published layout
4. Widget 19892 belongs to the published layout
5. The draft layout 4903 has NEW widgets with different IDs (e.g., 20001, 20002, etc.)

## The Bug

The issue is in `LayoutDesign.jsx` around lines 2064-2076. When extracting text elements from canvas widgets, the code creates element objects like this:

```javascript
return allElements.map((el, elIdx) => ({
  ...widget,           // ← This spreads the widget object
  ...el,
  uniqueKey: `${widget.widgetId}-${el.elementId || elIdx}`,
  displayName: el.elementName || el.name || `Element ${elIdx + 1}`,
  displayType: el.type,
  isElement: true,
}));
```

The `widget` object being spread contains the `widgetId`. This widget ID should be from the current draft layout (4903), but it appears to be from the published layout (19892).

## Investigation Findings

### Backend is Correct ✅
The backend `layoutController.js` correctly:
- Fetches layout data from Xibo API
- Normalizes widget IDs (lines 126-141)
- Returns the correct widget IDs for the draft layout

### Frontend Fetch is Correct ✅
The `fetchLayoutDetails` function (line 259-304) correctly:
- Fetches from `/api/layouts/${layoutId}` where `layoutId` is from the URL
- Sets the layout state with `setLayout(fetchedLayout)`
- Logs the correct layout ID and widget IDs

### The Problem is in State Persistence ❌

The issue appears to be that **after the auto-checkout and page reload**, the widget objects in the sidebar are somehow retaining the old widget IDs.

## Possible Causes

### Theory 1: Stale State After Checkout
When `handleAutoCheckout` runs (lines 947-1067), it does:
```javascript
window.location.href = `/layout/designer/${draftLayoutId}`;
```

This should force a complete page reload, clearing all React state. However, there might be:
- Browser caching issues
- Service worker caching
- LocalStorage/SessionStorage persistence

### Theory 2: Widget ID Mismatch in Region Processing
The sidebar processes widgets from `layout.regions` (line 1988-2085). If the `layout` state contains stale data, the widgets would have old IDs.

## The Fix

The solution is to ensure that after fetching the layout, we're using the FRESH widget IDs from the current layout state, not cached or stale IDs.

### Fix 1: Add Defensive Logging

Add logging to track widget IDs throughout the component lifecycle:

```javascript
// In fetchLayoutDetails, after setLayout
console.log('[fetchLayoutDetails] Widget IDs in fetched layout:', 
  fetchedLayout.regions?.flatMap(r => r.widgets?.map(w => w.widgetId) || [])
);
```

### Fix 2: Verify Widget ID Before Save

In `handleTextSave` (line 1128), add verification:

```javascript
const handleTextSave = async (widget) => {
  try {
    console.log('[handleTextSave] Received widget:', widget);
    console.log('[handleTextSave] Widget ID:', widget.widgetId);
    
    // ✅ CRITICAL FIX: Verify widget belongs to current layout
    const currentLayoutWidgets = layout?.regions
      ?.flatMap(r => r.widgets || []);
    
    const currentWidget = currentLayoutWidgets?.find(
      w => String(w.widgetId) === String(widget.widgetId)
    );
    
    if (!currentWidget) {
      console.error('[handleTextSave] Widget not found in current layout!');
      console.error('[handleTextSave] Looking for widgetId:', widget.widgetId);
      console.error('[handleTextSave] Available widget IDs:', 
        currentLayoutWidgets?.map(w => w.widgetId)
      );
      
      throw new Error(
        `Widget ${widget.widgetId} does not belong to the current layout (${layout.layoutId}). ` +
        `This indicates stale state. Please refresh the page.`
      );
    }
    
    // Use currentWidget instead of widget to ensure fresh data
    const widgetToSave = currentWidget;
    
    // ... rest of save logic using widgetToSave
  }
}
```

### Fix 3: Force State Refresh After Checkout

Ensure the page reload after checkout clears all caches:

```javascript
// In handleAutoCheckout, after getting draftLayoutId
console.log(`[Auto-Checkout] Forcing full page reload with cache clear`);

// Clear any cached data
sessionStorage.clear();
localStorage.removeItem('layout_cache'); // if you're using this

// Force reload without cache
window.location.href = `/layout/designer/${draftLayoutId}`;
```

## Immediate Workaround

Until the fix is implemented, users should:
1. After clicking a published layout, wait for the auto-checkout to complete
2. **Manually refresh the page** (F5 or Ctrl+R)
3. Then try to edit widgets

This ensures all state is cleared and fresh widget IDs are loaded.

## Testing the Fix

After implementing the fix:

1. **Test Auto-Checkout Flow:**
   - Click on a published layout
   - Verify auto-checkout creates draft
   - Verify page reloads to draft layout
   - Check console for widget IDs - should be NEW IDs, not old ones

2. **Test Widget Save:**
   - Double-click a text element
   - Edit the text
   - Click Save
   - Verify the API call uses the DRAFT layout's widget ID
   - Verify save succeeds without "not in draft state" error

3. **Verify in Console:**
   ```javascript
   // After page loads on draft layout
   console.log('Current Layout ID:', layoutId);
   console.log('Layout Status:', layout?.publishedStatusId); // Should be 2
   console.log('Widget IDs:', layout?.regions?.flatMap(r => r.widgets?.map(w => w.widgetId)));
   ```

## Next Steps

1. Implement Fix 2 (verification before save) - **CRITICAL**
2. Add more logging to track widget ID flow
3. Test thoroughly with multiple layouts
4. Consider adding a "Refresh Layout" button for users if they encounter stale state

## Related Files

- `frontend/src/components/LayoutDesign.jsx` - Main component with the issue
- `backend/src/controllers/layoutController.js` - Backend (working correctly)
- `backend/src/controllers/widgetController.js` - Widget update endpoint (working correctly)

## API Documentation Reference

The Xibo API documentation confirms:
- `PUT /playlist/widget/{widgetId}/elements` requires the widget to belong to a DRAFT layout
- Widget IDs are unique across the system
- Draft layouts have different widget IDs than their published parents
- You cannot edit widgets from published layouts
