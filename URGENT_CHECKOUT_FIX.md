# URGENT FIX NEEDED - Layout Checkout Issue

**Current Problem:** User is trying to edit widgets from PUBLISHED layout instead of DRAFT layout

## Error Analysis

### Error 1 (Widget 19892 on Layout 4903 - Draft):
```
message: 'Invalid element JSON'
```
This is the API limitation we identified.

### Error 2 (Widget 19886 on Layout 4901 - Published):
```
message: 'This Layout is not a Draft, please checkout.'
property: 'layoutId'
```
**This is the real problem!** User is editing the published layout, not the draft.

## Root Cause

The user is on layout 4901 (published) and trying to edit widget 19886. The widget belongs to the published layout, not a draft.

**What should happen:**
1. User opens published layout 4901
2. Auto-checkout triggers
3. Creates draft layout (e.g., 4903)
4. Page reloads with draft layout 4903
5. User edits widgets from draft (e.g., widget 19892)

**What's actually happening:**
1. User opens published layout 4901
2. Auto-checkout might not be triggering
3. OR page isn't reloading properly
4. User tries to edit widget 19886 (from published layout)
5. Xibo API rejects: "not a draft"

## Immediate Actions Needed

### 1. Check Auto-Checkout Trigger
The `handleTextDoubleClick` should check if layout is published and trigger checkout.

### 2. Ensure Page Reload After Checkout
After checkout, MUST do `window.location.href` to reload with draft layout ID.

### 3. Verify Widget Belongs to Current Layout
Before saving, verify the widget ID belongs to the currently loaded layout.

## Quick Fix

The hybrid solution I just implemented should prevent this, but it seems the code didn't reload properly. Need to:

1. **Refresh the browser** to load the new code
2. **Verify the dialog appears** when double-clicking text
3. **If dialog doesn't appear**, the HMR didn't work - need manual refresh

## Testing Steps

1. Open layout 4901 (published)
2. Double-click text element
3. **Expected:** Dialog should appear explaining Canvas limitation
4. **If no dialog:** Code didn't reload - refresh browser
5. **If dialog appears:** Click OK to open Xibo CMS

---

**Status:** Waiting for user to refresh browser to load new code
