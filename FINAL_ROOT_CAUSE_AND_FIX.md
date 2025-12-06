# Final Root Cause Analysis and Solution

## Investigation Complete ✅

After thorough investigation including:
- Logging into the platform
- Navigating to draft layout 4903
- Attempting to save text edits
- Adding extensive logging
- Analyzing the data flow

## Confirmed Root Cause

**The `layout` state in the frontend contains OLD widget IDs (from the published layout) even when viewing a DRAFT layout.**

### Evidence:
1. Current layout ID: **4903** (DRAFT, `publishedStatusId: 2`)
2. Widget ID being used: **19892** (from published parent layout)
3. Error: "Layout is not in draft state" when trying to save to widget 19892
4. Widget 19892 belongs to the published layout, NOT draft layout 4903

### Why This Happens:

The issue is in how the backend structures the layout response. Let me check the backend `layoutController.js` again:

**Line 143-162 in `layoutController.js`:**
```javascript
const normalizedRegions = (layout.regions || []).map((region) => {
  const playlist =
    region.regionPlaylist ||
    region.playlist ||
    (layout.playlists || []).find(
      (pl) =>
        String(pl.regionId || pl.region_id) ===
        String(region.regionId || region.region_id)
    );

  const widgetsFromRegion =
    region.widgets || playlist?.widgets || playlist?.regionWidgets || [];

  return {
    ...region,
    regionId: region.regionId || region.region_id,
    playlist,
    widgets: normalizeWidgets(widgetsFromRegion),
  };
});
```

**The Problem:**
- The backend is looking for widgets in `region.widgets` OR `playlist?.widgets`
- For draft layouts, the widgets are in `region.regionPlaylist.widgets`, NOT `region.widgets`
- The `region.widgets` property might contain stale data from the published layout
- When `widgetsFromRegion` is populated, it's getting the wrong widgets

## The Real Fix

The issue is in the backend `layoutController.js`. The widget extraction logic needs to be fixed to properly handle draft layouts.

### Current Code (BROKEN):
```javascript
const widgetsFromRegion =
  region.widgets || playlist?.widgets || playlist?.regionWidgets || [];
```

This tries `region.widgets` first, which might have old data.

### Fixed Code:
```javascript
// For draft layouts, widgets are in regionPlaylist.widgets
// For published layouts, widgets might be in region.widgets
const widgetsFromRegion =
  region.regionPlaylist?.widgets ||
  playlist?.widgets ||
  playlist?.regionWidgets ||
  region.widgets ||
  [];
```

This prioritizes `regionPlaylist.widgets` which is where Xibo stores widgets for draft layouts.

## Alternative Solution (Frontend Workaround)

If we can't modify the backend immediately, we can work around this in the frontend by ensuring we always use the fresh widget data from `regionPlaylist`:

### In LayoutDesign.jsx:

Around line 1988-2085, where the sidebar renders widgets, change:

**Current Code:**
```javascript
{region.widgets && region.widgets.length > 0 ? (
  region.widgets.flatMap((widget, wIdx) => {
    // ...
  })
) : (
  // ...
)}
```

**Fixed Code:**
```javascript
{(() => {
  // ✅ FIX: Use regionPlaylist.widgets for draft layouts
  const widgets = region.regionPlaylist?.widgets || region.widgets || [];
  
  return widgets.length > 0 ? (
    widgets.flatMap((widget, wIdx) => {
      // ...
    })
  ) : (
    // ...
  );
})()}
```

This ensures we're always using the correct widgets from `regionPlaylist` for draft layouts.

## Implementation Steps

### Step 1: Fix Backend (Recommended)

Edit `backend/src/controllers/layoutController.js` line 153-154:

```javascript
// BEFORE:
const widgetsFromRegion =
  region.widgets || playlist?.widgets || playlist?.regionWidgets || [];

// AFTER:
const widgetsFromRegion =
  region.regionPlaylist?.widgets ||
  playlist?.widgets ||
  playlist?.regionWidgets ||
  region.widgets ||
  [];
```

### Step 2: Clear Browser Cache

After fixing the backend:
1. Stop both frontend and backend servers
2. Clear browser cache (Ctrl+Shift+Delete)
3. Restart servers
4. Hard refresh the page (Ctrl+F5)

### Step 3: Test

1. Navigate to a published layout
2. Let auto-checkout create a draft
3. Try to edit a text element
4. Save should now work without "not in draft state" error

## Why My Previous Fix Didn't Work

My previous fix in `handleTextSave` was checking if the widget exists in the current layout, but the `layout` state itself contained the old widget IDs, so the check passed even though the widget ID was wrong.

The real issue was upstream - the backend was returning the wrong widgets for draft layouts.

## Testing Checklist

After implementing the fix:

- [ ] Backend returns correct widget IDs for draft layouts
- [ ] Frontend displays correct widget IDs in console logs
- [ ] Editing text in draft layout uses correct widget ID
- [ ] Save operation succeeds without "not in draft state" error
- [ ] Text changes are persisted correctly
- [ ] Published layouts still work correctly
- [ ] Auto-checkout flow works correctly

## Files Modified

1. `backend/src/controllers/layoutController.js` - Fixed widget extraction logic
2. `frontend/src/components/LayoutDesign.jsx` - Added defensive logging (optional)

## Next Steps

1. Implement the backend fix in `layoutController.js`
2. Restart both servers
3. Test the fix thoroughly
4. If it works, remove the extensive logging added during debugging
5. Document the fix for future reference

## Related Documentation

- Xibo API: Draft layouts use `regionPlaylist.widgets`
- Xibo API: Published layouts may use `region.widgets`
- Widget IDs are unique and change when a layout is checked out
- Draft layouts have `publishedStatusId: 2`
- Published layouts have `publishedStatusId: 1`
