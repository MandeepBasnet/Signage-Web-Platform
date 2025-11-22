# Playlist Media Upload & Attachment Fix Analysis

## Critical Issues Identified

### Issue #1: Add Media to Playlist Returns 422 "Invalid Argument"

**Location**: `POST /api/playlists/{playlistId}/media`
**Root Cause**: FormData field naming conflict for array parameters

**Problem**:

```
Assigning media to playlist 16005 with: {
  mediaCount: 1,
  duration: 'default',
  useDuration: 'default',
  displayOrder: 'default'
}
Failed to add media to playlist: {
  status: 422,
  message: 'Invalid Argument',
```

**Why It Happens**:
According to XIBO_API_DOCUMENTATION.md:

```
POST /playlist/library/assign/{playlistId}
Form Data:
- media (array[integer], required): Array of Media IDs
```

We were using `media` field name, but XIBO's form data parser expects `media[]` for array parameters.

**Fix Applied**:

```javascript
// ❌ WRONG
mediaIds.forEach((mediaId) => {
  formData.append("media", String(mediaId));
});

// ✅ CORRECT
mediaIds.forEach((mediaId) => {
  formData.append("media[]", String(mediaId));
});
```

---

### Issue #2: Media Upload Succeeds But Name Gets Truncated to Single Character

**Location**: `POST /api/library/upload`
**Symptom**: Media uploads with full name (e.g., "Screenshot 2025-07-24 113837.png") but XIBO returns `name: 't'`

**Problem**:

```
Uploading to Xibo CMS with name "Screenshot 2025-07-24 113837.png"
Upload successful: { mediaId: 4704, name: 't', size: 607216 }
```

**Why It Happens**:
The form data encoding might be getting corrupted during transmission to XIBO. When XIBO receives the form data, the `name` field value is being truncated to the first character.

**Potential Causes**:

1. Form data encoding issues when streaming file + form fields
2. XIBO API parsing the form data incorrectly
3. Conflict with how we're appending the name field alongside binary file data

**Workaround Implemented**:
After upload succeeds, explicitly update the media name via PUT request:

```javascript
const updateMediaName = async (
  mediaId,
  desiredName,
  duration,
  userXiboToken
) => {
  const updateData = {
    name: desiredName,
    duration: String(duration || 10),
    retired: "0",
  };

  const response = await xiboRequest(
    `/library/${mediaId}`,
    "PUT",
    updateData,
    userXiboToken
  );

  return response;
};
```

---

### Issue #3: PUT Request to Update Media Name Returns 422

**Location**: `PUT /library/{mediaId}` (from libraryController.js)
**Status Code**: 422 "The name must be between 1 and 100 characters"

**Problem**:

```
Sending PUT request with data: {
  name: 'testingLatest.png',
  duration: '10',
  retired: '0'
}
Failed to update media 4704 name: {
  error: 'Request failed with status code 422',
  response: {
    message: 'The name must be between 1 and 100 characters',
  }
}
```

**Why It Happens**:
The xiboRequest utility is correctly converting the data to FormData for PUT requests, but there might be an issue with:

1. Content-Type header not being set correctly
2. Form data encoding being malformed
3. XIBO API validation rejecting the empty field value for `name`

**Current Implementation** (in xiboClient.js):

```javascript
if (isPutRequest) {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    formData.append(key, data[key]);
  });
  requestConfig.data = formData;
  requestConfig.headers = {
    ...requestConfig.headers,
    ...formData.getHeaders(),
  };
}
```

This looks correct, so the issue might be elsewhere.

---

### Issue #4: Duplicate Detection Not Matching XIBO's Scope

**Location**: `POST /api/library/upload` → `checkMediaNameAvailability()`
**Problem**: Backend validation passes, but XIBO API rejects the name as duplicate

**Logs Show**:

```
Name "Screenshot 2025-07-24 113837.png" is unique for user 82. Found 14 existing names.
↓
Upload error: {
  errorMessage: 'You already own media with this name. Please choose another.',
}
```

**Why It Happens**:

1. Our check queries `/library?length=10000&ownerId={userId}`
2. XIBO might be checking duplicates across:
   - Retired/deleted media
   - Media that wasn't properly purged from database
   - Different user scopes (shared media, archived, etc.)

**Current Query**:

```javascript
const ownedMediaResponse = await xiboRequest(
  `/library?length=10000&ownerId=${userXiboUserId}`,
  "GET",
  null,
  userXiboToken
);
```

This should be checking only user-owned media. But XIBO's duplicate validation during upload might use a different check.

---

## Solutions Implemented

### Solution 1: Fixed Form Data Array Field Names ✅

**File**: `backend/src/controllers/addMediaPlaylistController.js`
**Change**: Changed from `media` to `media[]` for array parameters

```javascript
// Build form data according to Xibo API spec
const formData = new FormData();

// Add media IDs with array notation (XIBO requirement)
mediaIds.forEach((mediaId) => {
  formData.append("media[]", String(mediaId)); // ← Fixed!
});
```

**Expected Result**: 422 errors should resolve to 200 OK responses

---

### Solution 2: Add Media Name Update After Upload

**File**: `backend/src/controllers/libraryController.js`
**Status**: Already implemented

The `updateMediaName()` function is called after successful upload to explicitly set the name. However, it's currently failing with 422 errors.

**Next Steps**:

1. Debug why PUT /library/{mediaId} returns 422
2. May need to adjust the form data encoding or include additional required fields
3. Consider alternative approaches if XIBO API has different expectations

---

### Solution 3: Improve Duplicate Detection

**Recommendation**: Add retry logic with name suggestions when XIBO rejects as duplicate

```javascript
const attemptUploadWithRetry = async (preferredName, maxRetries = 3) => {
  let currentName = preferredName;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      return await attemptUpload(currentName);
    } catch (err) {
      if (err.message.includes("already own media with this name")) {
        // Generate new name with timestamp and retry
        retryCount++;
        const ext = path.extname(currentName);
        const base = currentName.substring(0, currentName.length - ext.length);
        currentName = `${base}_retry${retryCount}${ext}`;

        console.log(
          `Retry ${retryCount}: Attempting with name "${currentName}"`
        );
        continue;
      }
      throw err; // Re-throw non-duplicate errors
    }
  }

  throw new Error(`Upload failed after ${maxRetries} retries`);
};
```

---

## XIBO API Endpoint Validation

Per XIBO_API_DOCUMENTATION.md:

### POST /playlist/library/assign/{playlistId}

```
Form Data:
- media (array[integer], required): Array of Media IDs
- duration (integer): Optional duration for all media (seconds)
- useDuration (integer): Enable useDuration? (0 or 1)
- displayOrder (integer): Position in list

Response: 200 OK
```

**Our Implementation**:

- ✅ Field name changed to `media[]` (array notation)
- ✅ Numeric validation for all IDs
- ✅ String conversion for all form fields
- ✅ Error handling for status >= 400
- ✅ Correct response code 200 (not 201)

---

## Testing Checklist

- [ ] Test adding single media to playlist → should return 200 OK
- [ ] Test adding multiple media items → should return 200 OK
- [ ] Verify media appears in playlist after adding
- [ ] Upload new media → should maintain full name (not truncate to 't')
- [ ] Verify PUT request updates media name correctly
- [ ] Test duplicate name handling and retry logic
- [ ] Check error messages are descriptive

---

## Files Modified

| File                                                    | Changes                                                  |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `backend/src/controllers/addMediaPlaylistController.js` | Fixed media array field name from `media` to `media[]`   |
| `backend/src/utils/xiboClient.js`                       | Already correct for form data handling                   |
| `backend/src/controllers/libraryController.js`          | Already has updateMediaName() but PUT may need debugging |

---

## Next Debugging Steps

If issues persist:

1. **For 422 errors on PUT**:

   - Add console logs to see exact form data being sent
   - Compare with successful PUT requests in XIBO
   - Check if additional fields are required

2. **For name truncation**:

   - Log the response from XIBO when media is initially created
   - Check if it's a XIBO bug or our encoding issue
   - May need to query media immediately after upload to verify

3. **For duplicate conflicts**:
   - Implement retry logic with timestamp-based name generation
   - Log which names XIBO considers duplicates
   - Check if system is properly cleaning up old media

---

**Last Updated**: November 22, 2025
**Status**: ✅ Form data fix applied, needs testing
