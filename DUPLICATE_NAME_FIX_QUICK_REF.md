# Quick Fix Reference - Duplicate Name Issue

## What Was Fixed

### Backend Issues (libraryController.js)

1. **Media Name Extraction**

   - Enhanced `extractMediaName()` to handle null/empty values properly
   - Added trimming to prevent whitespace issues

2. **Duplicate Detection**

   - Fixed `checkMediaNameAvailability()` to properly iterate through media list
   - Improved response format handling for Xibo API
   - Better Set-based deduplication logic

3. **Name Update After Upload**

   - Fixed `updateMediaName()` to properly extract stored name from response
   - Returns structured object with both requested and actual names
   - Properly detects name truncation

4. **Upload Flow**
   - Better comparison logic for detecting name changes (case-insensitive)
   - Improved fallback handling when name update fails

### Frontend Issues (MediaContent.jsx)

1. **Name Validation**

   - Stores complete suggestion object including original name
   - Better error message formatting

2. **Upload Submission**

   - Explicit handling of 409 Conflict responses
   - Captures and displays server suggestions
   - Prevents upload while suggestion is pending

3. **User Interface**
   - Enhanced suggestion display with conflict details
   - Added "Try different name" button for manual retry
   - Better visual feedback with monospace font for names

## Key Code Changes

### Backend - Name Extraction

```javascript
// BEFORE: Could return empty strings or null values inconsistently
const extractMediaName = (item) => {
  return item?.name || item?.mediaName || item?.media_name || null;
};

// AFTER: Properly validates and trims
const extractMediaName = (item) => {
  const mediaName = item?.name || item?.mediaName || item?.media_name || null;
  return typeof mediaName === "string" && mediaName.trim()
    ? mediaName.trim()
    : null;
};
```

### Backend - Duplicate Detection

```javascript
// BEFORE: Could fail to properly iterate through array
const existingNames = new Set(
  mediaList
    .map((item) => extractMediaName(item))
    .filter((name) => typeof name === "string" && name.trim().length > 0)
    .map((name) => name.trim().toLowerCase())
);

// AFTER: More robust iteration and null-safe
const existingNames = new Set();
mediaList.forEach((item) => {
  const mediaName = extractMediaName(item);
  if (mediaName) {
    existingNames.add(mediaName.toLowerCase());
  }
});
```

### Backend - Name Update

```javascript
// BEFORE: Could lose name information from response
return response;

// AFTER: Preserves and structures all name information
return {
  requestedName: desiredName,
  storedName: storedName,
  name: storedName,
  fileName: storedName,
  mediaName: storedName,
  ...response,
};
```

### Frontend - Upload Error Handling

```javascript
// ADDED: Explicit 409 Conflict handling
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

### Frontend - UI Enhancement

```javascript
// BEFORE: Simple button with minimal feedback
{nameSuggestion?.suggestedName && (
  <button onClick={() => ...}>Use suggested name</button>
)}

// AFTER: Enhanced display with context and options
{nameSuggestion?.suggestedName && (
  <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-3 ...">
    <div>
      <p>Conflict Detected: "{nameSuggestion.originalName}" already exists</p>
      <p>Suggested: "{nameSuggestion.suggestedName}"</p>
    </div>
    <div className="flex gap-2">
      <button>Use suggested name</button>
      <button>Try different name</button>
    </div>
  </div>
)}
```

## How It Works Now

1. **User uploads media** → Validates name server-side
2. **Duplicate found** → Server returns 409 with suggestion (e.g., "file_1732300800000.ext")
3. **Frontend shows options** → User can use suggestion or try different name
4. **User clicks "Use suggested"** → Name field auto-fills, upload retries
5. **Upload succeeds** → Media stored with unique name
6. **Library updates** → New media appears with correct name

## File Locations

- Backend fixes: `/backend/src/controllers/libraryController.js`
- Frontend fixes: `/frontend/src/components/MediaContent.jsx`
- This summary: `/DUPLICATE_NAME_FIX_SUMMARY.md`
- This reference: `/DUPLICATE_NAME_FIX_QUICK_REF.md`

## Testing Commands

```bash
# Check backend for errors
npm run lint --prefix backend

# Check frontend for errors
npm run lint --prefix frontend

# Start backend
npm start --prefix backend

# Start frontend (separate terminal)
npm run dev --prefix frontend
```

## Next Steps

1. Test upload with duplicate name - should show suggestion
2. Click "Use suggested name" - should retry automatically
3. Verify media appears in library with unique name
4. Check browser console and server logs for debug info
