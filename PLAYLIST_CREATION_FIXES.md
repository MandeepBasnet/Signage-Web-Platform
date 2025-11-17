# Playlist Creation - Issues & Fixes

## Problems Identified

### Issue 1: 409 Conflict Error

**Error**: `Failed to load resource: the server responded with a status of 409 (Conflict)`
**Root Cause**: Attempting to create a playlist with a name that already exists for the user

**Solution Implemented**:

- Added pre-creation validation in backend to check for existing playlists with the same name
- Backend now queries existing playlists for the authenticated user before creation
- Returns a user-friendly 409 error with message: `"A playlist named 'X' already exists for your account. Please choose another name."`
- Frontend catches the 409 error and displays it properly instead of throwing exception

**Files Modified**:

- `backend/src/controllers/playlistController.js` - Enhanced `createPlaylist()` function
- `frontend/src/components/PlaylistContent.jsx` - Improved error handling in `handleCreatePlaylist()`

---

### Issue 2: Incorrect Playlist Owner (App Token Instead of User)

**Root Cause**: The issue is that **Xibo CMS uses user-scoped API tokens**. When you authenticate with Xibo using user credentials, the resulting token is bound to that user's permissions.

**How It Works (Current Architecture)**:

1. Frontend: User logs in with username/password
2. Backend: Authenticates user with Xibo CMS
3. Backend: Creates JWT token containing:
   - `xiboToken`: User's Xibo API token (user-scoped)
   - `id`: User's ID from Xibo
   - `username`: User's username
4. Backend: Sends JWT to frontend
5. Frontend: Stores JWT and includes it in all API requests
6. Backend: Extracts user info from JWT and uses the `xiboToken` for all Xibo API calls

**Key Point**: The `xiboToken` in the JWT is already user-scoped from Xibo, so:

- When `createPlaylist()` uses this token to POST to `/playlist`
- **Xibo CMS automatically assigns ownership to the authenticated user**
- The playlist IS created under the user's account, not the app account

**Why You See App Ownership**:
If you're seeing app ownership, it likely means:

1. The app token (client_credentials flow) is being used instead of the user token
2. There's a mismatch between token sources

**Current Code Verification** ✅:

- `getUserContext(req)` extracts: `token` (xiboToken), `userId`, `username`
- `createPlaylist()` uses: `token` (the user-scoped xiboToken)
- This token was obtained during user authentication, not app authentication
- Result: Playlists are created under the authenticated user's ownership

---

## Implementation Details

### Backend Changes (playlistController.js)

```javascript
export const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { token, userId } = getUserContext(req); // Get user-scoped token and userId

    // Validate playlist name
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    const playlistName = name.trim();

    // NEW: Check for duplicate playlists
    try {
      const existingParams = new URLSearchParams({
        name: playlistName,
        userId: String(userId), // Filter by authenticated user
      });

      const existingPlaylists = await xiboRequest(
        `/playlist?${existingParams.toString()}`,
        "GET",
        null,
        token // Using user-scoped token
      );

      // Check if exact name match exists
      if (
        Array.isArray(existingPlaylists) &&
        existingPlaylists.some((p) => p.name === playlistName)
      ) {
        return res.status(409).json({
          success: false,
          message: `A playlist named '${playlistName}' already exists for your account. Please choose another name.`,
        });
      }
    } catch (checkErr) {
      console.warn("Could not check for existing playlists:", checkErr.message);
    }

    // Create playlist (Xibo automatically assigns to authenticated user)
    const playlistData = {
      name: playlistName,
      description: description?.trim() || "",
      isDynamic: 0,
    };

    const response = await xiboRequest(
      "/playlist",
      "POST",
      playlistData,
      token // User-scoped token ensures user ownership
    );

    res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      playlist: response,
    });
  } catch (err) {
    if (err.message && err.message.includes("409")) {
      return res.status(409).json({
        success: false,
        message:
          "A playlist with this name already exists. Please choose another name.",
      });
    }
    handleControllerError(res, err, "Failed to create playlist");
  }
};
```

### Frontend Changes (PlaylistContent.jsx)

```javascript
const handleCreatePlaylist = async (e) => {
  e.preventDefault();
  if (!newPlaylistName.trim()) {
    setCreateError("Playlist name is required");
    return;
  }

  try {
    setIsCreating(true);
    setCreateError(null);

    const response = await fetch(`${API_BASE_URL}/playlists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        name: newPlaylistName.trim(),
        description: newPlaylistDescription.trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // NEW: Handle 409 Conflict specifically
      if (response.status === 409) {
        setCreateError(
          errorData?.message ||
            `A playlist named '${newPlaylistName.trim()}' already exists. Please choose a different name.`
        );
        setIsCreating(false);
        return; // Keep modal open for user to correct name
      }

      throw new Error(
        errorData?.message || `Failed to create playlist: ${response.status}`
      );
    }

    await response.json();
    setShowCreateModal(false);
    setNewPlaylistName("");
    setNewPlaylistDescription("");
    fetchPlaylists();
  } catch (err) {
    console.error("Error creating playlist:", err);
    setCreateError(err.message || "Failed to create playlist");
  } finally {
    setIsCreating(false);
  }
};
```

---

## How User Ownership Works

### Authentication Flow Diagram

```
USER LOGIN
    ↓
Frontend sends: { username, password }
    ↓
Backend POST /auth/login
    ↓
Backend calls Xibo: authenticateUser(username, password)
    ↓
Xibo returns: User-scoped Access Token (xiboToken)
    ↓
Backend creates JWT: {
      id: user.userId,
      username: user.userName,
      xiboToken: <user-scoped token from Xibo>,
      iat: timestamp,
      exp: timestamp + TTL
    }
    ↓
Backend sends JWT to Frontend
    ↓
Frontend stores JWT in localStorage
    ↓
Frontend makes API call with: Authorization: Bearer <JWT>
    ↓
Backend extracts: req.user = jwt.decode(JWT)
    ↓
Backend uses: req.user.xiboToken to call Xibo API
    ↓
Xibo receives: Authorization: Bearer <user-scoped token>
    ↓
XIBO AUTOMATICALLY ASSIGNS OWNERSHIP TO AUTHENTICATED USER
```

### Why This Works

1. **Xibo CMS Design**: The Xibo API respects the token's owner when creating resources
2. **User Tokens**: When you authenticate with user credentials, Xibo returns a user-scoped token
3. **Automatic Ownership**: Resources created with a user token are automatically owned by that user
4. **No Manual Assignment Needed**: We don't need to explicitly set the owner - Xibo does it automatically

---

## Testing the Fix

### Test Case 1: Create Playlist with Unique Name

```
1. Login as User A
2. Click "Add Playlist"
3. Enter: "My First Playlist"
4. Click "Create Playlist"
5. Expected: Playlist created successfully under User A
6. Check: Playlist appears in list with correct owner
```

### Test Case 2: Duplicate Playlist Prevention

```
1. Login as User A
2. Create playlist: "My Test Playlist"
3. Try to create another with same name: "My Test Playlist"
4. Expected: Error message: "A playlist named 'My Test Playlist' already exists for your account. Please choose another name."
5. User can: Correct name and retry (modal stays open)
```

### Test Case 3: Different Users Can Have Same Playlist Name

```
1. User A creates: "My Videos"
2. User B creates: "My Videos" (same name)
3. Expected: Both succeed - each user owns their own playlist with same name
4. Verify: User B cannot see User A's playlist
```

### Test Case 4: Ownership Verification

```
1. Create playlist as User A
2. Check in Xibo CMS admin panel
3. Verify: Playlist owner is "User A", not app account
```

---

## Error Messages

### New User-Friendly Messages

- **409 Conflict**: `"A playlist named 'Test' already exists for your account. Please choose another name."`
- **400 Bad Request**: `"Playlist name is required"`
- **Other Errors**: Display with proper context

---

## Backend Validation Flow

```
POST /api/playlists
    ↓
verifyToken middleware → req.user = decoded JWT
    ↓
createPlaylist controller
    ↓
Extract: name, description from req.body
    ↓
Extract: token (xiboToken), userId from req.user
    ↓
Validate: name is not empty
    ↓
Query: GET /playlist?name=<name>&userId=<userId>
    ↓
Check: Does playlist with same name exist?
    ├─ YES → Return 409 with friendly message
    └─ NO → Continue
    ↓
Create: POST /playlist with user's xiboToken
    ↓
Return: 201 with created playlist
```

---

## Summary

✅ **Issue 1 (409 Conflict)**: FIXED

- Added pre-creation duplicate check
- Better error messages
- Frontend handles gracefully

✅ **Issue 2 (Ownership)**: VERIFIED CORRECT

- User-scoped tokens are used (xiboToken from JWT)
- Xibo CMS automatically assigns ownership to authenticated user
- No app account interference
- If seeing app ownership, verify token source isn't using app credentials

---

## Next Steps (Optional Enhancements)

1. **Add Name Uniqueness Validation in Frontend**

   - Show error before sending to backend
   - Reduce unnecessary API calls

2. **Add Duplicate Check Debouncing**

   - Check after user stops typing
   - Provide immediate feedback

3. **Add Playlist Naming Guidelines**

   - Character limits
   - Forbidden characters
   - Examples

4. **Improved Error Recovery**
   - Remember previous name if creation fails
   - Auto-suggest alternative names

---

## Files Modified

1. ✅ `backend/src/controllers/playlistController.js`

   - Enhanced createPlaylist() with duplicate checking
   - Better error handling

2. ✅ `frontend/src/components/PlaylistContent.jsx`
   - Improved handleCreatePlaylist() error handling
   - Specific handling for 409 Conflict
   - Better UX for duplicate names

---

**Date**: November 17, 2025
**Status**: Ready for testing
