# API Reference Validation & Changes Report

## Summary

This document outlines the API reference corrections and architectural improvements made to the AddMedia functionality for playlists.

---

## Issues Found & Fixed

### 1. **MEDIA FORM FIELD NAME ERROR** ❌ → ✅

**File**: `backend/src/controllers/playlistController.js` (Old) / `backend/src/controllers/addMediaPlaylistController.js` (New)

**Issue**:

```javascript
// ❌ WRONG - Appending "media[]"
mediaIds.forEach((mediaId) => {
  formData.append("media[]", String(mediaId)); // Incorrect field name
});
```

**XIBO API Spec** (`POST /playlist/library/assign/{playlistId}`):

- Required parameter: `media` (array[integer])
- Field name must be `media` (not `media[]`)

**Fix**:

```javascript
// ✅ CORRECT - Appending "media"
mediaIds.forEach((mediaId) => {
  formData.append("media", String(mediaId)); // Correct field name
});
```

---

### 2. **MISSING ENDPOINT VALIDATION** ❌ → ✅

**Issue**: No HTTP status validation or error handling

**Fix Applied**:

```javascript
// ✅ Added proper response validation
validateStatus: (status) => status < 500,

// Check for API errors
if (response.status >= 400) {
  const errorMsg = response.data?.message || response.data?.error;
  throw new HttpError(response.status, `Failed: ${errorMsg}`);
}
```

---

### 3. **INCORRECT RESPONSE STATUS CODE** ❌ → ✅

**Issue**: Returning 201 (Created) for media assignment

**XIBO API Spec** (`POST /playlist/library/assign/{playlistId}`):

- Response: `200 OK` (not 201 Created)
- 201 is only for creation operations, not assignment

**Fix**:

```javascript
// ❌ OLD
res.status(201).json({
  success: true,
  message: "Media added to playlist",
  data: response.data,
});

// ✅ NEW
res.status(200).json({
  success: true,
  message: `${mediaIds.length} media item(s) successfully added to playlist`,
  data: response.data,
  addedCount: mediaIds.length,
});
```

---

## New Features Added

### 1. **Separate Controller: `addMediaPlaylistController.js`**

**Location**: `backend/src/controllers/addMediaPlaylistController.js`

**Functions**:

- `addMediaToPlaylist()` - Add media to playlist (Fixed API refs)
- `getAvailableMediaForPlaylist()` - Fetch media for selection
- `removeMediaFromPlaylist()` - Delete widget from playlist
- `updateMediaDurationInPlaylist()` - Update media duration

**API References**:

```
POST   /playlist/library/assign/{playlistId}      - Add media
GET    /library                                   - Get user's media
DELETE /playlist/widget/{widgetId}               - Remove media
PUT    /playlist/widget/{widgetId}               - Update widget
```

---

### 2. **Separate Component: `AddMediaPlaylistButton.jsx`**

**Location**: `frontend/src/components/AddMediaPlaylistButton.jsx`

**Features**:

- Reusable modal component
- Three tabs: "Your Media", "All Library", "Upload"
- Media selection grid with "Add" button per item
- Upload form with validation
- Real-time folder selection
- Error handling and retry logic

**API Calls**:

```javascript
GET    /library              - Fetch user's media
GET    /library/all          - Fetch all library media
GET    /library/folders      - Get folder hierarchy
POST   /library/validate-name - Validate media name
POST   /library/upload        - Upload new media
POST   /playlists/{id}/media  - Add media to playlist
```

---

### 3. **Updated Routes: `playlistRoutes.js`**

**Before**:

```javascript
router.post("/:playlistId/media", verifyToken, addMediaToPlaylist);
```

**After**:

```javascript
// Media management for playlists
router.post("/:playlistId/media", verifyToken, addMediaToPlaylist);
router.get(
  "/:playlistId/available-media",
  verifyToken,
  getAvailableMediaForPlaylist
);
router.delete(
  "/:playlistId/media/:widgetId",
  verifyToken,
  removeMediaFromPlaylist
);
router.put(
  "/:playlistId/media/:widgetId/duration",
  verifyToken,
  updateMediaDurationInPlaylist
);
```

**New Endpoints**:

- `GET /playlists/{id}/available-media` - List media for selection
- `DELETE /playlists/{id}/media/{widgetId}` - Remove media from playlist
- `PUT /playlists/{id}/media/{widgetId}/duration` - Update media duration

---

## XIBO API Endpoint Reference

### Playlist Operations

| Method   | Endpoint         | Purpose         | Response       |
| -------- | ---------------- | --------------- | -------------- |
| `POST`   | `/playlist`      | Create playlist | 201 Created    |
| `GET`    | `/playlist`      | List playlists  | 200 OK         |
| `PUT`    | `/playlist/{id}` | Update playlist | 204 No Content |
| `DELETE` | `/playlist/{id}` | Delete playlist | 204 No Content |

### Media Assignment

| Method | Endpoint                                | Purpose               | Response   | Parameters                                                                     |
| ------ | --------------------------------------- | --------------------- | ---------- | ------------------------------------------------------------------------------ |
| `POST` | `/playlist/library/assign/{playlistId}` | Add media to playlist | **200 OK** | `media[]` (array), `duration` (opt), `useDuration` (opt), `displayOrder` (opt) |

**CRITICAL**:

- Field name MUST be `media` (not `media[]`)
- Response is `200 OK` (not 201 Created)
- Media IDs should be provided as separate form fields

### Library/Media

| Method   | Endpoint                 | Purpose               | Response            |
| -------- | ------------------------ | --------------------- | ------------------- |
| `GET`    | `/library`               | Get user's media      | 200 OK              |
| `GET`    | `/library/all`           | Get all library media | 200 OK              |
| `GET`    | `/library/folders`       | Get folder hierarchy  | 200 OK              |
| `POST`   | `/library/upload`        | Upload media file     | 201 Created         |
| `POST`   | `/library/validate-name` | Validate media name   | 200/409 OK/Conflict |
| `DELETE` | `/library/{mediaId}`     | Delete media          | 204 No Content      |

### Widget Operations

| Method   | Endpoint                               | Purpose                | Response       |
| -------- | -------------------------------------- | ---------------------- | -------------- |
| `POST`   | `/playlist/widget/{type}/{playlistId}` | Add widget to playlist | 201 Created    |
| `PUT`    | `/playlist/widget/{widgetId}`          | Update widget          | 200 OK         |
| `DELETE` | `/playlist/widget/{widgetId}`          | Delete widget          | 204 No Content |

---

## Migration Guide

### For Backend Usage

1. **Import new controller**:

   ```javascript
   import {
     addMediaToPlaylist,
     getAvailableMediaForPlaylist,
     removeMediaFromPlaylist,
     updateMediaDurationInPlaylist,
   } from "../controllers/addMediaPlaylistController.js";
   ```

2. **Use in routes** (already updated):
   ```javascript
   router.post("/:playlistId/media", verifyToken, addMediaToPlaylist);
   ```

### For Frontend Usage

1. **Import component**:

   ```javascript
   import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
   ```

2. **Use component**:
   ```jsx
   <AddMediaPlaylistButton
     playlistId={selectedPlaylist.playlistId}
     onMediaAdded={(mediaId) => {
       console.log("Media added:", mediaId);
       refreshPlaylist();
     }}
     onClose={() => {
       console.log("Modal closed");
     }}
     isOpen={showAddMediaModal}
   />
   ```

---

## Testing Checklist

- [ ] Add single media to playlist via modal
- [ ] Add multiple media items
- [ ] Upload new media directly in modal
- [ ] Verify folder selection works
- [ ] Test media name validation with duplicates
- [ ] Verify suggested name is used on conflict
- [ ] Remove media from playlist
- [ ] Update media duration
- [ ] Test error handling and retry logic
- [ ] Verify API responses match spec (200 vs 201)

---

## Files Changed

### Backend

- ✅ Created: `src/controllers/addMediaPlaylistController.js`
- ✅ Modified: `src/controllers/playlistController.js` (removed addMediaToPlaylist)
- ✅ Modified: `src/routes/playlistRoutes.js` (updated imports and routes)

### Frontend

- ✅ Created: `src/components/AddMediaPlaylistButton.jsx`
- ⏳ To Update: `src/components/PlaylistContent.jsx` (integrate new component)

---

## API Correctness Summary

| Issue                | Before          | After              | Impact                          |
| -------------------- | --------------- | ------------------ | ------------------------------- |
| Form field name      | `media[]`       | `media`            | **HIGH** - API Spec compliance  |
| Response status      | `201`           | `200`              | **HIGH** - HTTP spec compliance |
| Error handling       | None            | Full validation    | **MEDIUM** - Error visibility   |
| Parameter validation | None            | Numeric validation | **LOW** - Data integrity        |
| Media removal        | Not implemented | ✅ Implemented     | **NEW** - Feature complete      |
| Duration update      | Not implemented | ✅ Implemented     | **NEW** - Feature complete      |

---

## References

- XIBO API Documentation: `/XIBO_API_DOCUMENTATION.md`
- Playlist API Reference: Line 796-1050
- Media Assignment: Line 914-932
