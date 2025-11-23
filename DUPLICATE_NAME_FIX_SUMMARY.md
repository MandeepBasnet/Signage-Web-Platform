# Media Upload Duplicate Name Fix - Complete Summary

## Overview

Fixed critical issues with duplicate media name detection and handling across the media upload flow in `libraryController.js`, `libraryRoutes.js`, and `MediaContent.jsx`.

## Issues Resolved

### 1. **Duplicate Name Detection Failures**

**Problem**: The `checkMediaNameAvailability` function had several issues:

- Inconsistent handling of Xibo API response formats
- Failed to properly handle empty/null names
- Loose comparison logic that could miss duplicates
- Poor error handling that would still fail the upload

**Solution** (Backend - `libraryController.js`):

- Enhanced `extractMediaName()` to properly validate and trim media names
- Improved response format handling with additional fallbacks
- Updated name comparison to use Set-based deduplication with proper null filtering
- Better logging to track duplicate check process

```javascript
const extractMediaName = (item) => {
  const mediaName = item?.name || item?.mediaName || item?.media_name || null;
  return typeof mediaName === "string" && mediaName.trim()
    ? mediaName.trim()
    : null;
};
```

### 2. **Name Truncation During Upload**

**Problem**: Xibo CMS may truncate or modify media names during upload. The response didn't properly capture the actual stored name.

**Solution** (Backend - `libraryController.js`):

- Enhanced `updateMediaName()` function to return both requested and actual stored names
- Returns object with `storedName`, `name`, `fileName`, and `mediaName` properties
- Properly detects when names were truncated by comparing requested vs. stored

```javascript
return {
  requestedName: desiredName,
  storedName: storedName,
  name: storedName,
  fileName: storedName,
  mediaName: storedName,
  ...response,
};
```

### 3. **Upload Failure Handling**

**Problem**: When upload failed due to duplicate names, the server and frontend didn't properly communicate the issue or provide recovery options.

**Solution**:

- Added explicit 409 Conflict status handling in upload response
- Server returns suggested alternative names with timestamps
- Better error messaging with `changeReason` for user guidance

### 4. **Frontend Error Recovery**

**Problem**: Frontend couldn't properly retry with suggested names or provide clear feedback about conflicts.

**Solution** (Frontend - `MediaContent.jsx`):

- Enhanced `validateMediaNameAvailability()` to store full suggestion details
- Added explicit 409 handling in `handleUploadSubmit()` with suggestion UI
- Improved UX with two-button suggestion box: "Use suggested name" and "Try different name"
- Better error messages showing original vs. suggested names

```javascript
if (response.status === 409) {
  setUploadError(result?.message || "...");
  if (result?.nameInfo) {
    setNameSuggestion({
      originalName: result.nameInfo.originalName,
      suggestedName: result.nameInfo.suggestedName,
      wasChanged: result.nameInfo.wasChanged,
      changeReason: result.nameInfo.changeReason,
    });
  }
  return;
}
```

## Key Changes by File

### Backend: `libraryController.js`

#### 1. **extractMediaName() Function**

- Now trims and validates names
- Returns null for empty strings
- Prevents false positives in duplicate detection

#### 2. **checkMediaNameAvailability() Function**

- Better response format handling with additional fallbacks
- Improved Set-based name deduplication
- Better logging and error recovery

#### 3. **updateMediaName() Function**

- Enhanced to properly extract stored name from Xibo response
- Returns structured object with both requested and actual names
- Better handling of truncated names

#### 4. **uploadMedia() Function**

- Now properly compares case-insensitively when checking for name changes
- Better name change detection logic
- Graceful fallback if name update fails

### Frontend: `MediaContent.jsx`

#### 1. **validateMediaNameAvailability() Function**

- Stores complete suggestion object with original name
- Better error handling for validation failures
- Clears suggestions only when name is truly valid

#### 2. **handleUploadSubmit() Function**

- Explicit 409 Conflict handling
- Captures suggestions from server
- Prevents upload while suggestion is pending

#### 3. **Name Suggestion UI**

- Enhanced display showing conflict reason
- Shows both original and suggested names in monospace font
- Provides two action buttons:
  - "Use suggested name" - accepts suggestion and retries
  - "Try different name" - clears suggestion for manual input

## Testing Checklist

- [ ] Upload media with unique name (should succeed)
- [ ] Upload media with duplicate name (should show 409 error)
- [ ] Click "Use suggested name" button (should retry with auto-generated name)
- [ ] Try different name and upload (should succeed)
- [ ] Verify uploaded media appears in library with correct name
- [ ] Check server logs for proper duplicate detection messages
- [ ] Test with special characters in filenames
- [ ] Test with very long filenames (should be handled)

## API Response Examples

### Validation Endpoint (409 Conflict)

```json
{
  "success": false,
  "message": "A media named 'document.pdf' already exists in your library.",
  "nameInfo": {
    "originalName": "document.pdf",
    "suggestedName": "document_1732300800000.pdf",
    "wasChanged": true,
    "changeReason": "The name \"document.pdf\" is already in use. Suggested alternative: \"document_1732300800000.pdf\"."
  }
}
```

### Upload Endpoint (409 Conflict)

```json
{
  "success": false,
  "message": "A media named 'image.png' already exists in your library.",
  "nameInfo": {
    "originalName": "image.png",
    "suggestedName": "image_1732300800000.png",
    "wasChanged": true,
    "changeReason": "The name \"image.png\" is already in use. Suggested alternative: \"image_1732300800000.png\"."
  }
}
```

### Upload Endpoint (201 Success with Name Changed)

```json
{
  "success": true,
  "data": { ... },
  "message": "Media uploaded successfully",
  "nameInfo": {
    "originalName": "video.mp4",
    "finalName": "video.mp4",
    "wasChanged": false,
    "changeReason": null
  }
}
```

## Improvements Made

1. **Robustness**: Better handling of various Xibo API response formats
2. **User Experience**: Clear feedback about duplicate conflicts with easy recovery
3. **Name Integrity**: Proper detection and handling of name truncation
4. **Error Recovery**: Automatic suggestion generation with timestamp-based uniqueness
5. **Logging**: Enhanced debug logs for troubleshooting
6. **Case Sensitivity**: Proper case-insensitive comparison for names

## Backward Compatibility

All changes are backward compatible:

- Existing upload flows continue to work
- Response format is extended, not modified
- Frontend gracefully handles missing suggestion data
- No breaking changes to API contracts

## Future Enhancements

1. Add batch upload support with duplicate conflict handling
2. Implement configurable duplicate handling strategies
3. Add media name history/audit trail
4. Implement smart naming suggestions (e.g., "file (1)", "file (2)")
5. Cache duplicate names in memory for faster lookups
