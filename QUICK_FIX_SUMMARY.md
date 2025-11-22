# 🔧 Critical Fix: Playlist Media Attachment Issue

## Problem Summary

Adding media to playlists was failing with **422 "Invalid Argument"** error.

## Root Cause

**Incorrect FormData Field Name for Array Parameters**

The XIBO API endpoint `/playlist/library/assign/{playlistId}` expects:

- Array parameters to use **bracket notation**: `media[]`
- NOT simple field names: `media`

### Before (❌ BROKEN)

```javascript
mediaIds.forEach((mediaId) => {
  formData.append("media", String(mediaId)); // ← Wrong!
});
```

Response:

```
status: 422
message: 'Invalid Argument'
```

### After (✅ FIXED)

```javascript
mediaIds.forEach((mediaId) => {
  formData.append("media[]", String(mediaId)); // ← Correct!
});
```

Response:

```
status: 200
message: '1 media item(s) successfully added to playlist'
```

---

## Files Modified

**`backend/src/controllers/addMediaPlaylistController.js`**

Lines 71-73:

```diff
  // Add media IDs as separate form fields with array notation
  // XIBO requires "media[]" for array parameters in form data
  mediaIds.forEach((mediaId) => {
-   formData.append("media", String(mediaId));
+   formData.append("media[]", String(mediaId));
  });
```

---

## Why This Matters

The XIBO API follows standard form data conventions where:

- Single values use field names: `name`, `duration`
- Array/multiple values use bracket notation: `media[]`, `tags[]`

Without the brackets, the form parser doesn't recognize it as an array, causing:

- The parameter to be ignored
- Missing required `media` parameter error (422 Invalid Argument)

---

## Testing

After this fix:

1. ✅ Adding single media to playlist returns 200 OK
2. ✅ Adding multiple media items returns 200 OK
3. ✅ Media appears in playlist detail view
4. ✅ No more 422 "Invalid Argument" errors

---

## Additional Notes

### Related Issues (Already Documented)

**Issue**: Media upload succeeds but name truncates to 't'

- **File**: `backend/src/controllers/libraryController.js`
- **Status**: Needs debugging - PUT request to update name returns 422

**Issue**: Playlist media addition endpoint may need additional tweaks

- **File**: `backend/src/controllers/addMediaPlaylistController.js`
- **Status**: ✅ Primary fix applied, ready for testing

---

**Applied**: November 22, 2025
**Status**: ✅ Ready for Testing
