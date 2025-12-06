# Text Element Editing - Testing Guide

**Date:** December 6, 2025  
**Implementation Status:** ✅ Phase 1 & 2 Complete  
**Ready for Testing:** Yes

---

## Changes Implemented

### Frontend Changes (`LayoutDesign.jsx`)

1. **✅ FormData Implementation** (Lines 1163-1185)
   - Replaced JSON request with FormData
   - Removed explicit `Content-Type: application/json` header
   - Browser now automatically sets `Content-Type: multipart/form-data`

2. **✅ Widget Validation** (Lines 1112-1127)
   - Added verification that widget belongs to current layout
   - Prevents stale state issues after checkout
   - Uses `currentWidget` for fresh data instead of passed parameter

3. **✅ Enhanced Error Handling** (Lines 1187-1221)
   - Specific error messages for different HTTP status codes
   - 422: Draft state error
   - 404: Widget not found
   - 400: Invalid request format
   - 401/403: Authentication errors
   - Development mode shows full error details

4. **✅ Removed Blocking Alert** (Lines 1069-1077)
   - Canvas/Global widgets can now be edited
   - No more warning message preventing edits

### Backend Changes (`widgetController.js`)

1. **✅ Enhanced Logging** (Lines 142-151)
   - Shows element type (string vs object)
   - Shows data preview (first 200 chars)
   - Prevents console overflow with large payloads

2. **✅ Comprehensive Error Logging** (Lines 160-173)
   - Logs full response details (status, statusText, data, headers)
   - Distinguishes between network errors and API errors
   - Helps debug Xibo API communication issues

---

## Testing Checklist

### Prerequisites

- [ ] Backend server running (`cd backend && npm run dev`)
- [ ] Frontend server running (`cd frontend && npm run dev`)
- [ ] Logged into the application
- [ ] Have a layout with Canvas/Global widget containing text elements

### Test Scenario 1: Edit Text in Published Layout

**Steps:**
1. Navigate to Dashboard
2. Click on a published layout with Canvas widget
3. Verify layout opens in designer
4. **Expected:** Auto-checkout should trigger
5. **Expected:** Layout should reload with DRAFT badge
6. Double-click on a text element in the canvas
7. **Expected:** Text editing modal/input appears (no blocking alert)
8. Edit the text value
9. Click "Save"
10. **Expected:** Success message appears
11. **Expected:** Text updates in canvas preview
12. Refresh the browser page
13. **Expected:** Text change persists

**Console Checks:**
- Frontend should log: `[Text Save] Sending FormData with elements...`
- Backend should log: `[updateWidgetElements] Elements type: string`
- Backend should log: `[updateWidgetElements] ✓ Successfully updated widget...`

### Test Scenario 2: Edit Text in Draft Layout

**Steps:**
1. Open a layout that is already in draft state
2. Verify "DRAFT" badge is visible
3. Double-click on a text element
4. Edit the text
5. Click "Save"
6. **Expected:** Success message appears
7. **Expected:** Text updates immediately

**Console Checks:**
- Should see: `[handleTextSave] ✓ Layout is draft (status=2)`
- Should see: `[handleTextSave] ✓ Widget verified in current layout`

### Test Scenario 3: Error Handling - Non-Draft Layout

**Steps:**
1. Manually navigate to a published layout (bypass auto-checkout)
2. Try to edit text
3. **Expected:** Error message: "Layout is not in draft state..."

### Test Scenario 4: Error Handling - Invalid Widget

**Steps:**
1. Open developer console
2. In console, manually call `handleTextSave` with invalid widget ID
3. **Expected:** Error message about widget not found

### Test Scenario 5: Network Error Handling

**Steps:**
1. Stop the backend server
2. Try to save text changes
3. **Expected:** Network error message
4. Check frontend console for detailed error (in dev mode)

### Test Scenario 6: Full Workflow

**Steps:**
1. Open published layout
2. Auto-checkout to draft
3. Edit text element #1
4. Save successfully
5. Edit text element #2
6. Save successfully
7. Publish the layout
8. **Expected:** Published layout shows both text changes
9. Checkout again
10. **Expected:** Can edit text in new draft

---

## Browser DevTools Inspection

### Network Tab

**What to check:**
1. Find the PUT request to `/api/playlists/widgets/{widgetId}/elements`
2. Check Request Headers:
   - Should have `Content-Type: multipart/form-data; boundary=...`
   - Should NOT have `Content-Type: application/json`
3. Check Request Payload:
   - Should show `elements` as a form field
   - Value should be JSON string
4. Check Response:
   - Status should be 200 OK
   - Response body should contain updated widget data

### Console Tab

**Frontend logs to verify:**
```
[handleTextSave] Widget details: {...}
[handleTextSave] ✓ Layout is draft (status=2)
[handleTextSave] Widget ID: 123
[handleTextSave] ✓ Widget verified in current layout
[Text Save] Updating widget 123 with new text elements
[Text Save] Sending FormData with elements (XXX chars)
[Text Save] ✓ Successfully updated widget 123
```

**Backend logs to verify:**
```
[updateWidgetElements] Updating widget 123
[updateWidgetElements] Elements type: string
[updateWidgetElements] Elements length: XXX
[updateWidgetElements] Elements preview: [{"elements":[...]}]...
[xiboRequest] PUT https://portal.signage-lab.com/api/playlist/widget/123/elements
[updateWidgetElements] ✓ Successfully updated widget 123
```

---

## Common Issues & Solutions

### Issue 1: "Widget not found in current layout"

**Cause:** Stale state after checkout  
**Solution:** Refresh the page  
**Prevention:** The fix should prevent this

### Issue 2: "Layout is not in draft state"

**Cause:** Trying to edit published layout  
**Solution:** Click "Edit" button to checkout  
**Note:** Auto-checkout should handle this automatically

### Issue 3: Network error / Failed to fetch

**Cause:** Backend server not running or network issue  
**Solution:** Check backend server is running on correct port  
**Check:** `http://localhost:5000/api/health` (if health endpoint exists)

### Issue 4: 422 Unprocessable Entity

**Cause:** Xibo API rejecting the request  
**Check:** Backend logs for Xibo API response details  
**Possible reasons:**
- Elements data format incorrect
- Widget doesn't support elements editing
- Layout permissions issue

### Issue 5: FormData not being sent

**Cause:** Browser compatibility or code error  
**Check:** Network tab shows `Content-Type: multipart/form-data`  
**Solution:** Verify FormData is created correctly in code

---

## Rollback Instructions

If the fix causes issues, rollback by reverting these commits:

### Frontend Rollback

```bash
cd frontend
git diff src/components/LayoutDesign.jsx
# Review changes, then:
git checkout HEAD -- src/components/LayoutDesign.jsx
```

### Backend Rollback

```bash
cd backend
git diff src/controllers/widgetController.js
# Review changes, then:
git checkout HEAD -- src/controllers/widgetController.js
```

### Re-enable Blocking Alert

If you need to temporarily disable text editing:

1. Open `frontend/src/components/LayoutDesign.jsx`
2. Find `handleTextDoubleClick` function (around line 1069)
3. Add back the blocking alert:

```javascript
const handleTextDoubleClick = (widget, currentText, elementId = null) => {
  if (widget.type === "core-canvas" || widget.type === "canvas" || widget.type === "global") {
    alert("Text editing temporarily disabled. Please use Xibo CMS interface.");
    return;
  }
  // ... rest of function
};
```

---

## Success Criteria

- [x] Code changes implemented
- [ ] Manual testing completed
- [ ] No console errors during save operation
- [ ] Text changes persist after page refresh
- [ ] Text changes persist after publish/checkout cycle
- [ ] Backend logs show successful Xibo API calls
- [ ] User receives clear success/error messages
- [ ] No regression in other widget editing functionality

---

## Next Steps

1. **Manual Testing** - Follow the testing checklist above
2. **Monitor Logs** - Check both frontend and backend console logs
3. **Test Edge Cases** - Try different widget types, layouts, and error scenarios
4. **User Acceptance** - Have a user test the feature
5. **Documentation** - Update user guide if successful

---

## Support

If you encounter issues during testing:

1. **Check Console Logs** - Both frontend and backend
2. **Check Network Tab** - Verify request format
3. **Check Backend Logs** - Look for Xibo API errors
4. **Review Error Messages** - They should now be more specific
5. **Consult Task Document** - `TEXT_ELEMENT_FIX_TASK.md` has debugging steps

---

**Testing Started:** [Date/Time]  
**Tested By:** [Name]  
**Status:** [Pass/Fail/In Progress]  
**Notes:** [Any observations or issues found]
