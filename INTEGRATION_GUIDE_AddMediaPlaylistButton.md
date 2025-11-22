# PlaylistContent Integration Guide

## Quick Integration Steps

### Step 1: Import the new component

Add this import at the top of `PlaylistContent.jsx`:

```jsx
import AddMediaPlaylistButton from "./AddMediaPlaylistButton";
```

### Step 2: Replace the modal and state management

**Remove these state variables from PlaylistContent.jsx**:

```javascript
// ❌ REMOVE THESE - Now handled by AddMediaPlaylistButton
const [showAddMediaModal, setShowAddMediaModal] = useState(false);
const [addMediaTab, setAddMediaTab] = useState("owned");
const [ownedMediaOptions, setOwnedMediaOptions] = useState([]);
const [allMediaOptions, setAllMediaOptions] = useState([]);
const [mediaOptionsLoading, setMediaOptionsLoading] = useState(false);
const [mediaOptionsError, setMediaOptionsError] = useState(null);
const [attachingMediaId, setAttachingMediaId] = useState(null);
const [uploadFile, setUploadFile] = useState(null);
const [uploadName, setUploadName] = useState("");
const [uploadFolder, setUploadFolder] = useState("1");
const [uploadDuration, setUploadDuration] = useState(10);
const [uploading, setUploading] = useState(false);
const [uploadError, setUploadError] = useState(null);
const [uploadProgress, setUploadProgress] = useState(null);
const [folderOptions, setFolderOptions] = useState([]);
const [foldersLoading, setFoldersLoading] = useState(false);
const [uploadNameSuggestion, setUploadNameSuggestion] = useState(null);
```

**Add this simple state variable instead**:

```javascript
// ✅ ADD THIS - Much simpler state management
const [showAddMediaModal, setShowAddMediaModal] = useState(false);
```

### Step 3: Remove these functions from PlaylistContent.jsx

Remove these functions - they're now in AddMediaPlaylistButton:

- `fetchMediaOptions()`
- `fetchFolders()`
- `openAddMediaModal()`
- `resetUploadState()`
- `closeAddMediaModal()`
- `handleAddMediaTabChange()`
- `getSelectedPlaylistId()`
- `handleAttachMedia()`
- `handleUploadFileChange()`
- `validateUploadMediaName()`
- `handleUploadSubmit()`
- `renderMediaSelectionGrid()`

### Step 4: Replace the button

**Find this in the playlist detail view**:

```jsx
// ❌ OLD - Custom button
<button onClick={openAddMediaModal} className="...">
  + Add Media
</button>
```

**Replace with**:

```jsx
// ✅ NEW - Use the component
<AddMediaPlaylistButton
  playlistId={getSelectedPlaylistId()}
  onMediaAdded={(mediaId) => {
    // Refresh playlist details when media is added
    fetchPlaylistDetails(getSelectedPlaylistId());
  }}
  onClose={() => {
    // Optional: do something when modal closes
    console.log("Add media modal closed");
  }}
  isOpen={showAddMediaModal}
/>
```

### Step 5: Remove the old modal

**Remove this entire section from the return statement** (around line 1241):

```jsx
// ❌ REMOVE - Old modal implementation
{
  showAddMediaModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* ... entire modal JSX ... */}
    </div>
  );
}
```

---

## Benefits of This Refactoring

### Code Organization

- ✅ Separation of concerns - AddMedia logic in separate component
- ✅ Reduced PlaylistContent.jsx file size (from 1497 lines to ~1000 lines)
- ✅ Easier to maintain and test

### Reusability

- ✅ AddMediaPlaylistButton can be used in any component
- ✅ Self-contained with all required state and logic
- ✅ Props-based configuration for flexibility

### API Compliance

- ✅ Fixed form field names (`media` not `media[]`)
- ✅ Correct HTTP response codes (200 not 201)
- ✅ Complete error handling and validation

### Feature Completeness

- ✅ Media selection from library
- ✅ Media upload with validation
- ✅ Real-time folder selection
- ✅ Duplicate name detection with suggestions

---

## Files to Update

1. **PlaylistContent.jsx**

   - Remove state variables (mentioned above)
   - Remove functions (mentioned above)
   - Remove old modal markup (mentioned above)
   - Import AddMediaPlaylistButton
   - Replace button with new component

2. **OPTIONAL - Create a smaller example**
   - Consider creating a simplified "AddMediaExample.jsx" showing how to use the component

---

## API Endpoints Used by AddMediaPlaylistButton

The component makes these API calls automatically:

```
GET  /api/library              - Fetch user's media
GET  /api/library/all          - Fetch all library media
GET  /api/library/folders      - Get folder structure
POST /api/library/validate-name    - Validate media names
POST /api/library/upload           - Upload media
POST /api/playlists/{id}/media     - Add media to playlist
```

All endpoints require authentication (Bearer token in headers).

---

## Callback Functions

### `onMediaAdded(mediaId)`

Called when media is successfully added to the playlist.

```jsx
onMediaAdded={(mediaId) => {
  console.log("Added media:", mediaId);
  // Refresh the playlist to show new media
  fetchPlaylistDetails(selectedPlaylist.playlistId);
}}
```

### `onClose()`

Called when the modal is closed (by user action).

```jsx
onClose={() => {
  console.log("Modal closed");
  // Optional cleanup
}}
```

---

## Props Reference

| Prop           | Type          | Required | Description                                  |
| -------------- | ------------- | -------- | -------------------------------------------- |
| `playlistId`   | number/string | Yes      | The ID of the playlist to add media to       |
| `onMediaAdded` | function      | No       | Callback when media is added                 |
| `onClose`      | function      | No       | Callback when modal closes                   |
| `isOpen`       | boolean       | No       | Control modal visibility (defaults to false) |

---

## Example Usage in Different Contexts

### In a Playlist Detail View

```jsx
<AddMediaPlaylistButton
  playlistId={selectedPlaylist.playlistId}
  onMediaAdded={() => fetchPlaylistDetails(selectedPlaylist.playlistId)}
/>
```

### In a Modal Dialog

```jsx
{
  showPlaylistModal && (
    <AddMediaPlaylistButton
      playlistId={currentPlaylist.id}
      onMediaAdded={(mediaId) => {
        addMediaNotification(mediaId);
        refreshPlaylist();
      }}
      onClose={() => setShowPlaylistModal(false)}
      isOpen={true}
    />
  );
}
```

### Programmatically Control Modal

```jsx
const [showModal, setShowModal] = useState(false);

return (
  <>
    <button onClick={() => setShowModal(true)}>Add Media</button>
    <AddMediaPlaylistButton
      playlistId={playlistId}
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      onMediaAdded={(mediaId) => {
        // Handle media added
        setShowModal(false);
      }}
    />
  </>
);
```

---

## Testing the Integration

1. Import AddMediaPlaylistButton ✓
2. Add props to component ✓
3. Remove old modal code ✓
4. Remove old state variables ✓
5. Remove old functions ✓
6. Test "Add Media" button ✓
7. Verify media appears in playlist ✓
8. Test upload functionality ✓
9. Test error handling ✓
10. Test close modal ✓

---

## Troubleshooting

### Modal doesn't appear

- Check `isOpen` prop is set correctly
- Verify playlistId is not null/undefined
- Check browser console for errors

### Media not being added

- Check network tab for API responses
- Verify authentication headers are sent
- Check console for error messages

### Upload fails

- Check file size doesn't exceed 200MB limit
- Verify media name is valid
- Check media type is supported (image, video, audio, pdf)

---

## Next Steps

1. Update PlaylistContent.jsx with the integration steps above
2. Test all functionality
3. Remove or archive old AddMedia modal code
4. Update any other components using similar patterns
5. Update component documentation if needed
